from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import ContentStatus


class KnowledgeBaseAreaIn(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    order_index: int = 0


class KnowledgeBaseAreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    description: Optional[str] = None
    order_index: int
    created_at: datetime
    updated_at: datetime


class KnowledgeBaseCollectionIn(BaseModel):
    area_id: int
    name: str
    description: Optional[str] = None
    order_index: int = 0


class KnowledgeBaseCollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    area_id: int
    name: str
    description: Optional[str] = None
    order_index: int
    created_at: datetime
    updated_at: datetime


class TagRefOut(BaseModel):
    id: int
    key: str
    label: str
    category_key: str
    category_name: str


class ContentItemIn(BaseModel):
    area_id: int
    collection_id: Optional[int] = None
    title: str
    body: str
    summary: Optional[str] = None
    status: ContentStatus = ContentStatus.DRAFT
    language: str = Field(default="en", min_length=2)
    owner_user_id: Optional[int] = None
    owner_name: Optional[str] = None
    metrics: Optional[str] = None
    tag_ids: List[int] = Field(default_factory=list)


class ContentItemUpdate(BaseModel):
    area_id: Optional[int] = None
    collection_id: Optional[int] = None
    title: Optional[str] = None
    body: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[ContentStatus] = None
    language: Optional[str] = None
    owner_user_id: Optional[int] = None
    owner_name: Optional[str] = None
    metrics: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class ContentItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    area_id: int
    collection_id: Optional[int]
    title: str
    body: str
    summary: Optional[str]
    status: ContentStatus
    language: str
    owner_user_id: Optional[int]
    owner_name: Optional[str]
    metrics: Optional[str]
    archived_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    tags: List[TagRefOut] = Field(default_factory=list)
