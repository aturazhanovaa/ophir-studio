import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.db.models import (
    ContentItem,
    ContentItemTag,
    ContentStatus,
    KnowledgeBaseArea,
    MessagingBlock,
    MessagingBlockTag,
    Tag,
    TagCategory,
)

logger = logging.getLogger(__name__)

WEIGHTS = {
    "sector": 4.0,
    "use_case": 4.0,
    "audience": 2.0,
    "funnel_stage": 1.6,
    "geography": 1.2,
    "persona": 0.8,
    "industry_subvertical": 0.8,
    "product_line": 0.7,
    "compliance": 0.7,
    "price_tier": 0.6,
}
EXACT_MATCH_BONUS = 4.5
STATUS_WEIGHTS = {
    ContentStatus.APPROVED.value: 2.5,
    ContentStatus.DRAFT.value: 0.8,
    ContentStatus.ARCHIVED.value: 0.1,
}


def _client() -> OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required.")
    return OpenAI(api_key=settings.openai_api_key)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _keyword_score(text: str, query: str) -> float:
    query_terms = [t for t in re.split(r"[\s,]+", _normalize_text(query)) if len(t) > 2]
    if not query_terms:
        return 0.0
    hits = 0
    text_lower = (text or "").lower()
    for term in query_terms:
        if term and term in text_lower:
            hits += 1
    return hits / max(1, len(query_terms))


def resolve_filter_tags(db: Session, filters: Dict[str, List[Any]]) -> Tuple[Dict[str, List[Tag]], List[str]]:
    warnings: List[str] = []
    if not filters:
        return {}, warnings

    categories = {c.key: c for c in db.query(TagCategory).all()}
    resolved: Dict[str, List[Tag]] = {}

    for key, raw_values in filters.items():
        if key not in categories:
            continue
        if not raw_values:
            continue
        tag_list: List[Tag] = []
        for raw in raw_values:
            if raw is None:
                continue
            tag: Optional[Tag] = None
            if isinstance(raw, int):
                tag = db.get(Tag, raw)
            else:
                val = str(raw).strip().lower()
                if not val:
                    continue
                tag = (
                    db.query(Tag)
                    .join(TagCategory)
                    .filter(TagCategory.key == key)
                    .filter((Tag.key.ilike(val)) | (Tag.label.ilike(val)))
                    .first()
                )
            if tag and tag.category and tag.category.key == key:
                tag_list.append(tag)
            else:
                warnings.append(f"Unknown tag '{raw}' for category '{key}'.")
        if tag_list:
            resolved[key] = tag_list

    return resolved, warnings


def _flatten_tag_ids(tag_map: Dict[str, List[Tag]]) -> List[int]:
    out: List[int] = []
    for tags in tag_map.values():
        out.extend([t.id for t in tags])
    return list({*out})


def _collect_content_items(db: Session, tag_ids: List[int], language: Optional[str]) -> List[ContentItem]:
    query = (
        db.query(ContentItem)
        .options(
            selectinload(ContentItem.tags).selectinload(ContentItemTag.tag).selectinload(Tag.category),
            selectinload(ContentItem.area),
        )
        .filter(ContentItem.status != ContentStatus.ARCHIVED.value)
    )
    if language:
        query = query.filter(ContentItem.language == language)
    if tag_ids:
        query = query.join(ContentItemTag).filter(ContentItemTag.tag_id.in_(tag_ids)).distinct()
    return query.all()


def _collect_messaging_blocks(db: Session, tag_ids: List[int], language: Optional[str]) -> List[MessagingBlock]:
    query = (
        db.query(MessagingBlock)
        .options(
            selectinload(MessagingBlock.tags).selectinload(MessagingBlockTag.tag).selectinload(Tag.category)
        )
        .filter(MessagingBlock.status != ContentStatus.ARCHIVED.value)
    )
    if language:
        query = query.filter(MessagingBlock.language == language)
    if tag_ids:
        query = query.join(MessagingBlockTag).filter(MessagingBlockTag.tag_id.in_(tag_ids)).distinct()
    return query.all()


def _tags_by_category(tag_links: List[Any]) -> Dict[str, set]:
    bucket: Dict[str, set] = {}
    for link in tag_links:
        tag = link.tag if hasattr(link, "tag") else None
        if not tag or not tag.category:
            continue
        key = tag.category.key
        bucket.setdefault(key, set()).add(tag.id)
    return bucket


