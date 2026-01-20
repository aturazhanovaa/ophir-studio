import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import (
    ContentSource,
    ContentStatus,
    MessagingBlock,
    MessagingBlockTag,
    MessagingBlockVersion,
    Tag,
    TagCategory,
    TagSuggestion,
    TagSuggestionStatus,
    utcnow,
)
from app.db.session import get_db
from app.schemas.integrations import NotionMessagingBlockUpsertIn, NotionUpsertOut
from app.services.drafting import snapshot_tags
from app.utils.integration import require_integration_key

router = APIRouter(prefix="/integrations/notion", tags=["integrations"])
logger = logging.getLogger(__name__)


def _parse_rich_text(prop: Dict[str, Any]) -> str:
    items = prop.get("title") or prop.get("rich_text") or []
    return "".join([t.get("plain_text") or "" for t in items]).strip()


def _parse_select(prop: Dict[str, Any]) -> Optional[str]:
    val = prop.get("select")
    if isinstance(val, dict):
        return val.get("name")
    return None


def _parse_multi_select(prop: Dict[str, Any]) -> List[str]:
    values = prop.get("multi_select") or []
    return [v.get("name") for v in values if v.get("name")]


def _pick_prop(props: Dict[str, Any], *names: str) -> Optional[Dict[str, Any]]:
    if not props:
        return None
    for name in names:
        for key, val in props.items():
            if key.lower() == name.lower():
                return val
    return None


def _normalize_status(raw: Optional[str]) -> str:
    val = (raw or "").strip().upper()
    if val in {ContentStatus.DRAFT.value, ContentStatus.APPROVED.value, ContentStatus.ARCHIVED.value}:
        return val
    return ContentStatus.DRAFT.value


def _parse_payload(payload: NotionMessagingBlockUpsertIn) -> Dict[str, Any]:
    props = payload.properties or {}
    page_id = payload.page_id or payload.notion_page_id or payload.id

    title = payload.title
    content = payload.content
    status = payload.status
    language = payload.language
    block_id = payload.block_id
    last_edited_time = payload.last_edited_time or payload.notion_last_edited_time

    if props:
        title_prop = _pick_prop(props, "Title", "Name")
        content_prop = _pick_prop(props, "Content")
        status_prop = _pick_prop(props, "Status")
        language_prop = _pick_prop(props, "Language")
        block_prop = _pick_prop(props, "Block ID", "BlockId", "Block")
        if title_prop:
            title = title or _parse_rich_text(title_prop)
        if content_prop:
            content = content or _parse_rich_text(content_prop)
        if status_prop:
            status = status or _parse_select(status_prop)
        if language_prop:
            language = language or _parse_select(language_prop)
        if block_prop:
            block_id = block_id or _parse_rich_text(block_prop)

    return {
        "page_id": page_id,
        "title": title or "",
        "content": content or "",
        "status": _normalize_status(status),
        "language": (language or "en").strip(),
        "block_id": block_id,
        "last_edited_time": last_edited_time,
    }


def _parse_tags(payload: NotionMessagingBlockUpsertIn) -> Dict[str, List[str]]:
    tag_map: Dict[str, List[str]] = {
        "sector": payload.sector or [],
        "use_case": payload.use_case or [],
        "audience": payload.audience or [],
        "geography": payload.geography or [],
    }
    if payload.funnel_stage:
        tag_map["funnel_stage"] = [payload.funnel_stage]

    props = payload.properties or {}
    if props:
        for key, category in [
            ("Sector", "sector"),
            ("Use Case", "use_case"),
            ("Audience", "audience"),
            ("Funnel Stage", "funnel_stage"),
            ("Geography", "geography"),
        ]:
            prop = _pick_prop(props, key)
            if not prop:
                continue
            if category == "funnel_stage":
                selected = _parse_select(prop)
                if selected:
                    tag_map[category] = [selected]
            else:
                values = _parse_multi_select(prop)
                if values:
                    tag_map[category] = values
    return tag_map


