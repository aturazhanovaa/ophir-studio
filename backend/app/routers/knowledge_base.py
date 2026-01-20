from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import case, func, distinct, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import decode_token
from app.db.models import (
    ContentItem,
    ContentItemTag,
    ContentStatus,
    KnowledgeBaseArea,
    KnowledgeBaseCollection,
    Tag,
    User,
    utcnow,
)
from app.db.session import get_db
from app.schemas.knowledge_base import (
    ContentItemIn,
    ContentItemOut,
    ContentItemUpdate,
    KnowledgeBaseAreaIn,
    KnowledgeBaseAreaOut,
    KnowledgeBaseCollectionIn,
    KnowledgeBaseCollectionOut,
    TagRefOut,
)
from app.utils.tag_validation import TagValidationError, validate_content_item_tags

router = APIRouter(prefix="/kb", tags=["knowledge-base"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def _parse_tag_ids(raw: Optional[str]) -> List[int]:
    if not raw:
        return []
    ids = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except ValueError:
            continue
    return ids


def _tag_refs(tags: List[Tag]) -> List[TagRefOut]:
    out = []
    for tag in tags:
        category = tag.category
        out.append(
            TagRefOut(
                id=tag.id,
                key=tag.key,
                label=tag.label,
                category_key=category.key if category else "",
                category_name=category.name if category else "",
            )
        )
    return out


def _content_item_payload(item: ContentItem, tags: List[TagRefOut]) -> ContentItemOut:
    data = {col.name: getattr(item, col.name) for col in ContentItem.__table__.columns}
    return ContentItemOut(**data, tags=tags)


def _load_tags(db: Session, tag_ids: List[int]) -> List[Tag]:
    if not tag_ids:
        return []
    tags = (
        db.query(Tag)
        .options(selectinload(Tag.category))
        .filter(Tag.id.in_(tag_ids))
        .all()
    )
    if len(tags) != len(tag_ids):
        raise HTTPException(status_code=400, detail="One or more tags are invalid.")
    try:
        validate_content_item_tags(tags)
    except TagValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return tags


def _set_content_item_tags(db: Session, item: ContentItem, tag_ids: List[int]):
    item.tags = []
    if not tag_ids:
        return
    tags = _load_tags(db, tag_ids)
    for tag in tags:
        item.tags.append(ContentItemTag(tag_id=tag.id))


@router.get("/areas", response_model=List[KnowledgeBaseAreaOut])
def list_kb_areas(_: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(KnowledgeBaseArea).order_by(KnowledgeBaseArea.order_index.asc()).all()


@router.post("/areas", response_model=KnowledgeBaseAreaOut)
def create_kb_area(payload: KnowledgeBaseAreaIn, _: User = Depends(current_user), db: Session = Depends(get_db)):
    existing = db.query(KnowledgeBaseArea).filter(KnowledgeBaseArea.key == payload.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Area key already exists")
    area = KnowledgeBaseArea(
        key=payload.key.strip(),
        name=payload.name.strip(),
        description=payload.description,
        order_index=payload.order_index,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.patch("/areas/{area_id}", response_model=KnowledgeBaseAreaOut)
def update_kb_area(
    area_id: int,
    payload: KnowledgeBaseAreaIn,
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    area = db.get(KnowledgeBaseArea, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    area.key = payload.key.strip()
    area.name = payload.name.strip()
    area.description = payload.description
    area.order_index = payload.order_index
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.get("/collections", response_model=List[KnowledgeBaseCollectionOut])
def list_collections(
    area_id: Optional[int] = Query(None),
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = db.query(KnowledgeBaseCollection)
    if area_id:
        query = query.filter(KnowledgeBaseCollection.area_id == area_id)
    return query.order_by(KnowledgeBaseCollection.order_index.asc()).all()


@router.post("/collections", response_model=KnowledgeBaseCollectionOut)
def create_collection(
    payload: KnowledgeBaseCollectionIn,
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    area = db.get(KnowledgeBaseArea, payload.area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    collection = KnowledgeBaseCollection(
        area_id=payload.area_id,
        name=payload.name.strip(),
        description=payload.description,
        order_index=payload.order_index,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


@router.patch("/collections/{collection_id}", response_model=KnowledgeBaseCollectionOut)
def update_collection(
    collection_id: int,
    payload: KnowledgeBaseCollectionIn,
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    collection = db.get(KnowledgeBaseCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    collection.area_id = payload.area_id
    collection.name = payload.name.strip()
    collection.description = payload.description
    collection.order_index = payload.order_index
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


@router.get("/content", response_model=List[ContentItemOut])
def list_content_items(
    q: Optional[str] = Query(None),
    area_id: Optional[int] = Query(None),
    collection_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    language: Optional[str] = Query(None),
    updated_since: Optional[str] = Query(None),
    tag_ids: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ContentItem).options(
        selectinload(ContentItem.tags).selectinload(ContentItemTag.tag).selectinload(Tag.category)
    )

    if area_id:
        query = query.filter(ContentItem.area_id == area_id)
    if collection_id:
        query = query.filter(ContentItem.collection_id == collection_id)
    if language:
        query = query.filter(ContentItem.language == language)
    if status_filter:
        query = query.filter(ContentItem.status == status_filter)
    elif not include_archived:
        query = query.filter(ContentItem.status != ContentStatus.ARCHIVED.value)

    if updated_since:
        try:
            since_dt = datetime.fromisoformat(updated_since)
            query = query.filter(ContentItem.updated_at >= since_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="updated_since must be ISO format")

    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            func.lower(ContentItem.title).like(like)
            | func.lower(ContentItem.summary).like(like)
            | func.lower(ContentItem.body).like(like)
        )

    tag_id_list = _parse_tag_ids(tag_ids)
    if tag_id_list:
        subq = (
            select(ContentItemTag.content_item_id)
            .where(ContentItemTag.tag_id.in_(tag_id_list))
            .group_by(ContentItemTag.content_item_id)
            .having(func.count(distinct(ContentItemTag.tag_id)) >= len(set(tag_id_list)))
        )
        query = query.filter(ContentItem.id.in_(subq))

    status_order = case(
        (ContentItem.status == ContentStatus.APPROVED.value, 0),
        (ContentItem.status == ContentStatus.DRAFT.value, 1),
        else_=2,
    )
    query = query.order_by(status_order.asc(), ContentItem.updated_at.desc())

    items = query.all()
    results: List[ContentItemOut] = []
    for item in items:
        tags = [link.tag for link in item.tags if link.tag]
        results.append(_content_item_payload(item, _tag_refs(tags)))
    return results


@router.get("/content/{item_id}", response_model=ContentItemOut)
def get_content_item(item_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    item = (
        db.query(ContentItem)
        .options(selectinload(ContentItem.tags).selectinload(ContentItemTag.tag).selectinload(Tag.category))
        .filter(ContentItem.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    tags = [link.tag for link in item.tags if link.tag]
    return _content_item_payload(item, _tag_refs(tags))


@router.post("/content", response_model=ContentItemOut)
def create_content_item(
    payload: ContentItemIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    area = db.get(KnowledgeBaseArea, payload.area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    if payload.collection_id:
        collection = db.get(KnowledgeBaseCollection, payload.collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")

    item = ContentItem(
        area_id=payload.area_id,
        collection_id=payload.collection_id,
        title=payload.title.strip(),
        body=payload.body.strip(),
        summary=payload.summary,
        status=payload.status.value,
        language=payload.language,
        owner_user_id=payload.owner_user_id or user.id,
        owner_name=payload.owner_name or user.full_name,
        metrics=payload.metrics,
    )
    _set_content_item_tags(db, item, payload.tag_ids)
    db.add(item)
    db.commit()
    db.refresh(item)
    tags = [link.tag for link in item.tags if link.tag]
    return _content_item_payload(item, _tag_refs(tags))


@router.patch("/content/{item_id}", response_model=ContentItemOut)
def update_content_item(
    item_id: int,
    payload: ContentItemUpdate,
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    item = db.get(ContentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")

    if payload.area_id is not None:
        area = db.get(KnowledgeBaseArea, payload.area_id)
        if not area:
            raise HTTPException(status_code=404, detail="Area not found")
        item.area_id = payload.area_id
    if payload.collection_id is not None:
        if payload.collection_id:
            collection = db.get(KnowledgeBaseCollection, payload.collection_id)
            if not collection:
                raise HTTPException(status_code=404, detail="Collection not found")
        item.collection_id = payload.collection_id
    if payload.title is not None:
        item.title = payload.title.strip() or item.title
    if payload.body is not None:
        item.body = payload.body.strip() or item.body
    if payload.summary is not None:
        item.summary = payload.summary
    if payload.status is not None:
        item.status = payload.status.value
        if payload.status == ContentStatus.ARCHIVED:
            item.archived_at = utcnow()
    if payload.language is not None:
        item.language = payload.language
    if payload.owner_user_id is not None:
        item.owner_user_id = payload.owner_user_id
    if payload.owner_name is not None:
        item.owner_name = payload.owner_name
    if payload.metrics is not None:
        item.metrics = payload.metrics
    if payload.tag_ids is not None:
        _set_content_item_tags(db, item, payload.tag_ids)

    db.add(item)
    db.commit()
    db.refresh(item)
    tags = [link.tag for link in item.tags if link.tag]
    return _content_item_payload(item, _tag_refs(tags))


@router.delete("/content/{item_id}")
def archive_content_item(item_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    item = db.get(ContentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    item.status = ContentStatus.ARCHIVED.value
    item.archived_at = utcnow()
    db.add(item)
    db.commit()
    return {"status": "archived", "id": item.id}
