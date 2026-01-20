import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel

import json

from app.db.session import get_db
from app.db.models import (
    User,
    Document,
    DocumentVersion,
    Chunk,
    AnalyticsEvent,
    utcnow,
)
from app.core.security import decode_token
from app.core.config import settings
from app.schemas.document import DocumentOut, DocumentDetailOut
from app.utils.files import save_upload_bytes, file_path
from app.utils.permissions import require_area_access, get_allowed_area_ids
from app.services.ingest import ingest_document
from app.services.supabase_storage import SupabaseStorageError, create_signed_download_url

router = APIRouter(prefix="/documents", tags=["documents"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def normalize_tags(raw: Optional[object]) -> Optional[list[str]]:
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = [x.strip() for x in raw.split(",") if x.strip()]
    out = []
    for t in raw:
        if t is None:
            continue
        val = t.strip()
        if val:
            out.append(val)
    return out


def set_doc_tags(doc: Document, tags: Optional[list[str]]):
    if tags is None:
        return
    doc.tags = json.dumps(tags)


def log_event(db: Session, event_type: str, user_id: int, area_id: Optional[int], document_id: Optional[int], query: Optional[str] = None):
    db.add(AnalyticsEvent(event_type=event_type, user_id=user_id, area_id=area_id, document_id=document_id, query=query))
    db.commit()


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None


@router.get("", response_model=List[DocumentOut])
def list_documents(
    q: Optional[str] = Query(None, description="Title search"),
    area_id: Optional[int] = Query(None),
    tags: Optional[str] = Query(None, description="Comma-separated tags"),
    sort: str = Query("latest", pattern="^(latest|name)$"),
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    allowed_area_ids = get_allowed_area_ids(db, user, require_manage=False)
    if not allowed_area_ids:
        return []

    target_area_ids = allowed_area_ids
    if area_id:
        require_area_access(db, user, area_id, require_manage=False)
        target_area_ids = [area_id]

    query = db.query(Document).filter(Document.area_id.in_(target_area_ids))
    if not include_deleted:
        query = query.filter(Document.deleted_at.is_(None))

    if q:
        like = f"%{q.lower()}%"
        query = query.filter(func.lower(Document.title).like(like))

    if tags:
        tag_list = [t.strip().lower() for t in tags.split(",") if t.strip()]
        for t in tag_list:
            query = query.filter(func.lower(Document.tags).like(f"%{t}%"))

    if sort == "name":
        query = query.order_by(func.lower(Document.title).asc())
    else:
        query = query.order_by(Document.created_at.desc())

    return query.all()


@router.get("/{doc_id}", response_model=DocumentDetailOut)
def get_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    require_area_access(db, user, doc.area_id, require_manage=False)
    if doc.deleted_at:
        raise HTTPException(status_code=404, detail="Document deleted")

    log_event(db, "document_viewed", user.id, doc.area_id, doc.id)
    return doc


@router.post("/upload", response_model=DocumentDetailOut)
async def upload_document(
    area_id: int = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    tags: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_area_access(db, user, area_id, require_manage=True)
    if not title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    file_bytes = await file.read()
    try:
        stored_name = save_upload_bytes(file_bytes, file.filename, file.content_type or "application/octet-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    doc = Document(
        area_id=area_id,
        title=title,
        filename=stored_name,
        original_name=file.filename,
        mime_type=file.content_type or "",
        created_by=user.id,
    )
    set_doc_tags(doc, normalize_tags(tags) or [])

    db.add(doc)
    db.commit()
    db.refresh(doc)

    version = DocumentVersion(
        document_id=doc.id,
        version=1,
        file_path=stored_name,
        original_name=file.filename,
        mime_type=file.content_type or "",
        created_by=user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    doc.latest_version = version.version
    doc.latest_version_id = version.id
    db.add(doc)
    db.commit()
    db.refresh(doc)

    ingest_document(db, doc, version, file_bytes)

    return doc


@router.post("/{doc_id}/versions", response_model=DocumentDetailOut)
async def upload_version(
    doc_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if doc.deleted_at:
        raise HTTPException(status_code=404, detail="Document deleted")
    require_area_access(db, user, doc.area_id, require_manage=True)

    file_bytes = await file.read()
    try:
        stored_name = save_upload_bytes(file_bytes, file.filename, file.content_type or "application/octet-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    next_version = (doc.latest_version or 1) + 1
    version = DocumentVersion(
        document_id=doc.id,
        version=next_version,
        file_path=stored_name,
        original_name=file.filename,
        mime_type=file.content_type or "",
        created_by=user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    # Mark previous chunks as non-latest
    db.query(Chunk).filter(Chunk.document_id == doc.id).update({"is_latest": False})

    doc.latest_version = next_version
    doc.latest_version_id = version.id
    doc.filename = stored_name
    doc.original_name = file.filename
    doc.mime_type = file.content_type or doc.mime_type
    db.add(doc)
    db.commit()
    db.refresh(doc)

    ingest_document(db, doc, version, file_bytes)

    return doc


@router.patch("/{doc_id}", response_model=DocumentDetailOut)
def update_document(
    doc_id: int,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    require_area_access(db, user, doc.area_id, require_manage=True)
    if doc.deleted_at:
        raise HTTPException(status_code=404, detail="Document deleted")

    title = payload.title
    tags = payload.tags

    if title is not None:
        doc.title = title.strip() or doc.title
    if tags is not None:
        set_doc_tags(doc, normalize_tags(tags))

    if title is None and tags is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    require_area_access(db, user, doc.area_id, require_manage=True)

    doc.deleted_at = utcnow()
    db.add(doc)
    db.commit()
    return {"status": "deleted", "id": doc.id}


@router.get("/{doc_id}/download")
def download(doc_id: int, version: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    require_area_access(db, user, doc.area_id, require_manage=False)
    if doc.deleted_at:
        raise HTTPException(status_code=404, detail="Document deleted")

    target_version = doc.latest_version_ref
    if version is not None:
        target_version = (
            db.query(DocumentVersion)
            .filter(DocumentVersion.document_id == doc.id, DocumentVersion.version == version)
            .first()
        )
    if not target_version:
        raise HTTPException(status_code=404, detail="Version not found")

    if settings.storage_provider == "supabase":
        try:
            signed = create_signed_download_url(object_path=target_version.file_path, expires_in=60)
        except SupabaseStorageError as e:
            raise HTTPException(status_code=500, detail=str(e))
        return RedirectResponse(url=signed, status_code=307)

    path = file_path(target_version.file_path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(path, filename=target_version.original_name, media_type=target_version.mime_type or "application/octet-stream")
