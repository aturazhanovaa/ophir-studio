from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.db.models import AccuracyLevel, AnswerTone


class AnalyticsOverview(BaseModel):
    total_questions: int
    unanswered_questions: int
    top_document: Optional[dict]
    active_users: int


class TopDocumentRow(BaseModel):
    document_id: int
    title: str
    area_id: Optional[int]
    count: int


class QuestionRow(BaseModel):
    query: str
    area_id: Optional[int]
    accuracy_level: AccuracyLevel
    answer_tone: AnswerTone
    count: int


class UnansweredRow(BaseModel):
    area_id: Optional[int]
    query: str
    asked_at: datetime
    user_id: Optional[int]
    accuracy_level: AccuracyLevel
    answer_tone: AnswerTone


class AccuracyBreakdown(BaseModel):
    accuracy_level: AccuracyLevel
    count: int


class ToneBreakdown(BaseModel):
    answer_tone: AnswerTone
    count: int


class QuestionsSummary(BaseModel):
    total_questions: int
    by_accuracy: List[AccuracyBreakdown]
    by_tone: List[ToneBreakdown]


class AccuracyTrendPoint(BaseModel):
    date: str
    accuracy_level: AccuracyLevel
    count: int


class ToneTrendPoint(BaseModel):
    date: str
    answer_tone: AnswerTone
    count: int


class QuestionsTrends(BaseModel):
    by_accuracy: List[AccuracyTrendPoint]
    by_tone: List[ToneTrendPoint]