def _resolve_tags(db: Session, tag_map: Dict[str, List[str]]) -> List[Tag]:
    tags: List[Tag] = []
    categories = {c.key: c for c in db.query(TagCategory).all()}
    for category_key, names in tag_map.items():
        if not names:
            continue
        category = categories.get(category_key)
        if not category:
            continue
        for name in names:
            val = name.strip().lower()
            if not val:
                continue
            tag = (
                db.query(Tag)
                .filter(Tag.category_id == category.id)
                .filter((Tag.key.ilike(val)) | (Tag.label.ilike(val)))
                .first()
            )
            if tag:
                tags.append(tag)
            else:
                suggestion = TagSuggestion(
                    category_id=category.id,
                    label=name.strip(),
                    note="Requested from Notion sync",
                    status=TagSuggestionStatus.PENDING.value,
                )
                db.add(suggestion)
    return tags


def _set_block_tags(block: MessagingBlock, tags: List[Tag]):
    block.tags = []
    for tag in tags:
        block.tags.append(MessagingBlockTag(tag_id=tag.id))


@router.post("/messaging-blocks/upsert", response_model=NotionUpsertOut)
def upsert_messaging_block(
    payload: NotionMessagingBlockUpsertIn,
    _: bool = Depends(require_integration_key),
    db: Session = Depends(get_db),
):
    parsed = _parse_payload(payload)
    if not parsed["page_id"] and not payload.block_id:
        raise HTTPException(status_code=400, detail="page_id is required")

    tag_map = _parse_tags(payload)
    tags = _resolve_tags(db, tag_map)

    page_id = parsed["page_id"]
    block = None
    if page_id:
        block = db.query(MessagingBlock).filter(MessagingBlock.notion_page_id == page_id).first()
    if not block and payload.block_id:
        block = db.query(MessagingBlock).filter(MessagingBlock.notion_block_id == payload.block_id).first()
    action = "created"

    if block:
        action = "updated"
        existing_timestamp = block.notion_last_edited_time or block.updated_at
        incoming_ts = parsed.get("last_edited_time")
        if block.status == ContentStatus.APPROVED.value and block.source == ContentSource.MANUAL.value:
            if not incoming_ts:
                action = "skipped"
            elif existing_timestamp and incoming_ts <= existing_timestamp:
                action = "skipped"
        if action != "skipped":
            next_version = (block.versions[0].version + 1) if block.versions else 1
            db.add(
                MessagingBlockVersion(
                    messaging_block_id=block.id,
                    version=next_version,
                    title=block.title,
                    content=block.content,
                    summary=block.summary,
                    status=block.status,
                    language=block.language,
                    source=block.source,
                    tags_snapshot=snapshot_tags(block.tags),
                )
            )
            block.title = parsed["title"] or block.title
            block.content = parsed["content"] or block.content
            block.status = parsed["status"]
            block.language = parsed["language"] or block.language
            block.notion_last_edited_time = parsed.get("last_edited_time")
            block.last_synced_at = utcnow()
            block.notion_block_id = parsed.get("block_id") or block.notion_block_id or payload.block_id
            block.source = ContentSource.NOTION.value
            _set_block_tags(block, tags)
            db.add(block)
    else:
        block = MessagingBlock(
            title=parsed["title"] or "Untitled",
            content=parsed["content"] or "",
            status=parsed["status"],
            language=parsed["language"] or "en",
            notion_page_id=page_id,
            notion_block_id=parsed.get("block_id") or payload.block_id,
            notion_last_edited_time=parsed.get("last_edited_time"),
            last_synced_at=utcnow(),
            source=ContentSource.NOTION.value,
        )
        _set_block_tags(block, tags)
        db.add(block)

    db.commit()
    db.refresh(block)

    logger.info(
        "Notion messaging block upsert",
        extra={"page_id": page_id, "status": block.status, "action": action, "tag_count": len(tags)},
    )
    return NotionUpsertOut(status=action, messaging_block_id=block.id)
