from typing import List, Optional, Union

from pydantic import BaseModel, Field


TagValue = Union[int, str]


class DraftFiltersIn(BaseModel):
    sector: List[TagValue] = Field(default_factory=list)
    use_case: List[TagValue] = Field(default_factory=list)
    audience: List[TagValue] = Field(default_factory=list)
    funnel_stage: List[TagValue] = Field(default_factory=list)
    geography: List[TagValue] = Field(default_factory=list)
    persona: List[TagValue] = Field(default_factory=list)
    industry_subvertical: List[TagValue] = Field(default_factory=list)
    product_line: List[TagValue] = Field(default_factory=list)
    compliance: List[TagValue] = Field(default_factory=list)
    price_tier: List[TagValue] = Field(default_factory=list)
    language: Optional[str] = None


class DraftRequestIn(BaseModel):
    objective: str
    context: Optional[str] = None
    filters: DraftFiltersIn = Field(default_factory=DraftFiltersIn)
    notion_page_id: Optional[str] = None


class DraftSourceOut(BaseModel):
    source_type: str
    source_id: int
    title: str
    status: str
    score: float


class DraftResponseOut(BaseModel):
    draft: str
    sources: List[DraftSourceOut] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    confidence_label: str
    notion_writeback: Optional[str] = None
