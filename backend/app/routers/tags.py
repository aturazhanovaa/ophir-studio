from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import Tag, TagCategory, TagSuggestion, TagSuggestionStatus, User
from app.db.session import get_db
from app.schemas.tags import (
    TagCategoryOut,
    TagCreateIn,
    TagOut,
    TagSuggestionIn,
    TagSuggestionOut,
    TagUpdateIn,
)

router = APIRouter(prefix="/tags", tags=["tags"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(user: User):
    if not user.is_admin_role:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/categories", response_model=List[TagCategoryOut])
def list_categories(_: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(TagCategory).order_by(TagCategory.name.asc()).all()


@router.get("", response_model=List[TagOut])
def list_tags(
    category_id: Optional[int] = Query(None),
    category_key: Optional[str] = Query(None),
    include_deprecated: bool = Query(True),
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Tag).join(TagCategory)
    if category_id:
        query = query.filter(Tag.category_id == category_id)
    if category_key:
        query = query.filter(TagCategory.key == category_key)
    if not include_deprecated:
        query = query.filter(Tag.deprecated.is_(False))
    return query.order_by(TagCategory.name.asc(), Tag.label.asc()).all()


@router.post("", response_model=TagOut)
def create_tag(
    payload: TagCreateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_admin(user)
    category = db.get(TagCategory, payload.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    existing = (
        db.query(Tag)
        .filter(Tag.category_id == payload.category_id)
        .filter(Tag.key == payload.key)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Tag key already exists in this category")
    tag = Tag(category_id=payload.category_id, key=payload.key.strip(), label=payload.label.strip())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(
    tag_id: int,
    payload: TagUpdateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_admin(user)
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if payload.key is not None:
        tag.key = payload.key.strip() or tag.key
    if payload.label is not None:
        tag.label = payload.label.strip() or tag.label
    if payload.deprecated is not None:
        tag.deprecated = payload.deprecated
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.post("/suggestions", response_model=TagSuggestionOut)
def create_suggestion(
    payload: TagSuggestionIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    category = None
    if payload.category_id:
        category = db.get(TagCategory, payload.category_id)
    elif payload.category_key:
        category = db.query(TagCategory).filter(TagCategory.key == payload.category_key).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    suggestion = TagSuggestion(
        category_id=category.id,
        label=payload.label.strip(),
        note=payload.note,
        status=TagSuggestionStatus.PENDING.value,
        requested_by_user_id=user.id,
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return suggestion


@router.get("/suggestions", response_model=List[TagSuggestionOut])
def list_suggestions(
    status_filter: Optional[str] = Query(None, alias="status"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_admin(user)
    query = db.query(TagSuggestion)
    if status_filter:
        query = query.filter(TagSuggestion.status == status_filter)
    return query.order_by(TagSuggestion.created_at.desc()).all()
