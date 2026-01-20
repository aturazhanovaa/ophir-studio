from pydantic import BaseModel, ConfigDict
from app.db.models import Role


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    is_admin: bool
    role: Role
