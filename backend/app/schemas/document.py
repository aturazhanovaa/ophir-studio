import json
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator


class DocumentVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version: int
    original_name: str
    mime_type: str
    created_at: datetime


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    area_id: int
    title: str
    original_name: str
    mime_type: str
    tags: List[str]
    latest_version: int
    deleted_at: Optional[datetime]
    created_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, list):
            return v
        try:
            return json.loads(v) if v else []
        except Exception:
            return []


class DocumentDetailOut(DocumentOut):
    versions: List[DocumentVersionOut]
