from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    area_id: Optional[int] = None
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None


class ConversationMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="meta", serialization_alias="metadata")


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: Optional[str] = None
    area_id: Optional[int] = None
    workspace_id: Optional[int] = 1
    created_by_user_id: int
    created_at: datetime
    updated_at: datetime
    last_message_preview: Optional[str] = None


class ConversationDetailOut(ConversationOut):
    messages: List[ConversationMessageOut]
