from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import (
    AccessRequest,
    AccessRequestStatus,
    Area,
    User,
    UserAreaAccess,
    utcnow,
)
from app.db.session import get_db
from app.schemas.access import AccessRequestWithUserOut
from pydantic import BaseModel

router = APIRouter(prefix="/access-requests", tags=["access-requests"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


class CreateAccessRequestIn(BaseModel):
    area_ids: List[int]
    message: Optional[str] = None


@router.post("", response_model=List[AccessRequestWithUserOut], status_code=status.HTTP_201_CREATED)
def create_access_requests(payload: CreateAccessRequestIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not payload.area_ids:
        raise HTTPException(status_code=400, detail="area_ids required")

    created: list[AccessRequest] = []
    reused: list[AccessRequest] = []
    for aid in set(payload.area_ids):
        area = db.get(Area, aid)
        if not area:
            raise HTTPException(status_code=404, detail=f"Area {aid} not found")

        already_has = (
            db.query(UserAreaAccess)
            .filter(UserAreaAccess.user_id == user.id, UserAreaAccess.area_id == aid)
            .first()
        )
        if already_has:
            continue

        pending = (
            db.query(AccessRequest)
            .filter(
                AccessRequest.requester_user_id == user.id,
                AccessRequest.area_id == aid,
                AccessRequest.status == AccessRequestStatus.PENDING.value,
            )
            .first()
        )
        if pending:
            reused.append(pending)
            continue

        req = AccessRequest(
            requester_user_id=user.id,
            area_id=aid,
            status=AccessRequestStatus.PENDING.value,
            message=payload.message,
            created_at=utcnow(),
        )
        db.add(req)
        created.append(req)

    if not created and not reused:
        raise HTTPException(status_code=400, detail="No new requests created (already have access?)")

    db.commit()
    for obj in created:
        db.refresh(obj)
    return created + reused


@router.get("/me", response_model=List[AccessRequestWithUserOut])
def my_requests(db: Session = Depends(get_db), user: User = Depends(current_user)):
    requests = (
        db.query(AccessRequest)
        .filter(AccessRequest.requester_user_id == user.id)
        .join(Area, Area.id == AccessRequest.area_id)
        .order_by(AccessRequest.created_at.desc())
        .all()
    )
    return requests


@router.post("/{request_id}/cancel", response_model=AccessRequestWithUserOut)
def cancel_request(request_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.requester_user_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot cancel this request")
    if req.status != AccessRequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")

    req.status = AccessRequestStatus.CANCELLED.value
    req.decided_by_user_id = user.id
    req.decided_at = utcnow()
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

