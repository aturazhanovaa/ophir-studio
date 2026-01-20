from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import Area, Conversation, ConversationMessage, User, utcnow
from app.db.session import get_db
from app.schemas.conversation import ConversationCreate, ConversationDetailOut, ConversationOut, ConversationUpdate
from app.utils.permissions import get_allowed_area_ids

router = APIRouter(prefix="/conversations", tags=["conversations"])
bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def _preview(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    cleaned = " ".join(text.strip().split())
    return (cleaned[:160] + "…") if len(cleaned) > 160 else cleaned


def _ensure_owner_or_admin(conversation: Conversation, user: User):
    if conversation.created_by_user_id == user.id:
        return
    if getattr(user, "is_admin_role", False):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


@router.post("", response_model=ConversationDetailOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    area_id = payload.area_id
    if area_id is not None:
        area = db.get(Area, area_id)
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Area not found")
        allowed = get_allowed_area_ids(db, user, require_manage=False)
        if area_id not in allowed and not user.is_super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    else:
        allowed = get_allowed_area_ids(db, user, require_manage=False)
        area_id = allowed[0] if allowed else None
    now = utcnow()
    conv = Conversation(
        area_id=area_id,
        workspace_id=1,
        title=(payload.title or "New chat").strip() or "New chat",
        created_by_user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    detail = ConversationDetailOut.model_validate(conv)
    detail.messages = []
    return detail


@router.get("", response_model=List[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    conversations = (
        db.query(Conversation)
        .filter(Conversation.deleted_at.is_(None))
        .filter(Conversation.created_by_user_id == user.id)
        .filter(Conversation.workspace_id == 1)
        .order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
        .all()
    )
    if not conversations:
        return []

    ids = [c.id for c in conversations]
    last_messages: dict[str, ConversationMessage] = {}
    if ids:
        for msg in (
            db.query(ConversationMessage)
            .filter(ConversationMessage.conversation_id.in_(ids))
            .filter(ConversationMessage.deleted_at.is_(None))
            .order_by(ConversationMessage.conversation_id, ConversationMessage.created_at.desc())
            .all()
        ):
            if msg.conversation_id not in last_messages:
                last_messages[msg.conversation_id] = msg

    results: List[ConversationOut] = []
    for conv in conversations:
        item = ConversationOut.model_validate(conv)
        last_msg = last_messages.get(conv.id)
        preview = _preview(last_msg.content if last_msg else None)
        object.__setattr__(item, "last_message_preview", preview)
        results.append(item)
    return results


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .filter(Conversation.workspace_id == 1)
        .filter(Conversation.deleted_at.is_(None))
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    _ensure_owner_or_admin(conv, user)

    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation_id)
        .filter(ConversationMessage.deleted_at.is_(None))
        .order_by(ConversationMessage.created_at.asc())
        .all()
    )

    detail = ConversationDetailOut.model_validate(conv)
    detail.messages = messages
    return detail


@router.patch("/{conversation_id}", response_model=ConversationDetailOut)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .filter(Conversation.workspace_id == 1)
        .filter(Conversation.deleted_at.is_(None))
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    _ensure_owner_or_admin(conv, user)

    updated = False
    if payload.title is not None:
        conv.title = payload.title.strip() or "New chat"
        updated = True

    if updated:
        conv.updated_at = utcnow()
        db.add(conv)
        db.commit()
        db.refresh(conv)

    detail = ConversationDetailOut.model_validate(conv)
    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation_id)
        .filter(ConversationMessage.deleted_at.is_(None))
        .order_by(ConversationMessage.created_at.asc())
        .all()
    )
    detail.messages = messages
    return detail


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .filter(Conversation.workspace_id == 1)
        .filter(Conversation.deleted_at.is_(None))
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    _ensure_owner_or_admin(conv, user)

    deleted_at = utcnow()
    conv.deleted_at = deleted_at
    conv.updated_at = deleted_at
    db.add(conv)
    (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation_id)
        .filter(ConversationMessage.deleted_at.is_(None))
        .update({"deleted_at": deleted_at})
    )
    db.commit()