def _score_candidate(
    candidate: Dict[str, Any],
    tag_filters: Dict[str, List[Tag]],
    query_text: str,
) -> float:
    score = STATUS_WEIGHTS.get(candidate["status"], 0.2)

    updated_at = candidate.get("updated_at")
    if isinstance(updated_at, datetime):
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        days = max(0.0, (datetime.now(timezone.utc) - updated_at).total_seconds() / 86400)
        recency = max(0.0, 1.0 - (days / 180.0))
        score += 0.6 * recency

    candidate_tags = candidate.get("tags_by_category", {})
    for cat, tags in tag_filters.items():
        if not tags:
            continue
        requested = {t.id for t in tags}
        matched = requested.intersection(candidate_tags.get(cat, set()))
        if not requested:
            continue
        ratio = len(matched) / len(requested)
        score += WEIGHTS.get(cat, 0.5) * ratio

    sector_tags = tag_filters.get("sector") or []
    use_case_tags = tag_filters.get("use_case") or []
    if sector_tags and use_case_tags:
        sector_ok = {t.id for t in sector_tags}.issubset(candidate_tags.get("sector", set()))
        use_case_ok = {t.id for t in use_case_tags}.issubset(candidate_tags.get("use_case", set()))
        if sector_ok and use_case_ok:
            score += EXACT_MATCH_BONUS

    text = " ".join([candidate.get("title") or "", candidate.get("summary") or "", candidate.get("content") or ""])
    score += 0.5 * _keyword_score(text, query_text)
    return score


def rank_sources(
    db: Session,
    objective: str,
    context: Optional[str],
    tag_filters: Dict[str, List[Tag]],
    language: Optional[str],
    limit: int = 8,
) -> List[Dict[str, Any]]:
    tag_ids = _flatten_tag_ids(tag_filters)
    content_items = _collect_content_items(db, tag_ids, language)
    messaging_blocks = _collect_messaging_blocks(db, tag_ids, language)

    candidates: List[Dict[str, Any]] = []
    for item in content_items:
        content = item.body or ""
        if item.metrics:
            content = f"{content}\n\nMetrics: {item.metrics}"
        candidates.append(
            {
                "source_type": "content_item",
                "source_id": item.id,
                "title": item.title,
                "summary": item.summary or "",
                "content": content,
                "status": item.status,
                "language": item.language,
                "updated_at": item.updated_at,
                "tags_by_category": _tags_by_category(item.tags),
            }
        )
    for block in messaging_blocks:
        candidates.append(
            {
                "source_type": "messaging_block",
                "source_id": block.id,
                "title": block.title,
                "summary": block.summary or "",
                "content": block.content or "",
                "status": block.status,
                "language": block.language,
                "updated_at": block.updated_at,
                "tags_by_category": _tags_by_category(block.tags),
            }
        )

    query_text = " ".join([objective or "", context or ""]).strip()
    for cand in candidates:
        cand["score"] = _score_candidate(cand, tag_filters, query_text)

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:limit]


def coverage_warnings(db: Session, tag_filters: Dict[str, List[Tag]]) -> List[str]:
    warnings: List[str] = []
    sector_tags = tag_filters.get("sector") or []
    use_case_tags = tag_filters.get("use_case") or []
    funnel_tags = tag_filters.get("funnel_stage") or []

    if not sector_tags or not use_case_tags:
        warnings.append("LOW CONFIDENCE: missing sector/use_case filters.")
        return warnings

    required_ids = {t.id for t in sector_tags + use_case_tags}
    case_items = (
        db.query(ContentItem)
        .join(KnowledgeBaseArea, KnowledgeBaseArea.id == ContentItem.area_id)
        .options(selectinload(ContentItem.tags).selectinload(ContentItemTag.tag))
        .filter(KnowledgeBaseArea.key == "case-studies")
        .filter(ContentItem.status == ContentStatus.APPROVED.value)
        .all()
    )
    has_case = False
    for item in case_items:
        tag_ids = {link.tag_id for link in item.tags}
        if required_ids.issubset(tag_ids):
            has_case = True
            break
    if not has_case:
        warnings.append("No approved case study for this sector/use case.")

    if funnel_tags:
        required_funnel = {t.id for t in funnel_tags}
        blocks = (
            db.query(MessagingBlock)
            .options(selectinload(MessagingBlock.tags).selectinload(MessagingBlockTag.tag))
            .filter(MessagingBlock.status == ContentStatus.APPROVED.value)
            .all()
        )
        has_outreach = False
        for block in blocks:
            tag_ids = {link.tag_id for link in block.tags}
            if required_funnel.issubset(tag_ids):
                has_outreach = True
                break
        if not has_outreach:
            warnings.append("No approved outreach block for this funnel stage.")

    return warnings


