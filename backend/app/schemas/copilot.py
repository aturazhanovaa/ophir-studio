from typing import List, Optional
from pydantic import BaseModel, Field, model_validator
from app.db.models import AccuracyLevel, AnswerTone


def _normalize_locale(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    base = value.split(",")[0].strip().lower()
    base = base.split("-")[0].strip()
    if base in ("en", "it"):
        return base
    return None


class CopilotAskIn(BaseModel):
    query: Optional[str] = None
    question: Optional[str] = None
    locale: Optional[str] = None
    area_id: Optional[int] = None
    area_ids: List[int] = Field(default_factory=list)
    conversation_id: Optional[str] = None
    top_k: int = 6
    accuracy_level: AccuracyLevel = AccuracyLevel.MEDIUM
    answer_tone: AnswerTone = AnswerTone.C_EXECUTIVE

    @model_validator(mode="before")
    @classmethod
    def map_legacy_enums(cls, values):
        if not isinstance(values, dict):
            return values

        acc = values.get("accuracy_level")
        tone = values.get("answer_tone")

        if isinstance(acc, str):
            acc_norm = acc.lower()
            acc_map = {
                "high": AccuracyLevel.HIGH,
                "strict": AccuracyLevel.HIGH,
                "medium": AccuracyLevel.MEDIUM,
                "balanced": AccuracyLevel.MEDIUM,
                "low": AccuracyLevel.LOW,
                "creative": AccuracyLevel.LOW,
            }
            if acc_norm in acc_map:
                values["accuracy_level"] = acc_map[acc_norm]

        if isinstance(tone, str):
            tone_norm = tone.lower()
            tone_map = {
                "technical": AnswerTone.TECHNICAL,
                "c_executive": AnswerTone.C_EXECUTIVE,
                "executive": AnswerTone.C_EXECUTIVE,
                "colloquial": AnswerTone.COLLOQUIAL,
                "default": AnswerTone.C_EXECUTIVE,
            }
            if tone_norm in tone_map:
                values["answer_tone"] = tone_map[tone_norm]

        return values

    @model_validator(mode="after")
    def normalize(self):
        self.query = self.query or self.question
        if not self.query:
            raise ValueError("query/question is required")

        self.locale = _normalize_locale(self.locale)

        if self.conversation_id:
            return self

        if self.area_id is not None:
            self.area_ids = [self.area_id]
        return self


class Highlight(BaseModel):
    start: int
    end: int


class MatchOut(BaseModel):
    chunk_id: Optional[int] = None
    document_id: int
    version_id: Optional[int]
    chunk_index: int
    chunk_text: str
    score: float
    document_title: Optional[str] = None
    heading_path: Optional[str] = ""
    area_id: Optional[int] = None
    area_name: Optional[str] = None
    area_color: Optional[str] = None
    highlights: List[Highlight]


class CopilotMeta(BaseModel):
    accuracy_level: AccuracyLevel
    answer_tone: AnswerTone
    evidence_level: Optional[str] = None
    latency_ms: Optional[int] = None
    timings: Optional[dict] = None
    tone_reference: Optional[str] = None
    tone_preview: Optional[str] = None
    confidence_percent: Optional[int] = None
    confidence_label: Optional[str] = None
    confidence_explanation: Optional[str] = None
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    conversation_id: Optional[str] = None
    accuracy_percent: Optional[int] = None
    areas: Optional[list[dict]] = None


class CopilotAskOut(BaseModel):
    answer: str
    matches: List[MatchOut]
    accuracy_level: AccuracyLevel
    answer_tone: AnswerTone
    sources: List[MatchOut]
    best_score: Optional[float] = None
    meta: Optional[CopilotMeta] = None
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    user_message_id: Optional[str] = None


class ToneFormatting(BaseModel):
    headings: List[str]
    key_takeaway_label: str
    next_steps_label: str
    max_bullets: int
    max_sentences: int
    sentence_length: str


class ToneGuideOut(BaseModel):
    id: str
    name: str
    description: str
    reference_summary: str
    rules: List[str]
    formatting: ToneFormatting
    template: str
    preview: str
