from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.db.models import TagSuggestionStatus


class TagCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    key: str
    label: str
    deprecated: bool
    created_at: datetime
    updated_at: datetime
    category: Optional[TagCategoryOut] = None


class TagCreateIn(BaseModel):
    category_id: int
    key: str
    label: str


class TagUpdateIn(BaseModel):
    key: Optional[str] = None
    label: Optional[str] = None
    deprecated: Optional[bool] = None


class TagSuggestionIn(BaseModel):
    category_id: Optional[int] = None
    category_key: Optional[str] = None
    label: str
    note: Optional[str] = None


class TagSuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    label: str
    note: Optional[str] = None
    status: TagSuggestionStatus
    created_at: datetime
