from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import LegalApprovalDecision, LegalDocumentStatus


class LegalAuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    document_id: Optional[int] = None
    actor_id: Optional[int] = None
    action: str
    metadata: Optional[dict[str, Any]] = Field(default=None, validation_alias="meta", serialization_alias="metadata")
    created_at: datetime


class LegalVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    version_number: int
    content: str
    variables: Optional[dict[str, Any]] = None
    created_by: Optional[int] = None
    created_at: datetime


class LegalApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    step_number: int
    approver_id: int
    decision: LegalApprovalDecision
    comment: Optional[str] = None
    decided_at: Optional[datetime] = None


class LegalDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    type: str
    counterparty_name: Optional[str] = None
    counterparty_email: Optional[str] = None
    owner_id: int
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    status: LegalDocumentStatus
    content: str
    variables: Optional[dict[str, Any]] = None
    due_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class LegalDocumentDetailOut(LegalDocumentOut):
    approvals: list[LegalApprovalOut] = []


class LegalDocumentCreateIn(BaseModel):
    title: str = Field(min_length=1)
    type: str = Field(min_length=1)
    counterparty_name: Optional[str] = None
    counterparty_email: Optional[str] = None
    content: str = ""
    variables: Optional[dict[str, Any]] = None
    due_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class LegalDocumentUpdateIn(BaseModel):
    title: Optional[str] = None
    counterparty_name: Optional[str] = None
    counterparty_email: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[dict[str, Any]] = None
    due_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class LegalSubmitForReviewIn(BaseModel):
    approver_ids: Optional[list[int]] = None


class LegalDecisionIn(BaseModel):
    comment: Optional[str] = None


class LegalTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    body: str
    variables: list[str] = []
    default_approvers: list[int] = []
    created_at: datetime
    updated_at: datetime


class LegalTemplateCreateIn(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    # Keep permissive schema (avoid 422); validate required fields in router for consistent 400s.
    body: str = ""
    variables: list[str] = []
    default_approvers: list[int] = []


class LegalTemplateUpdateIn(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    body: Optional[str] = None
    variables: Optional[list[str]] = None
    default_approvers: Optional[list[int]] = None




class LegalOverviewOut(BaseModel):
    counts: dict[str, int]
    expiring_soon: int
    recent_activity: list[LegalAuditLogOut]


class LegalUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
