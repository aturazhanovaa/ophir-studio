from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import LegalExampleScope, LegalExampleStatus


class LegalExampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    document_type: str
    template_id: Optional[int] = None
    scope: LegalExampleScope
    client_name: Optional[str] = None
    file_name: str
    mime_type: str
    file_size: int
    uploaded_by: int
    uploaded_by_name: Optional[str] = None
    uploaded_by_email: Optional[str] = None
    uploaded_at: datetime
    updated_at: datetime
    status: LegalExampleStatus
    error_message: Optional[str] = None
    tags: list[str] = []


class LegalExampleUpdateIn(BaseModel):
    title: Optional[str] = None
    document_type: Optional[str] = None
    template_id: Optional[int] = None
    scope: Optional[LegalExampleScope] = None
    client_name: Optional[str] = None
    tags: Optional[list[str]] = None


class LegalExamplesListOut(BaseModel):
    items: list[LegalExampleOut]
    total: int


class LegalExampleRetryOut(BaseModel):
    id: str
    status: LegalExampleStatus


class LegalTemplateGenerateWithExamplesIn(BaseModel):
    variables: dict[str, Any]
    selected_example_ids: list[str] = Field(default_factory=list)
    title: Optional[str] = None
    counterparty_name: Optional[str] = None


class LegalTemplateGenerateWithExamplesOut(BaseModel):
    content: str
    variables: dict[str, Any]
    used_example_ids: list[str] = Field(default_factory=list)
    used_snippets: list[str] = Field(default_factory=list)
