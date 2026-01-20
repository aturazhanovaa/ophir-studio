from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import AnalyticsEvent, User, Document, AccuracyLevel, AnswerTone
from app.db.session import get_db
from app.core.security import decode_token
from app.db.models import utcnow
from app.schemas.analytics import (
    AnalyticsOverview,
    TopDocumentRow,
    QuestionRow,
    UnansweredRow,
    QuestionsSummary,
    QuestionsTrends,
)
from app.utils.permissions import get_user_allowed_area_ids
from app.utils.date_ranges import resolve_date_range, to_utc_range

router = APIRouter(prefix="/analytics", tags=["analytics"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def super_admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return user


def _resolve_range(range_value: str | None, start_date: str | None, end_date: str | None):
    try:
        rng = resolve_date_range(range_key=range_value, start_date=start_date, end_date=end_date, now=utcnow())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return to_utc_range(rng)


@router.get("/overview", response_model=AnalyticsOverview)
def overview(
    range: str = Query("7d"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(super_admin_user),
):
    start_ts, end_ts = _resolve_range(range, start_date, end_date)

    total_questions = (
        db.query(AnalyticsEvent)
        .filter(AnalyticsEvent.event_type == "question_asked")
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .count()
    )
    unanswered = (
        db.query(AnalyticsEvent)
        .filter(AnalyticsEvent.event_type == "unanswered_question")
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .count()
    )
    top_doc_row = (
        db.query(AnalyticsEvent.document_id, func.count(AnalyticsEvent.id).label("cnt"))
        .filter(AnalyticsEvent.event_type == "document_viewed")
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .filter(AnalyticsEvent.document_id.isnot(None))
        .group_by(AnalyticsEvent.document_id)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .first()
    )
    top_document = None
    if top_doc_row and top_doc_row[0]:
        doc = db.get(Document, top_doc_row[0])
        if doc:
            top_document = {"id": doc.id, "title": doc.title, "count": int(top_doc_row[1])}

    active_users = (
        db.query(func.count(func.distinct(AnalyticsEvent.user_id)))
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .filter(AnalyticsEvent.user_id.isnot(None))
        .scalar()
        or 0
    )

    return AnalyticsOverview(
        total_questions=total_questions,
        unanswered_questions=unanswered,
        top_document=top_document,
        active_users=int(active_users),
    )


@router.get("/top-documents", response_model=list[TopDocumentRow])
def top_documents(
    range: str = Query("7d"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    area_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(super_admin_user),
):
    start_ts, end_ts = _resolve_range(range, start_date, end_date)
    allowed_area_ids = get_user_allowed_area_ids(db, user.id)
    if not allowed_area_ids:
        return []

    target_area_ids = allowed_area_ids
    if area_id is not None:
        if area_id not in allowed_area_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        target_area_ids = [area_id]

    rows = (
        db.query(AnalyticsEvent.document_id, func.count(AnalyticsEvent.id).label("cnt"))
        .join(Document, Document.id == AnalyticsEvent.document_id)
        .filter(AnalyticsEvent.event_type == "document_viewed")
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .filter(AnalyticsEvent.document_id.isnot(None))
        .filter(Document.area_id.in_(target_area_ids))
        .filter(Document.deleted_at.is_(None))
        .group_by(AnalyticsEvent.document_id)
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(20)
        .all()
    )
    out = []
    for doc_id, cnt in rows:
        doc = db.get(Document, doc_id)
        if not doc:
            continue
        out.append(TopDocumentRow(document_id=doc.id, title=doc.title, area_id=doc.area_id, count=int(cnt)))
    return out


@router.get("/top-questions", response_model=list[QuestionRow])
def top_questions(
    range: str = Query("7d"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    accuracy_level: AccuracyLevel | None = Query(None),
    answer_tone: AnswerTone | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(super_admin_user),
):
    start_ts, end_ts = _resolve_range(range, start_date, end_date)
    rows_query = db.query(
        AnalyticsEvent.query,
        AnalyticsEvent.area_id,
        func.coalesce(AnalyticsEvent.accuracy_level, AccuracyLevel.MEDIUM.value).label("accuracy_level"),
        func.coalesce(AnalyticsEvent.answer_tone, AnswerTone.C_EXECUTIVE.value).label("answer_tone"),
        func.count(AnalyticsEvent.id).label("cnt"),
    ).filter(AnalyticsEvent.event_type == "question_asked").filter(AnalyticsEvent.created_at >= start_ts).filter(AnalyticsEvent.created_at <= end_ts)

    if accuracy_level:
        rows_query = rows_query.filter(
            func.coalesce(AnalyticsEvent.accuracy_level, AccuracyLevel.MEDIUM.value) == accuracy_level.value
        )
    if answer_tone:
        rows_query = rows_query.filter(
            func.coalesce(AnalyticsEvent.answer_tone, AnswerTone.C_EXECUTIVE.value) == answer_tone.value
        )

    rows = (
        rows_query.group_by(AnalyticsEvent.query, AnalyticsEvent.area_id, "accuracy_level", "answer_tone")
        .order_by(func.count(AnalyticsEvent.id).desc())
        .limit(50)
        .all()
    )
    return [
        QuestionRow(query=r[0] or "", area_id=r[1], accuracy_level=r[2], answer_tone=r[3], count=int(r[4]))
        for r in rows
    ]


@router.get("/unanswered", response_model=list[UnansweredRow])
def unanswered(
    range: str = Query("7d"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    accuracy_level: AccuracyLevel | None = Query(None),
    answer_tone: AnswerTone | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(super_admin_user),
):
    start_ts, end_ts = _resolve_range(range, start_date, end_date)
    rows_query = (
        db.query(AnalyticsEvent)
        .filter(AnalyticsEvent.event_type == "unanswered_question")
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
    )

    if accuracy_level:
        rows_query = rows_query.filter(
            func.coalesce(AnalyticsEvent.accuracy_level, AccuracyLevel.MEDIUM.value) == accuracy_level.value
        )
    if answer_tone:
        rows_query = rows_query.filter(
            func.coalesce(AnalyticsEvent.answer_tone, AnswerTone.C_EXECUTIVE.value) == answer_tone.value
        )

    rows = rows_query.order_by(AnalyticsEvent.created_at.desc()).limit(100).all()
    return [
        UnansweredRow(
            area_id=r.area_id,
            query=r.query or "",
            asked_at=r.created_at,
            user_id=r.user_id,
            accuracy_level=r.accuracy_level or AccuracyLevel.MEDIUM.value,
            answer_tone=r.answer_tone or AnswerTone.C_EXECUTIVE.value,
        )
        for r in rows
    ]


def _require_area_access(db: Session, user: User, area_id: int):
    allowed = get_user_allowed_area_ids(db, user.id)
    if area_id not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


@router.get("/questions/summary", response_model=QuestionsSummary)
def questions_summary(
    area_id: int = Query(...),
    range: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(super_admin_user),
):
    _require_area_access(db, user, area_id)
    start_ts, end_ts = _resolve_range(range, start_date, end_date)

    total = (
        db.query(func.count(AnalyticsEvent.id))
        .filter(AnalyticsEvent.event_type == "question_asked")
        .filter(AnalyticsEvent.area_id == area_id)
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .scalar()
        or 0
    )

    accuracy_rows = (
        db.query(
            func.coalesce(AnalyticsEvent.accuracy_level, AccuracyLevel.MEDIUM.value).label("accuracy_level"),
            func.count(AnalyticsEvent.id).label("cnt"),
        )
        .filter(AnalyticsEvent.event_type == "question_asked")
        .filter(AnalyticsEvent.area_id == area_id)
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .group_by("accuracy_level")
        .all()
    )
    tone_rows = (
        db.query(
            func.coalesce(AnalyticsEvent.answer_tone, AnswerTone.C_EXECUTIVE.value).label("answer_tone"),
            func.count(AnalyticsEvent.id).label("cnt"),
        )
        .filter(AnalyticsEvent.event_type == "question_asked")
        .filter(AnalyticsEvent.area_id == area_id)
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .group_by("answer_tone")
        .all()
    )

    return QuestionsSummary(
        total_questions=int(total),
        by_accuracy=[{"accuracy_level": r[0], "count": int(r[1])} for r in accuracy_rows],
        by_tone=[{"answer_tone": r[0], "count": int(r[1])} for r in tone_rows],
    )


@router.get("/questions/trends", response_model=QuestionsTrends)
def questions_trends(
    area_id: int = Query(...),
    days: int = Query(30, ge=1, le=365),
    range: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(super_admin_user),
):
    _require_area_access(db, user, area_id)
    if start_date or end_date or range:
        start_ts, end_ts = _resolve_range(range, start_date, end_date)
    else:
        start_ts = utcnow() - timedelta(days=days)
        end_ts = utcnow()

    accuracy_rows = (
        db.query(
            func.date(AnalyticsEvent.created_at).label("day"),
            func.coalesce(AnalyticsEvent.accuracy_level, AccuracyLevel.MEDIUM.value).label("accuracy_level"),
            func.count(AnalyticsEvent.id).label("cnt"),
        )
        .filter(AnalyticsEvent.event_type == "question_asked")
        .filter(AnalyticsEvent.area_id == area_id)
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .group_by("day", "accuracy_level")
        .order_by("day")
        .all()
    )

    tone_rows = (
        db.query(
            func.date(AnalyticsEvent.created_at).label("day"),
            func.coalesce(AnalyticsEvent.answer_tone, AnswerTone.C_EXECUTIVE.value).label("answer_tone"),
            func.count(AnalyticsEvent.id).label("cnt"),
        )
        .filter(AnalyticsEvent.event_type == "question_asked")
        .filter(AnalyticsEvent.area_id == area_id)
        .filter(AnalyticsEvent.created_at >= start_ts)
        .filter(AnalyticsEvent.created_at <= end_ts)
        .group_by("day", "answer_tone")
        .order_by("day")
        .all()
    )

    return QuestionsTrends(
        by_accuracy=[{"date": r[0], "accuracy_level": r[1], "count": int(r[2])} for r in accuracy_rows],
        by_tone=[{"date": r[0], "answer_tone": r[1], "count": int(r[2])} for r in tone_rows],
    )
