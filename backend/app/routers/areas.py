from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db.session import get_db
from app.db.models import Area, User, UserAreaAccess
from app.core.security import decode_token
from app.schemas.area import AreaOut
from app.schemas.access import AreaAccessWithAreaOut
from app.utils.permissions import get_allowed_area_ids

router = APIRouter(prefix="/areas", tags=["areas"])
bearer = HTTPBearer()

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

@router.get("", response_model=List[AreaOut])
def list_areas(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.is_super_admin:
        return db.query(Area).all()

    allowed_ids = get_allowed_area_ids(db, user, require_manage=False)
    if not allowed_ids:
        return []
    return db.query(Area).filter(Area.id.in_(allowed_ids)).all()


@router.get("/catalog", response_model=List[AreaOut])
def catalog(db: Session = Depends(get_db), user: User = Depends(current_user)):
    # Authenticated users can see the list of possible areas to request.
    return db.query(Area).order_by(Area.name.asc()).all()

@router.get("/me", response_model=List[AreaAccessWithAreaOut])
def my_memberships(db: Session = Depends(get_db), user: User = Depends(current_user)):
    accesses = (
        db.query(UserAreaAccess)
        .filter(UserAreaAccess.user_id == user.id)
        .join(Area, UserAreaAccess.area_id == Area.id)
        .all()
    )
    return accesses
