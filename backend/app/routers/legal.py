from __future__ import annotations

import os
import re
from datetime import timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse, Response, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.core.config import settings
from app.db.models import (
    LegalApproval,
    LegalApprovalDecision,
    LegalAuditLog,
    LegalDocument,
    LegalDocumentStatus,
    LegalTemplate,
    LegalVersion,
    LegalExample,
    LegalExampleScope,
    LegalExampleStatus,
    User,
    utcnow,
)
from app.db.session import get_db
from app.schemas.legal import (
    LegalApprovalOut,
    LegalAuditLogOut,
    LegalDecisionIn,
    LegalDocumentCreateIn,
    LegalDocumentDetailOut,
    LegalDocumentOut,
    LegalDocumentUpdateIn,
    LegalOverviewOut,
    LegalSubmitForReviewIn,
    LegalTemplateCreateIn,
    LegalTemplateOut,
    LegalTemplateUpdateIn,
    LegalUserOut,
    LegalVersionOut,
)
from app.schemas.legal_examples import (
    LegalExampleOut,
    LegalExamplesListOut,
    LegalExampleRetryOut,
    LegalExampleUpdateIn,
    LegalTemplateGenerateWithExamplesIn,
    LegalTemplateGenerateWithExamplesOut,
)
from app.utils.permissions import (
    require_legal_approve,
    require_legal_delete,
    require_legal_edit,
    require_legal_template_admin,
    require_legal_view,
)
from app.utils.text_extract import extract_text_from_bytes
from app.services.supabase_storage import (
    SupabaseStorageError,
    build_legal_example_object_path,
    create_signed_download_url,
    delete_object,
    download_bytes,
    upload_bytes,
)


router = APIRouter(prefix="/api/legal", tags=["legal"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_\\.\\-]+)\s*\}\}")


def _render_placeholders(body: str, variables: dict[str, Any]) -> str:
    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        val = variables.get(key)
        if val is None:
            return m.group(0)
        return str(val)

    return PLACEHOLDER_RE.sub(repl, body or "")


def _audit(db: Session, actor_id: Optional[int], action: str, document_id: Optional[int] = None, metadata: Optional[dict[str, Any]] = None):
    db.add(LegalAuditLog(document_id=document_id, actor_id=actor_id, action=action, meta=metadata or {}))


