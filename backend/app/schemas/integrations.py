from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class NotionMessagingBlockUpsertIn(BaseModel):
    id: Optional[str] = None
    page_id: Optional[str] = None
    last_edited_time: Optional[datetime] = None
    properties: Optional[Dict[str, Any]] = None
    title: Optional[str] = None
    content: Optional[str] = None
    sector: Optional[List[str]] = None
    use_case: Optional[List[str]] = None
    audience: Optional[List[str]] = None
    funnel_stage: Optional[str] = None
    geography: Optional[List[str]] = None
    language: Optional[str] = None
    status: Optional[str] = None
    block_id: Optional[str] = None
    notion_page_id: Optional[str] = None
    notion_last_edited_time: Optional[datetime] = None


class NotionUpsertOut(BaseModel):
    status: str
    messaging_block_id: int