def _build_prompt(
    objective: str,
    context: Optional[str],
    tag_filters: Dict[str, List[Tag]],
    sources: List[Dict[str, Any]],
) -> List[Dict[str, str]]:
    filters_text = []
    for key, tags in tag_filters.items():
        if tags:
            filters_text.append(f"{key}: {', '.join([t.label for t in tags])}")
    filters_block = "; ".join(filters_text) if filters_text else "none"

    source_blocks = []
    for idx, source in enumerate(sources, start=1):
        snippet = (source.get("content") or "")[:1200]
        source_blocks.append(
            f"[{idx}] {source['source_type']} | {source['title']} | status {source['status']}\n{snippet}"
        )
    source_block = "\n\n".join(source_blocks) if source_blocks else "(no sources)"

    system = (
        "You are Studio Hub's drafting assistant. "
        "Use ONLY the provided sources. Be sector-specific and ROI-driven. "
        "Prioritize approved proof points and metrics. "
        "If sources are insufficient, say what is missing and keep it concise."
    )
    user = (
        f"Objective: {objective}\n"
        f"Context: {context or '(none)'}\n"
        f"Filters: {filters_block}\n\n"
        f"Sources:\n{source_block}\n\n"
        "Draft a response that fits the objective. Use clear, business-ready language."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _fallback_draft(objective: str, sources: List[Dict[str, Any]]) -> str:
    lines = [f"Draft placeholder for: {objective}", "", "Approved sources to reference:"]
    for src in sources[:6]:
        lines.append(f"- {src['source_type']} #{src['source_id']}: {src['title']}")
    return "\n".join(lines).strip()


def generate_draft(
    db: Session,
    objective: str,
    context: Optional[str],
    filters: Dict[str, List[Any]],
    language: Optional[str],
    limit: int = 8,
) -> Dict[str, Any]:
    tag_filters, warnings = resolve_filter_tags(db, filters)
    ranked_sources = rank_sources(db, objective, context, tag_filters, language, limit=limit)
    coverage = coverage_warnings(db, tag_filters)
    warnings.extend([w for w in coverage if w not in warnings])

    has_sector = bool(tag_filters.get("sector"))
    has_use_case = bool(tag_filters.get("use_case"))
    has_sources = len(ranked_sources) > 0
    approved_sources = [s for s in ranked_sources if s["status"] == ContentStatus.APPROVED.value]
    has_approved = len(approved_sources) > 0

    if not has_sources and "No sources found for the current filters." not in warnings:
        warnings.append("No sources found for the current filters.")
    if has_sources and not has_approved and "No approved sources found for the current filters." not in warnings:
        warnings.append("No approved sources found for the current filters.")

    if (not has_sector or not has_use_case) or not has_sources or not has_approved:
        confidence = "LOW"
    elif has_sector and has_use_case and has_approved:
        confidence = "HIGH"
    elif (has_sector or has_use_case) and has_sources:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    draft_text = ""
    if settings.openai_api_key:
        try:
            client = _client()
            messages = _build_prompt(objective, context, tag_filters, ranked_sources)
            resp = client.chat.completions.create(
                model=settings.openai_chat_model,
                messages=messages,
                temperature=0.2,
                max_tokens=700,
            )
            draft_text = resp.choices[0].message.content or ""
        except Exception:
            logger.exception("Draft generation failed; returning fallback.")
            draft_text = _fallback_draft(objective, ranked_sources)
    else:
        draft_text = _fallback_draft(objective, ranked_sources)

    return {
        "draft": draft_text,
        "sources": ranked_sources,
        "warnings": warnings,
        "confidence_label": confidence,
    }


def snapshot_tags(tag_links: List[Any]) -> str:
    tag_ids = [link.tag_id for link in tag_links]
    return json.dumps(tag_ids)
