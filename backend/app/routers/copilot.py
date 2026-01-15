import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.ai.tone_guides import get_tone_guide, list_tone_guides
from app.db.session import get_db
from app.db.models import Area, Conversation, ConversationMessage, ConversationRole, User, AnalyticsEvent, utcnow
from app.core.security import decode_token
from app.schemas.copilot import CopilotAskIn, CopilotAskOut, ToneGuideOut
from app.services.rag import answer_with_rag
from app.utils.permissions import get_allowed_area_ids, require_area_access
from app.schemas.copilot import MatchOut

router = APIRouter(prefix="/copilot", tags=["copilot"])
bearer = HTTPBearer()

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

@router.get("/tones", response_model=List[ToneGuideOut])
def list_tones(_: User = Depends(current_user)):
    """
    Returns the structured tone profiles used by the Copilot prompt builder.
    """
    return list_tone_guides()


@router.post("/ask", response_model=CopilotAskOut)
def ask(data: CopilotAskIn, request: Request, db: Session = Depends(get_db), user: User = Depends(current_user)):
    accept_language = request.headers.get("accept-language") or ""
    locale = data.locale or (accept_language.split(",")[0].split("-")[0].strip().lower() if accept_language else None) or "en"
    if locale not in ("en", "it"):
        locale = "en"

    allowed = set(get_allowed_area_ids(db, user, require_manage=False))
    conversation: Optional[Conversation] = None
    target_area_ids: list[int] = []

    requested_area_ids: list[int] = []
    if data.area_ids:
        requested_area_ids = data.area_ids
    elif data.area_id is not None:
        requested_area_ids = [data.area_id]

    def _resolve_scope(default_allowed: set[int]) -> list[int]:
        if not requested_area_ids:
            return list(default_allowed)
        bad = [aid for aid in requested_area_ids if aid not in default_allowed and not user.is_super_admin]
        if bad:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        return requested_area_ids

    if data.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == data.conversation_id)
            .filter(Conversation.workspace_id == 1)
            .filter(Conversation.deleted_at.is_(None))
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conversation.created_by_user_id != user.id and not user.is_admin_role:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        target_area_ids = _resolve_scope(allowed) or ([conversation.area_id] if conversation.area_id else [])
        if not target_area_ids:
            target_area_ids = list(allowed)
    else:
        target_area_ids = _resolve_scope(allowed)

        if not target_area_ids:
            raise HTTPException(status_code=400, detail="area_ids must not be empty")

        primary_area_id = target_area_ids[0] if target_area_ids else None
        if primary_area_id:
            area = db.get(Area, primary_area_id)
            if not area:
                raise HTTPException(status_code=404, detail="Area not found")

        conversation = Conversation(
            area_id=primary_area_id,
            workspace_id=1,
            title="New chat",
            created_by_user_id=user.id,
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    history_messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation.id)
        .filter(ConversationMessage.deleted_at.is_(None))
        .order_by(ConversationMessage.created_at.desc())
        .limit(11)
        .all()
    )
    history_payload = []
    for m in reversed(history_messages):
        content = (m.content or "")[:2000]
        if content:
            history_payload.append({"role": m.role, "content": content})

    now = utcnow()
    user_message = ConversationMessage(
        conversation_id=conversation.id,
        role=ConversationRole.USER.value,
        content=data.query,
        meta={
            "tone": data.answer_tone.value,
            "accuracy_target": data.accuracy_level.value,
            "area_ids": target_area_ids,
            "locale": locale,
        },
        created_at=now,
    )
    db.add(user_message)

    if (not conversation.title or conversation.title.strip().lower() == "new chat") and len(history_messages) == 0:
        snippet = (data.query or "New chat").strip()
        conversation.title = (snippet[:77] + "...") if len(snippet) > 80 else (snippet or "New chat")

    conversation.updated_at = now
    db.add(conversation)
    db.flush()
    history_payload.append({"role": user_message.role, "content": user_message.content[:2000]})

    start_time = time.time()
    rag_result = answer_with_rag(
        db,
        data.query,
        target_area_ids,
        top_k=max(1, min(12, data.top_k)),
        accuracy_level=data.accuracy_level,
        answer_tone=data.answer_tone,
        locale=locale,
        chat_history=history_payload,
    )
    latency_ms = int((time.time() - start_time) * 1000)
    usage = rag_result.get("usage") or {}
    tokens_in = usage.get("prompt_tokens")
    tokens_out = usage.get("completion_tokens")
    meta = rag_result.get("meta") or {}
    meta.setdefault("accuracy_level", data.accuracy_level.value)
    meta.setdefault("answer_tone", data.answer_tone.value)
    meta["latency_ms"] = latency_ms
    meta["tokens_in"] = tokens_in
    meta["tokens_out"] = tokens_out
    meta["conversation_id"] = conversation.id
    areas = db.query(Area).filter(Area.id.in_(target_area_ids)).all() if target_area_ids else []
    meta["areas"] = [{"id": a.id, "name": a.name, "color": a.color} for a in areas]
    tone_guide = get_tone_guide(data.answer_tone, locale=locale)
    meta.setdefault("tone_reference", tone_guide.reference_summary)
    meta.setdefault("tone_preview", tone_guide.preview)

    for aid in target_area_ids:
        db.add(
            AnalyticsEvent(
                event_type="question_asked",
                user_id=user.id,
                area_id=aid,
                query=data.query,
                created_at=utcnow(),
                accuracy_level=data.accuracy_level.value,
                answer_tone=data.answer_tone.value,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                latency_ms=latency_ms,
            )
        )

    matches = rag_result.get("matches", [])
    best_score = rag_result.get("best_score", 0.0)
    if not matches or best_score < 0.25:
        for aid in target_area_ids:
            db.add(
                AnalyticsEvent(
                    event_type="unanswered_question",
                    user_id=user.id,
                    area_id=aid,
                    query=data.query,
                    created_at=utcnow(),
                    accuracy_level=data.accuracy_level.value,
                    answer_tone=data.answer_tone.value,
                )
            )

    sources = rag_result.get("sources", matches)
    evidence_level = meta.get("evidence_level")
    assistant_message = ConversationMessage(
        conversation_id=conversation.id,
        role=ConversationRole.ASSISTANT.value,
        content=rag_result.get("answer", ""),
        meta={
            "tone": data.answer_tone.value,
            "accuracy_target": data.accuracy_level.value,
            "sources": sources,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "latency_ms": latency_ms,
            "meta": meta,
            "areas": meta.get("areas"),
            "locale": locale,
        },
        created_at=utcnow(),
    )
    conversation.updated_at = assistant_message.created_at
    db.add(assistant_message)
    db.add(conversation)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    return CopilotAskOut(
        answer=assistant_message.content,
        matches=[MatchOut(**m) for m in matches],
        sources=[MatchOut(**m) for m in sources],
        accuracy_level=data.accuracy_level,
        answer_tone=data.answer_tone,
        best_score=rag_result.get("best_score"),
        meta=meta,
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        user_message_id=user_message.id,
    )
