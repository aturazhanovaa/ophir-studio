import logging
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.schemas.draft import DraftRequestIn, DraftResponseOut, DraftSourceOut
from app.services.drafting import generate_draft
from app.services.notion import append_draft_to_page
from app.utils.integration import require_integration_key

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)


OUTREACH_OBJECTIVES = {
    "outreach email",
    "linkedin message",
    "discovery call opener",
    "proposal section",
}


def _objective_requires_filters(objective: str) -> bool:
    if not objective:
        return False
    lowered = objective.strip().lower()
    return any(key in lowered for key in OUTREACH_OBJECTIVES)


@router.post("/draft", response_model=DraftResponseOut)
def draft(
    payload: DraftRequestIn,
    _: bool = Depends(require_integration_key),
    db: Session = Depends(get_db),
):
    filters = payload.filters.model_dump()
    sector = filters.get("sector") or []
    use_case = filters.get("use_case") or []
    if _objective_requires_filters(payload.objective) and (not sector or not use_case):
        raise HTTPException(status_code=400, detail="sector and use_case filters are required for outreach objectives")

    result = generate_draft(
        db,
        payload.objective,
        payload.context,
        filters,
        payload.filters.language,
    )

    notion_status = None
    if payload.notion_page_id:
        if not settings.notion_api_key:
            notion_status = "skipped"
        else:
            try:
                append_draft_to_page(payload.notion_page_id, result["draft"])
                notion_status = "written"
            except Exception as exc:
                logger.warning("Notion writeback failed: %s", exc)
                notion_status = "failed"

    logger.info(
        "AI draft request",
        extra={
            "objective": payload.objective,
            "filters": {k: len(v or []) for k, v in filters.items() if k != "language"},
            "source_count": len(result["sources"]),
        },
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

    return DraftResponseOut(
        draft=result["draft"],
        sources=sources,
        warnings=result["warnings"],
        confidence_label=result["confidence_label"],
        notion_writeback=notion_status,
    )
