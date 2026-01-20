from typing import Optional

from pydantic import BaseModel

from app.schemas.draft import DraftFiltersIn, DraftSourceOut


class PlaygroundRunIn(BaseModel):
    objective: str
    context: Optional[str] = None
    filters: DraftFiltersIn


class PlaygroundFeedbackIn(BaseModel):
    rating: str
    comment: Optional[str] = None


class PlaygroundRunOut(BaseModel):
    run_id: int
    draft: str
    sources: list[DraftSourceOut]
    warnings: list[str]
    confidence_label: str
