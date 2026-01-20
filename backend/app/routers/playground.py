import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import PlaygroundRun, User
from app.db.session import get_db
from app.schemas.draft import DraftSourceOut
from app.schemas.playground import PlaygroundFeedbackIn, PlaygroundRunIn, PlaygroundRunOut
from app.services.drafting import generate_draft

router = APIRouter(prefix="/playground", tags=["playground"])
bearer = HTTPBearer()
logger = logging.getLogger(__name__)


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/run", response_model=PlaygroundRunOut)
def run_playground(
    payload: PlaygroundRunIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    filters = payload.filters.model_dump()
    result = generate_draft(
        db,
        payload.objective,
        payload.context,
        filters,
        payload.filters.language,
    )

    run = PlaygroundRun(
        objective=payload.objective,
        context=payload.context,
        filters=filters,
        output=result["draft"],
        sources=[
            {
                "source_type": s["source_type"],
                "source_id": s["source_id"],
                "title": s["title"],
                "status": s["status"],
                "score": s["score"],
            }
            for s in result["sources"]
        ],
        user_id=user.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    logger.info(
        "Playground run",
        extra={"run_id": run.id, "objective": payload.objective, "source_count": len(result["sources"])},
    )

    sources = [
        DraftSourceOut(
            source_type=s["source_type"],
            source_id=s["source_id"],
            title=s["title"],
            status=s["status"],
            score=float(s["score"]),
        )
        for s in result["sources"]
    ]

    return PlaygroundRunOut(
        run_id=run.id,
        draft=result["draft"],
        sources=sources,
        warnings=result["warnings"],
        confidence_label=result["confidence_label"],
    )


@router.post("/runs/{run_id}/feedback")
def submit_feedback(
    run_id: int,
    payload: PlaygroundFeedbackIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    run = db.get(PlaygroundRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.user_id != user.id and not user.is_admin_role:
        raise HTTPException(status_code=403, detail="Not allowed")
    run.rating = payload.rating
    run.comment = payload.comment
    db.add(run)
    db.commit()
    return {"status": "ok"}