def _doc_out(doc: LegalDocument) -> LegalDocumentOut:
    owner = doc.owner
    return LegalDocumentOut(
        id=doc.id,
        title=doc.title,
        type=doc.type,
        counterparty_name=doc.counterparty_name,
        counterparty_email=doc.counterparty_email,
        owner_id=doc.owner_id,
        owner_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else None,
        status=LegalDocumentStatus(doc.status),
        content=doc.content,
        variables=doc.variables or None,
        due_date=doc.due_date,
        expiry_date=doc.expiry_date,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def _can_edit_doc(user: User, doc: LegalDocument) -> bool:
    if user.role in ("SUPER_ADMIN", "ADMIN", "LEGAL_ADMIN"):
        return True
    return user.id == doc.owner_id and user.role == "LEGAL_EDITOR"


def _require_doc_edit(user: User, doc: LegalDocument):
    require_legal_edit(user)
    if not _can_edit_doc(user, doc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def _create_version(db: Session, doc: LegalDocument, actor_id: Optional[int]):
    latest = (
        db.query(func.max(LegalVersion.version_number))
        .filter(LegalVersion.document_id == doc.id)
        .scalar()
    )
    next_version = int(latest or 0) + 1
    db.add(
        LegalVersion(
            document_id=doc.id,
            version_number=next_version,
            content=doc.content,
            variables=doc.variables or {},
            created_by=actor_id,
        )
    )


def _ensure_transition(current: str, target: str):
    if current == target:
        return
    allowed: dict[str, set[str]] = {
        LegalDocumentStatus.DRAFT.value: {LegalDocumentStatus.IN_REVIEW.value, LegalDocumentStatus.ARCHIVED.value},
        LegalDocumentStatus.CHANGES_REQUESTED.value: {LegalDocumentStatus.IN_REVIEW.value, LegalDocumentStatus.ARCHIVED.value},
        LegalDocumentStatus.IN_REVIEW.value: {
            LegalDocumentStatus.APPROVED.value,
            LegalDocumentStatus.CHANGES_REQUESTED.value,
            LegalDocumentStatus.REJECTED.value,
        },
        LegalDocumentStatus.APPROVED.value: {LegalDocumentStatus.SIGNED.value, LegalDocumentStatus.ARCHIVED.value},
        LegalDocumentStatus.SIGNED.value: {LegalDocumentStatus.ARCHIVED.value},
        LegalDocumentStatus.REJECTED.value: {LegalDocumentStatus.ARCHIVED.value},
        LegalDocumentStatus.ARCHIVED.value: set(),
    }
    if target not in allowed.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition {current} -> {target}",
        )


@router.get("/overview", response_model=LegalOverviewOut)
def legal_overview(db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_view(user)

    counts = {
        s.value: db.query(func.count(LegalDocument.id)).filter(LegalDocument.status == s.value).scalar() or 0
        for s in LegalDocumentStatus
    }
    now = utcnow()
    expiring_soon = (
        db.query(func.count(LegalDocument.id))
        .filter(
            LegalDocument.expiry_date.is_not(None),
            LegalDocument.expiry_date >= now,
            LegalDocument.expiry_date <= now + timedelta(days=30),
            LegalDocument.status.in_([LegalDocumentStatus.APPROVED.value, LegalDocumentStatus.SIGNED.value]),
        )
        .scalar()
        or 0
    )
    recent = db.query(LegalAuditLog).order_by(LegalAuditLog.created_at.desc()).limit(20).all()
    return LegalOverviewOut(
        counts=counts,
        expiring_soon=expiring_soon,
        recent_activity=[LegalAuditLogOut.model_validate(r) for r in recent],
    )


@router.get("/documents", response_model=list[LegalDocumentOut])
def list_legal_documents(
    q: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    type_filter: Optional[str] = Query(default=None, alias="type"),
    owner_id: Optional[int] = None,
    counterparty: Optional[str] = None,
    sort: str = "updated",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_view(user)
    query = db.query(LegalDocument).join(User, User.id == LegalDocument.owner_id)

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(LegalDocument.title).like(term),
                func.lower(LegalDocument.counterparty_name).like(term),
                func.lower(User.email).like(term),
            )
        )
    if status_filter:
        query = query.filter(LegalDocument.status == status_filter)
    if type_filter:
        query = query.filter(LegalDocument.type == type_filter)
    if owner_id:
        query = query.filter(LegalDocument.owner_id == owner_id)
    if counterparty and counterparty.strip():
        query = query.filter(func.lower(LegalDocument.counterparty_name).like(f"%{counterparty.strip().lower()}%"))

    if sort == "expiry":
        query = query.order_by(LegalDocument.expiry_date.is_(None), LegalDocument.expiry_date.asc(), LegalDocument.updated_at.desc())
    else:
        query = query.order_by(LegalDocument.updated_at.desc())

    docs = query.limit(500).all()
    return [_doc_out(d) for d in docs]


@router.post("/documents", response_model=LegalDocumentOut, status_code=status.HTTP_201_CREATED)
def create_legal_document(payload: LegalDocumentCreateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_edit(user)
    doc = LegalDocument(
        title=payload.title.strip(),
        type=payload.type.strip(),
        counterparty_name=(payload.counterparty_name or None),
        counterparty_email=(payload.counterparty_email or None),
        owner_id=user.id,
        status=LegalDocumentStatus.DRAFT.value,
        content=payload.content or "",
        variables=payload.variables or {},
        due_date=payload.due_date,
        expiry_date=payload.expiry_date,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    _create_version(db, doc, actor_id=user.id)
    used_example_ids = []
    if isinstance(doc.variables, dict):
        raw = doc.variables.get("used_example_ids")
        if isinstance(raw, list):
            used_example_ids = [str(x) for x in raw if str(x)]
    _audit(
        db,
        actor_id=user.id,
        action="legal_document_created",
        document_id=doc.id,
        metadata={"type": doc.type, "used_example_ids": used_example_ids},
    )
    if used_example_ids:
        _audit(
            db,
            actor_id=user.id,
            action="document_generated_with_examples",
            document_id=doc.id,
            metadata={"used_example_ids": used_example_ids},
        )
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.get("/documents/{document_id}", response_model=LegalDocumentDetailOut)
def get_legal_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_view(user)
    doc = db.query(LegalDocument).filter(LegalDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    approvals = db.query(LegalApproval).filter(LegalApproval.document_id == doc.id).order_by(LegalApproval.step_number.asc()).all()
    out = LegalDocumentDetailOut(**_doc_out(doc).model_dump(), approvals=[LegalApprovalOut.model_validate(a) for a in approvals])
    return out


@router.patch("/documents/{document_id}", response_model=LegalDocumentOut)
def update_legal_document(document_id: int, payload: LegalDocumentUpdateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _require_doc_edit(user, doc)

    if doc.status not in (LegalDocumentStatus.DRAFT.value, LegalDocumentStatus.CHANGES_REQUESTED.value):
        raise HTTPException(status_code=400, detail="Only drafts or documents with requested changes can be edited")

    changed: dict[str, Any] = {}
    for field in ("title", "counterparty_name", "counterparty_email", "content", "variables", "due_date", "expiry_date"):
        val = getattr(payload, field)
        if val is None:
            continue
        setattr(doc, field, val.strip() if isinstance(val, str) and field in ("title",) else val)
        changed[field] = val

    db.add(doc)
    db.commit()
    db.refresh(doc)

    _create_version(db, doc, actor_id=user.id)
    _audit(db, actor_id=user.id, action="legal_document_updated", document_id=doc.id, metadata={"changed": sorted(changed.keys())})
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.post("/documents/{document_id}/duplicate", response_model=LegalDocumentOut, status_code=status.HTTP_201_CREATED)
def duplicate_legal_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_edit(user)
    src = db.get(LegalDocument, document_id)
    if not src:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = LegalDocument(
        title=f"{src.title} (copy)",
        type=src.type,
        counterparty_name=src.counterparty_name,
        counterparty_email=src.counterparty_email,
        owner_id=user.id,
        status=LegalDocumentStatus.DRAFT.value,
        content=src.content or "",
        variables=src.variables or {},
        due_date=src.due_date,
        expiry_date=src.expiry_date,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    _create_version(db, doc, actor_id=user.id)
    _audit(db, actor_id=user.id, action="legal_document_duplicated", document_id=doc.id, metadata={"source_document_id": src.id})
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.post("/documents/{document_id}/submit-review", response_model=LegalDocumentDetailOut)
def submit_for_review(
    document_id: int,
    payload: LegalSubmitForReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _require_doc_edit(user, doc)

    _ensure_transition(doc.status, LegalDocumentStatus.IN_REVIEW.value)
    if doc.status not in (LegalDocumentStatus.DRAFT.value, LegalDocumentStatus.CHANGES_REQUESTED.value):
        raise HTTPException(status_code=400, detail="Only drafts can be submitted for review")

    approver_ids = [int(x) for x in (payload.approver_ids or []) if x is not None]
    if not approver_ids:
        vars_ = doc.variables or {}
        fallback = vars_.get("_approver_ids")
        if isinstance(fallback, list):
            approver_ids = [int(x) for x in fallback if x is not None]

    db.query(LegalApproval).filter(LegalApproval.document_id == doc.id).delete(synchronize_session=False)
    for idx, aid in enumerate(approver_ids, start=1):
        db.add(LegalApproval(document_id=doc.id, step_number=idx, approver_id=aid, decision=LegalApprovalDecision.PENDING.value))

    doc.status = LegalDocumentStatus.IN_REVIEW.value
    db.add(doc)
    _audit(db, actor_id=user.id, action="legal_document_submitted_for_review", document_id=doc.id, metadata={"approver_ids": approver_ids})
    db.commit()
    db.refresh(doc)

    approvals = db.query(LegalApproval).filter(LegalApproval.document_id == doc.id).order_by(LegalApproval.step_number.asc()).all()
    return LegalDocumentDetailOut(**_doc_out(doc).model_dump(), approvals=[LegalApprovalOut.model_validate(a) for a in approvals])


def _recompute_in_review_status(db: Session, doc: LegalDocument):
    approvals = db.query(LegalApproval).filter(LegalApproval.document_id == doc.id).all()
    if not approvals:
        return
    if any(a.decision in (LegalApprovalDecision.REJECTED.value,) for a in approvals):
        doc.status = LegalDocumentStatus.REJECTED.value
        return
    if any(a.decision in (LegalApprovalDecision.CHANGES_REQUESTED.value,) for a in approvals):
        doc.status = LegalDocumentStatus.CHANGES_REQUESTED.value
        return
    if all(a.decision == LegalApprovalDecision.APPROVED.value for a in approvals):
        doc.status = LegalDocumentStatus.APPROVED.value


@router.post("/documents/{document_id}/approve", response_model=LegalDocumentDetailOut)
def approve_document(
    document_id: int,
    payload: LegalDecisionIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_approve(user)
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != LegalDocumentStatus.IN_REVIEW.value:
        raise HTTPException(status_code=400, detail="Document is not in review")

    approval = (
        db.query(LegalApproval)
        .filter(
            LegalApproval.document_id == doc.id,
            LegalApproval.approver_id == user.id,
        )
        .order_by(LegalApproval.step_number.asc())
        .first()
    )
    if not approval:
        # Admin/approver override: allow approving even if not assigned.
        approval = LegalApproval(
            document_id=doc.id,
            step_number=(db.query(func.max(LegalApproval.step_number)).filter(LegalApproval.document_id == doc.id).scalar() or 0) + 1,
            approver_id=user.id,
            decision=LegalApprovalDecision.PENDING.value,
        )
        db.add(approval)
        db.flush()

    approval.decision = LegalApprovalDecision.APPROVED.value
    approval.comment = payload.comment
    approval.decided_at = utcnow()
    db.add(approval)

    _recompute_in_review_status(db, doc)
    _ensure_transition(LegalDocumentStatus.IN_REVIEW.value, doc.status)
    db.add(doc)
    _audit(db, actor_id=user.id, action="legal_document_approved", document_id=doc.id, metadata={"comment": payload.comment})
    db.commit()
    db.refresh(doc)

    approvals = db.query(LegalApproval).filter(LegalApproval.document_id == doc.id).order_by(LegalApproval.step_number.asc()).all()
    return LegalDocumentDetailOut(**_doc_out(doc).model_dump(), approvals=[LegalApprovalOut.model_validate(a) for a in approvals])


@router.post("/documents/{document_id}/request-changes", response_model=LegalDocumentDetailOut)
def request_changes(
    document_id: int,
    payload: LegalDecisionIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_approve(user)
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != LegalDocumentStatus.IN_REVIEW.value:
        raise HTTPException(status_code=400, detail="Document is not in review")

    approval = (
        db.query(LegalApproval)
        .filter(LegalApproval.document_id == doc.id, LegalApproval.approver_id == user.id)
        .order_by(LegalApproval.step_number.asc())
        .first()
    )
    if not approval:
        approval = LegalApproval(
            document_id=doc.id,
            step_number=(db.query(func.max(LegalApproval.step_number)).filter(LegalApproval.document_id == doc.id).scalar() or 0) + 1,
            approver_id=user.id,
            decision=LegalApprovalDecision.PENDING.value,
        )
        db.add(approval)
        db.flush()

    approval.decision = LegalApprovalDecision.CHANGES_REQUESTED.value
    approval.comment = payload.comment
    approval.decided_at = utcnow()
    db.add(approval)

    doc.status = LegalDocumentStatus.CHANGES_REQUESTED.value
    _ensure_transition(LegalDocumentStatus.IN_REVIEW.value, doc.status)
    db.add(doc)
    _audit(db, actor_id=user.id, action="legal_document_changes_requested", document_id=doc.id, metadata={"comment": payload.comment})
    db.commit()
    db.refresh(doc)

    approvals = db.query(LegalApproval).filter(LegalApproval.document_id == doc.id).order_by(LegalApproval.step_number.asc()).all()
    return LegalDocumentDetailOut(**_doc_out(doc).model_dump(), approvals=[LegalApprovalOut.model_validate(a) for a in approvals])


@router.post("/documents/{document_id}/mark-signed", response_model=LegalDocumentOut)
def mark_signed(document_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_edit(user)
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    _ensure_transition(doc.status, LegalDocumentStatus.SIGNED.value)
    if doc.status != LegalDocumentStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Only approved documents can be marked signed")

    doc.status = LegalDocumentStatus.SIGNED.value
    db.add(doc)
    _audit(db, actor_id=user.id, action="legal_document_marked_signed", document_id=doc.id)
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.post("/documents/{document_id}/archive", response_model=LegalDocumentOut)
def archive_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_edit(user)
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status == LegalDocumentStatus.ARCHIVED.value:
        return _doc_out(doc)
    _ensure_transition(doc.status, LegalDocumentStatus.ARCHIVED.value)
    doc.status = LegalDocumentStatus.ARCHIVED.value
    db.add(doc)
    _audit(db, actor_id=user.id, action="legal_document_archived", document_id=doc.id)
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.get("/documents/{document_id}/audit", response_model=list[LegalAuditLogOut])
def get_document_audit(document_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_view(user)
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    logs = db.query(LegalAuditLog).filter(LegalAuditLog.document_id == document_id).order_by(LegalAuditLog.created_at.desc()).limit(200).all()
    return [LegalAuditLogOut.model_validate(l) for l in logs]


@router.get("/documents/{document_id}/versions", response_model=list[LegalVersionOut])
def get_document_versions(document_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_view(user)
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    versions = db.query(LegalVersion).filter(LegalVersion.document_id == document_id).order_by(LegalVersion.version_number.desc()).limit(200).all()
    return [LegalVersionOut.model_validate(v) for v in versions]


@router.get("/documents/{document_id}/export")
def export_document(
    document_id: int,
    format: str = Query(default="txt", pattern="^(txt|pdf|docx)$"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_view(user)
    doc = db.get(LegalDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filename = f"{doc.title or 'legal-document'}"
    safe = re.sub(r"[^a-zA-Z0-9\\-_. ]+", "", filename).strip().replace(" ", "_") or "legal-document"
    ext = format
    content = (doc.content or "").encode("utf-8")

    if format == "pdf":
        media = "application/pdf"
    elif format == "docx":
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        media = "text/plain; charset=utf-8"

    _audit(db, actor_id=user.id, action="legal_document_exported", document_id=doc.id, metadata={"format": format})
    db.commit()
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{safe}.{ext}"'},
    )


@router.get("/templates", response_model=list[LegalTemplateOut])
def list_templates(db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_view(user)
    templates = db.query(LegalTemplate).order_by(LegalTemplate.updated_at.desc()).limit(500).all()
    return [_template_out(t) for t in templates]


@router.post("/templates", response_model=LegalTemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(payload: LegalTemplateCreateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_template_admin(user)
    if not payload.name.strip() or not payload.type.strip() or not payload.body.strip():
        raise HTTPException(status_code=400, detail="name, type, and body are required")

    approver_ids = [int(x) for x in (payload.default_approvers or []) if x is not None]
    if approver_ids:
        existing = {u.id for u in db.query(User.id).filter(User.id.in_(approver_ids)).all()}
        missing = [i for i in approver_ids if i not in existing]
        if missing:
            raise HTTPException(status_code=400, detail=f"Unknown approver IDs: {missing}")

    tmpl = LegalTemplate(
        name=payload.name.strip(),
        type=payload.type.strip(),
        body=payload.body or "",
        variables=[str(v).strip() for v in (payload.variables or []) if str(v).strip()],
        default_approvers=approver_ids,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    _audit(db, actor_id=user.id, action="legal_template_created", metadata={"template_id": tmpl.id, "name": tmpl.name})
    db.commit()
    return _template_out(tmpl)


@router.get("/templates/{template_id}", response_model=LegalTemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_view(user)
    tmpl = db.get(LegalTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_out(tmpl)


@router.patch("/templates/{template_id}", response_model=LegalTemplateOut)
def update_template(template_id: int, payload: LegalTemplateUpdateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_template_admin(user)
    tmpl = db.get(LegalTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    changed: list[str] = []
    for field in ("name", "type", "body", "variables", "default_approvers"):
        val = getattr(payload, field)
        if val is None:
            continue
        if field in ("name", "type", "body"):
            if not isinstance(val, str) or not val.strip():
                raise HTTPException(status_code=400, detail=f"{field} is required")
            setattr(tmpl, field, val.strip())
            changed.append(field)
        elif field == "variables":
            vars_ = [str(v).strip() for v in (val or []) if str(v).strip()]
            tmpl.variables = vars_
            changed.append(field)
        elif field == "default_approvers":
            ids = [int(x) for x in (val or []) if x is not None]
            if ids:
                existing = {u.id for u in db.query(User.id).filter(User.id.in_(ids)).all()}
                missing = [i for i in ids if i not in existing]
                if missing:
                    raise HTTPException(status_code=400, detail=f"Unknown approver IDs: {missing}")
            tmpl.default_approvers = ids
            changed.append(field)

    db.add(tmpl)
    _audit(db, actor_id=user.id, action="legal_template_updated", metadata={"template_id": tmpl.id, "changed": sorted(changed)})
    db.commit()
    db.refresh(tmpl)
    return _template_out(tmpl)


@router.put("/templates/{template_id}", response_model=LegalTemplateOut)
def put_template(template_id: int, payload: LegalTemplateUpdateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return update_template(template_id=template_id, payload=payload, db=db, user=user)


@router.get("/users", response_model=list[LegalUserOut])
def list_legal_users(db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_template_admin(user)
    users = db.query(User).order_by(User.full_name.asc(), User.email.asc()).all()
    return [LegalUserOut(id=u.id, email=u.email, full_name=u.full_name, role=u.role) for u in users]


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_template_admin(user)
    tmpl = db.get(LegalTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(tmpl)
    _audit(db, actor_id=user.id, action="legal_template_deleted", metadata={"template_id": template_id})
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/templates/{template_id}/generate", response_model=LegalTemplateGenerateWithExamplesOut)
def generate_from_template(
    template_id: int,
    payload: LegalTemplateGenerateWithExamplesIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_view(user)
    tmpl = db.get(LegalTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    vars_in = payload.variables or {}
    rendered = _render_placeholders(tmpl.body or "", vars_in)

    selected_ids = [str(x) for x in (payload.selected_example_ids or []) if str(x)]

    # Safety: limit to READY examples; enforce scope rules.
    examples_query = db.query(LegalExample).filter(LegalExample.status == LegalExampleStatus.READY.value)
    if selected_ids:
        examples_query = examples_query.filter(LegalExample.id.in_(selected_ids))
    else:
        examples_query = examples_query.filter(LegalExample.template_id == tmpl.id)

    counterparty = (payload.counterparty_name or "").strip().lower()
    examples: list[LegalExample] = []
    for ex in examples_query.order_by(LegalExample.updated_at.desc()).all():
        scope = ex.scope or LegalExampleScope.GLOBAL.value
        if scope == LegalExampleScope.CLIENT.value:
            if not counterparty:
                continue
            if not ex.client_name or ex.client_name.strip().lower() != counterparty:
                continue
        examples.append(ex)

    query_text = " ".join(
        [
            (payload.title or "").strip(),
            (tmpl.body or "")[:2000],
            " ".join([f"{k}:{v}" for k, v in (vars_in or {}).items()])[:2000],
        ]
    ).lower()

    used_snippets: list[str] = []
    used_ids: list[str] = []

    def chunks(text: str) -> list[str]:
        parts = [p.strip() for p in re.split(r"\n{2,}", text or "") if p.strip()]
        out: list[str] = []
        buf = ""
        for p in parts:
            if len(buf) + len(p) + 2 <= 1200:
                buf = (buf + "\n\n" + p).strip()
            else:
                if buf:
                    out.append(buf)
                buf = p
        if buf:
            out.append(buf)
        return out[:80]

    tokens = [t for t in re.split(r"[^a-z0-9_]+", query_text) if len(t) >= 3]
    token_set = set(tokens[:200])

    scored: list[tuple[float, str, str]] = []
    for ex in examples:
        text = ex.extracted_text or ""
        for c in chunks(text):
            low = c.lower()
            score = 0
            for tok in token_set:
                if tok in low:
                    score += 1
            if score:
                scored.append((float(score), ex.id, c))

    scored.sort(key=lambda x: (-x[0], x[1]))
    for _, ex_id, snippet in scored[:8]:
        used_snippets.append(snippet)
        if ex_id not in used_ids:
            used_ids.append(ex_id)

    if used_snippets:
        rendered = (
            rendered
            + "\n\n"
            + "REFERENCE EXAMPLES (snippets)\n"
            + "\n\n".join([f"[Example {i+1}] {s}" for i, s in enumerate(used_snippets)])
        )

    _audit(
        db,
        actor_id=user.id,
        action="legal_template_generated",
        metadata={"template_id": tmpl.id, "used_example_ids": used_ids},
    )
    db.commit()
    return LegalTemplateGenerateWithExamplesOut(content=rendered, variables=vars_in, used_example_ids=used_ids, used_snippets=used_snippets)


@router.post("/examples", response_model=list[LegalExampleOut], status_code=status.HTTP_201_CREATED)
async def upload_examples(
    files: list[UploadFile] = File(...),
    title: Optional[str] = Form(default=None),
    document_type: str = Form(...),
    template_id: Optional[int] = Form(default=None),
    scope: LegalExampleScope = Form(default=LegalExampleScope.GLOBAL),
    client_name: Optional[str] = Form(default=None),
    tags: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_edit(user)
    if not document_type.strip():
        raise HTTPException(status_code=400, detail="document_type is required")

    max_bytes = 25 * 1024 * 1024
    allowed_ext = {".pdf", ".docx", ".txt", ".md"}
    created: list[LegalExampleOut] = []
    tags_list = [t.strip() for t in (tags or "").split(",") if t.strip()]

    for f in files:
        original = _sanitize_filename(f.filename or "example")
        lower = original.lower()
        ext = "." + lower.split(".")[-1] if "." in lower else ""
        if ext not in allowed_ext:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {original}")

        data = await f.read()
        if not data:
            raise HTTPException(status_code=400, detail=f"Empty file: {original}")
        if len(data) > max_bytes:
            raise HTTPException(status_code=400, detail=f"File too large: {original}")

        ex = LegalExample(
            title=(title.strip() if title and title.strip() else original),
            document_type=document_type.strip(),
            template_id=template_id,
            scope=scope.value if isinstance(scope, LegalExampleScope) else str(scope),
            client_name=(client_name.strip() if client_name and client_name.strip() else None),
            file_name=original,
            mime_type=f.content_type or "application/octet-stream",
            file_size=len(data),
            storage_path="",
            uploaded_by=user.id,
            status=LegalExampleStatus.UPLOADED.value,
            tags=tags_list,
        )
        db.add(ex)
        db.commit()
        db.refresh(ex)

        if settings.storage_provider == "supabase":
            try:
                object_path = build_legal_example_object_path(ex.id, original)
                upload_bytes(object_path=object_path, data=data, content_type=ex.mime_type)
                ex.storage_path = object_path
            except SupabaseStorageError as e:
                raise HTTPException(status_code=500, detail=str(e))
        else:
            os.makedirs(_example_dir(ex.id), exist_ok=True)
            stored = os.path.join(_example_dir(ex.id), original)
            with open(stored, "wb") as fp:
                fp.write(data)
            ex.storage_path = stored

        ex.status = LegalExampleStatus.EXTRACTING.value
        db.add(ex)
        _audit(db, actor_id=user.id, action="example_uploaded", metadata={"example_id": ex.id, "file_name": original})
        db.commit()
        db.refresh(ex)

        try:
            text = extract_text_from_bytes(data, original)
            if not text.strip():
                ex.status = LegalExampleStatus.FAILED.value
                ex.error_message = "NO_TEXT_FOUND"
            else:
                ex.extracted_text = text
                ex.status = LegalExampleStatus.READY.value
                ex.error_message = None
            db.add(ex)
            _audit(
                db,
                actor_id=user.id,
                action="example_extracted",
                metadata={"example_id": ex.id, "status": ex.status},
            )
            db.commit()
        except Exception as e:
            ex.status = LegalExampleStatus.FAILED.value
            ex.error_message = str(e)[:1000]
            db.add(ex)
            _audit(
                db,
                actor_id=user.id,
                action="example_extracted",
                metadata={"example_id": ex.id, "status": ex.status, "error": ex.error_message},
            )
            db.commit()

        db.refresh(ex)
        created.append(_example_out(ex))

    return created


@router.get("/examples", response_model=LegalExamplesListOut)
def list_examples(
    q: Optional[str] = None,
    document_type: Optional[str] = None,
    template_id: Optional[int] = None,
    status: Optional[str] = None,
    scope: Optional[str] = None,
    counterparty_name: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_view(user)
    limit = max(1, min(200, int(limit)))
    offset = max(0, int(offset))

    query = db.query(LegalExample).join(User, User.id == LegalExample.uploaded_by)

    if document_type:
        query = query.filter(LegalExample.document_type == document_type)
    if template_id is not None:
        query = query.filter(LegalExample.template_id == template_id)
    if status:
        query = query.filter(LegalExample.status == status)
    if scope:
        query = query.filter(LegalExample.scope == scope)

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(LegalExample.title).like(term),
                func.lower(LegalExample.file_name).like(term),
                func.lower(LegalExample.extracted_text).like(term),
            )
        )

    counterparty = (counterparty_name or "").strip().lower()
    if counterparty:
        query = query.filter(
            or_(
                LegalExample.scope != LegalExampleScope.CLIENT.value,
                and_(LegalExample.scope == LegalExampleScope.CLIENT.value, func.lower(LegalExample.client_name) == counterparty),
            )
        )
    else:
        query = query.filter(LegalExample.scope != LegalExampleScope.CLIENT.value)

    total = query.count()
    items = query.order_by(LegalExample.updated_at.desc()).offset(offset).limit(limit).all()
    return LegalExamplesListOut(items=[_example_out(e) for e in items], total=total)


@router.get("/examples/{example_id}", response_model=LegalExampleOut)
def get_example(
    example_id: str,
    counterparty_name: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_view(user)
    ex = db.get(LegalExample, example_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Example not found")
    if ex.scope == LegalExampleScope.CLIENT.value:
        cp = (counterparty_name or "").strip().lower()
        if not cp or not ex.client_name or ex.client_name.strip().lower() != cp:
            raise HTTPException(status_code=403, detail="Not enough permissions")
    return _example_out(ex)


@router.get("/examples/{example_id}/download")
def download_example(
    example_id: str,
    counterparty_name: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_legal_view(user)
    ex = db.get(LegalExample, example_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Example not found")
    if ex.scope == LegalExampleScope.CLIENT.value:
        cp = (counterparty_name or "").strip().lower()
        if not cp or not ex.client_name or ex.client_name.strip().lower() != cp:
            raise HTTPException(status_code=403, detail="Not enough permissions")
    path = ex.storage_path
    _audit(db, actor_id=user.id, action="example_downloaded", metadata={"example_id": ex.id})
    db.commit()

    if settings.storage_provider == "supabase":
        try:
            signed = create_signed_download_url(object_path=path, expires_in=60)  # type: ignore[arg-type]
        except SupabaseStorageError as e:
            raise HTTPException(status_code=500, detail=str(e))
        return RedirectResponse(url=signed, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type=ex.mime_type, filename=ex.file_name)


@router.patch("/examples/{example_id}", response_model=LegalExampleOut)
def update_example(example_id: str, payload: LegalExampleUpdateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_edit(user)
    ex = db.get(LegalExample, example_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Example not found")

    changed: list[str] = []
    if payload.title is not None:
        ex.title = payload.title.strip() if payload.title.strip() else ex.title
        changed.append("title")
    if payload.document_type is not None:
        ex.document_type = payload.document_type.strip() if payload.document_type.strip() else ex.document_type
        changed.append("document_type")
    if payload.template_id is not None:
        ex.template_id = payload.template_id
        changed.append("template_id")
    if payload.scope is not None:
        ex.scope = payload.scope.value
        changed.append("scope")
    if payload.client_name is not None:
        ex.client_name = payload.client_name.strip() if payload.client_name.strip() else None
        changed.append("client_name")
    if payload.tags is not None:
        ex.tags = [str(t).strip() for t in payload.tags if str(t).strip()]
        changed.append("tags")

    db.add(ex)
    _audit(db, actor_id=user.id, action="example_updated", metadata={"example_id": ex.id, "changed": changed})
    db.commit()
    db.refresh(ex)
    return _example_out(ex)


@router.delete("/examples/{example_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_example(example_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_delete(user)
    ex = db.get(LegalExample, example_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Example not found")
    path = ex.storage_path
    db.delete(ex)
    _audit(db, actor_id=user.id, action="example_deleted", metadata={"example_id": example_id})
    db.commit()
    if settings.storage_provider == "supabase":
        if path:
            try:
                delete_object(object_path=path)
            except SupabaseStorageError:
                pass
    else:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/examples/{example_id}/retry", response_model=LegalExampleRetryOut)
def retry_extraction(example_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_edit(user)
    ex = db.get(LegalExample, example_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Example not found")
    if not ex.storage_path:
        raise HTTPException(status_code=404, detail="File not found")

    ex.status = LegalExampleStatus.EXTRACTING.value
    ex.error_message = None
    db.add(ex)
    db.commit()
    if settings.storage_provider == "supabase":
        try:
            data = download_bytes(object_path=ex.storage_path)
        except SupabaseStorageError as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        if not os.path.exists(ex.storage_path):
            raise HTTPException(status_code=404, detail="File not found")
        with open(ex.storage_path, "rb") as fp:
            data = fp.read()
    try:
        text = extract_text_from_bytes(data, ex.file_name)
        if not text.strip():
            ex.status = LegalExampleStatus.FAILED.value
            ex.error_message = "NO_TEXT_FOUND"
        else:
            ex.extracted_text = text
            ex.status = LegalExampleStatus.READY.value
            ex.error_message = None
    except Exception as e:
        ex.status = LegalExampleStatus.FAILED.value
        ex.error_message = str(e)[:1000]
    db.add(ex)
    _audit(db, actor_id=user.id, action="example_extracted", metadata={"example_id": ex.id, "status": ex.status})
    db.commit()
    return LegalExampleRetryOut(id=ex.id, status=LegalExampleStatus(ex.status))


@router.get("/templates/{template_id}/examples", response_model=list[LegalExampleOut])
def list_template_examples(template_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_legal_view(user)
    tmpl = db.get(LegalTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    examples = (
        db.query(LegalExample)
        .join(User, User.id == LegalExample.uploaded_by)
        .filter(LegalExample.template_id == template_id)
        .order_by(LegalExample.updated_at.desc())
        .limit(200)
        .all()
    )
    return [_example_out(e) for e in examples]


def _template_out(t: LegalTemplate) -> LegalTemplateOut:
    return LegalTemplateOut(
        id=t.id,
        name=t.name,
        type=t.type,
        body=t.body or "",
        variables=(t.variables or []) if isinstance(t.variables, list) else [],
        default_approvers=(t.default_approvers or []) if isinstance(t.default_approvers, list) else [],
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def _example_dir(example_id: str) -> str:
    return os.path.join(settings.data_dir, "legal_examples", example_id)


def _sanitize_filename(name: str) -> str:
    base = os.path.basename(name or "example")
    base = re.sub(r"[^a-zA-Z0-9\\-_. ]+", "", base).strip()
    if not base:
        base = "example"
    return base


def _example_out(e: LegalExample) -> LegalExampleOut:
    tags = e.tags or []
    if isinstance(tags, str):
        tags = [tags]
    if not isinstance(tags, list):
        tags = []
    tags = [str(t).strip() for t in tags if str(t).strip()]

    uploader = e.uploader
    return LegalExampleOut(
        id=e.id,
        title=e.title,
        document_type=e.document_type,
        template_id=e.template_id,
        scope=LegalExampleScope(e.scope),
        client_name=e.client_name,
        file_name=e.file_name,
        mime_type=e.mime_type,
        file_size=e.file_size,
        uploaded_by=e.uploaded_by,
        uploaded_by_name=uploader.full_name if uploader else None,
        uploaded_by_email=uploader.email if uploader else None,
        uploaded_at=e.uploaded_at,
        updated_at=e.updated_at,
        status=LegalExampleStatus(e.status),
        error_message=e.error_message,
        tags=tags,
    )
