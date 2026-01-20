from pydantic import BaseModel, ConfigDict

class AreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    color: str | None = None
    color: str | None

class MembershipOut(BaseModel):
    area_id: int
    can_read: bool
    can_write: bool
    can_manage: bool
