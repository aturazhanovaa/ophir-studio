from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.security import decode_token, hash_password
from app.db.models import (
    AccessGrantSource,
    AccessRequest,
    AccessRequestStatus,
    Area,
    AreaMembership,
    Role,
    User,
    UserAreaAccess,
    utcnow,
)
from app.db.session import get_db
from app.schemas.access import AreaAccessWithAreaOut, AccessRequestWithUserOut
from app.schemas.user import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_super_admin(user: User):
    if not user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin only")


class AdminAreaAccess(BaseModel):
    id: int
    area_id: int
    area_key: str
    area_name: str
    source: AccessGrantSource
    created_at: datetime


class AdminUserOut(UserOut):
    areas: List[AdminAreaAccess] = []
    created_at: datetime


class CreateUserIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: Role = Role.USER
    area_ids: List[int] = []


class UpdateUserIn(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Role] = None
    password: Optional[str] = None


class GrantAreasIn(BaseModel):
    area_ids: List[int]
    source: AccessGrantSource = AccessGrantSource.MANUAL


class RevokeAreasIn(BaseModel):
    area_ids: List[int]


class RejectRequestIn(BaseModel):
    reason: Optional[str] = None


def _build_admin_user(db: Session, u: User) -> AdminUserOut:
    accesses = (
        db.query(UserAreaAccess)
        .filter(UserAreaAccess.user_id == u.id)
        .join(Area, Area.id == UserAreaAccess.area_id)
        .all()
    )
    areas = [
        AdminAreaAccess(
            id=a.id,
            area_id=a.area_id,
            area_key=a.area.key if a.area else "",
            area_name=a.area.name if a.area else "",
            source=AccessGrantSource(a.source or AccessGrantSource.MANUAL.value),
            created_at=a.created_at,
        )
        for a in accesses
    ]
    return AdminUserOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        is_admin=u.is_admin,
        role=Role(u.role),
        areas=areas,
        created_at=u.created_at,
    )


def _grant_accesses(db: Session, target_user: User, area_ids: List[int], source: AccessGrantSource, actor_id: Optional[int]):
    created: list[UserAreaAccess] = []
    for aid in area_ids:
        area = db.get(Area, aid)
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Area {aid} not found")
        existing = (
            db.query(UserAreaAccess)
            .filter(UserAreaAccess.user_id == target_user.id, UserAreaAccess.area_id == aid)
            .first()
        )
        if existing:
            continue
        ua = UserAreaAccess(
            user_id=target_user.id,
            area_id=aid,
            granted_by_user_id=actor_id,
            source=source.value if isinstance(source, AccessGrantSource) else str(source),
        )
        db.add(ua)
        created.append(ua)
        membership = (
            db.query(AreaMembership)
            .filter(AreaMembership.user_id == target_user.id, AreaMembership.area_id == aid)
            .first()
        )
        if not membership:
            membership = AreaMembership(user_id=target_user.id, area_id=aid, can_read=True, can_write=True, can_manage=True)
            db.add(membership)
        else:
            membership.can_read = True
            membership.can_manage = True
            membership.can_write = True
    return created


def _revoke_accesses(db: Session, target_user: User, area_ids: List[int]) -> int:
    deleted = (
        db.query(UserAreaAccess)
        .filter(UserAreaAccess.user_id == target_user.id, UserAreaAccess.area_id.in_(area_ids))
        .delete(synchronize_session=False)
    )
    db.query(AreaMembership).filter(AreaMembership.user_id == target_user.id, AreaMembership.area_id.in_(area_ids)).delete(synchronize_session=False)
    return deleted


@router.get("/users", response_model=List[AdminUserOut])
def list_users(db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_build_admin_user(db, u) for u in users]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: CreateUserIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    exists = db.query(User).filter(User.email == data.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email exists")

    u = User(
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        is_admin=data.role in (Role.ADMIN, Role.SUPER_ADMIN),
        role=data.role.value,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    if data.area_ids:
        _grant_accesses(db, u, data.area_ids, AccessGrantSource.MANUAL, actor_id=user.id)
        db.commit()

    return _build_admin_user(db, u)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: int, payload: UpdateUserIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        u.full_name = payload.full_name
    if payload.role is not None:
        u.role = payload.role.value
        u.is_admin = payload.role in (Role.ADMIN, Role.SUPER_ADMIN)
    if payload.password:
        u.password_hash = hash_password(payload.password)

    db.add(u)
    db.commit()
    db.refresh(u)
    return _build_admin_user(db, u)


@router.post("/users/{user_id}/areas/grant", response_model=List[AreaAccessWithAreaOut])
def grant_areas(user_id: int, payload: GrantAreasIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not payload.area_ids:
        raise HTTPException(status_code=400, detail="area_ids required")

    _grant_accesses(db, target, payload.area_ids, payload.source, actor_id=user.id)
    db.commit()

    accesses = (
        db.query(UserAreaAccess)
        .filter(UserAreaAccess.user_id == target.id)
        .join(Area, Area.id == UserAreaAccess.area_id)
        .all()
    )
    return accesses


@router.post("/users/{user_id}/areas/revoke", response_model=List[AreaAccessWithAreaOut])
def revoke_areas(user_id: int, payload: RevokeAreasIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not payload.area_ids:
        raise HTTPException(status_code=400, detail="area_ids required")

    _revoke_accesses(db, target, payload.area_ids)
    db.commit()

    accesses = (
        db.query(UserAreaAccess)
        .filter(UserAreaAccess.user_id == target.id)
        .join(Area, Area.id == UserAreaAccess.area_id)
        .all()
    )
    return accesses


@router.get("/access-requests", response_model=List[AccessRequestWithUserOut])
def list_requests(
    status: Optional[AccessRequestStatus] = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_super_admin(user)
    query = db.query(AccessRequest).join(Area, Area.id == AccessRequest.area_id)
    if status:
        query = query.filter(AccessRequest.status == status.value)
    requests = query.order_by(AccessRequest.created_at.desc()).all()
    return requests


@router.post("/access-requests/{request_id}/approve", response_model=AccessRequestWithUserOut)
def approve_request(request_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_super_admin(user)
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != AccessRequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Request already decided")

    target_user = db.get(User, req.requester_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Requester not found")

    req.status = AccessRequestStatus.APPROVED.value
    req.decided_by_user_id = user.id
    req.decided_at = utcnow()
    db.add(req)

    _grant_accesses(db, target_user, [req.area_id], AccessGrantSource.REQUEST_APPROVED, actor_id=user.id)
    db.commit()
    db.refresh(req)
    return req


@router.post("/access-requests/{request_id}/reject", response_model=AccessRequestWithUserOut)
def reject_request(
    request_id: int,
    payload: RejectRequestIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    require_super_admin(user)
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != AccessRequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Request already decided")

    req.status = AccessRequestStatus.REJECTED.value
    req.decided_by_user_id = user.id
    req.decided_at = utcnow()
    req.decision_reason = payload.reason
    db.add(req)
    db.commit()
    db.refresh(req)
    return req
