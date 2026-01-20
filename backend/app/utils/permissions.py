from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Area, UserAreaAccess, User


FORBIDDEN = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

# Legal is visible to all authenticated members (write actions remain restricted).
LEGAL_VIEW_ROLES = {"USER", "LEGAL_VIEWER", "LEGAL_EDITOR", "LEGAL_APPROVER", "LEGAL_ADMIN", "ADMIN", "SUPER_ADMIN"}
LEGAL_EDIT_ROLES = {"LEGAL_EDITOR", "LEGAL_ADMIN", "ADMIN", "SUPER_ADMIN"}
LEGAL_APPROVE_ROLES = {"LEGAL_APPROVER", "LEGAL_ADMIN", "ADMIN", "SUPER_ADMIN"}
LEGAL_TEMPLATE_ADMIN_ROLES = {"LEGAL_ADMIN", "SUPER_ADMIN"}
LEGAL_DELETE_ROLES = {"LEGAL_ADMIN", "SUPER_ADMIN"}


def require_legal_view(user: User):
    if (user.role or "") not in LEGAL_VIEW_ROLES:
        raise FORBIDDEN


def require_legal_edit(user: User):
    if (user.role or "") not in LEGAL_EDIT_ROLES:
        raise FORBIDDEN


def require_legal_approve(user: User):
    if (user.role or "") not in LEGAL_APPROVE_ROLES:
        raise FORBIDDEN


def require_legal_template_admin(user: User):
    if (user.role or "") not in LEGAL_TEMPLATE_ADMIN_ROLES:
        raise FORBIDDEN


def require_legal_delete(user: User):
    if (user.role or "") not in LEGAL_DELETE_ROLES:
        raise FORBIDDEN


def get_allowed_area_ids(db: Session, user: User, require_manage: bool = False) -> list[int]:
    if user.is_super_admin:
        return [a for (a,) in db.query(Area.id).all()]

    accesses = db.query(UserAreaAccess).filter(UserAreaAccess.user_id == user.id).all()
    return [a.area_id for a in accesses]


def require_area_access(db: Session, user: User, area_id: int, require_manage: bool = False):
    if user.is_super_admin:
        return
    allowed = get_allowed_area_ids(db, user, require_manage=require_manage)
    if area_id not in allowed:
        raise FORBIDDEN


def get_user_allowed_area_ids(db: Session, user_id: int, require_manage: bool = False) -> list[int]:
    """
    Convenience helper to fetch allowed area IDs when only the user_id is available.
    """
    user = db.get(User, user_id)
    if not user:
        return []
    return get_allowed_area_ids(db, user, require_manage=require_manage)
