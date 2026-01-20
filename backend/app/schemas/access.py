from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.db.models import AccessGrantSource, AccessRequestStatus, Role
from app.schemas.area import AreaOut


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: Role


class AreaAccessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    area_id: int
    granted_by_user_id: int | None
    source: AccessGrantSource
    created_at: datetime


class AreaAccessWithAreaOut(AreaAccessOut):
    area: AreaOut


class AccessRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    requester_user_id: int
    area_id: int
    status: AccessRequestStatus
    message: str | None
    decided_by_user_id: int | None
    decided_at: datetime | None
    decision_reason: str | None
    created_at: datetime
    area: AreaOut


class AccessRequestWithUserOut(AccessRequestOut):
    requester: UserSummary | None = None
    decided_by: UserSummary | None = None

