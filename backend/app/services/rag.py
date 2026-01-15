import hashlib
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from openai import BadRequestError, OpenAI
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AccuracyLevel, AnswerTone, Chunk, Document
from app.services.vector_store import build_vector_store_if_needed
from app.ai.tone_guides import get_tone_guide
from app.utils.tokenization import estimate_tokens, split_text_into_token_chunks

logger = logging.getLogger(__name__)

VECTOR_WEIGHT = 0.7
KEYWORD_WEIGHT = 0.3
RETRIEVAL_CACHE_TTL = 45  # seconds
EMBED_CACHE_PATH = os.path.join(settings.data_dir, "embed_cache.json")
MIN_GROUNDED_SCORE = 0.25
MAX_CHUNKS_PER_DOCUMENT = 3
EMBED_MAX_TOKENS_PER_REQUEST = 250_000  # safety buffer under provider limit
EMBED_MAX_INPUT_TOKENS = 1_500
EMBED_MAX_BATCH_SIZE = 64

_embed_cache: Dict[str, List[float]] = {}
_retrieval_cache: Dict[str, Dict[str, Any]] = {}


if os.path.exists(EMBED_CACHE_PATH):
    try:
        with open(EMBED_CACHE_PATH, "r") as f:
            _embed_cache = json.load(f)
    except Exception:
        _embed_cache = {}


def _persist_embed_cache():
    try:
        os.makedirs(os.path.dirname(EMBED_CACHE_PATH), exist_ok=True)
        with open(EMBED_CACHE_PATH, "w") as f:
            json.dump(_embed_cache, f)
    except Exception:
        logger.debug("Failed to persist embed cache", exc_info=True)


def _client() -> OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required.")
    return OpenAI(api_key=settings.openai_api_key)


def normalize_query(query: str) -> str:
    return re.sub(r"\s+", " ", (query or "").strip().lower())


def _keyword_score(query_terms: List[str], text: str):
    text_lower = text.lower()
    score = 0
    highlights = []
    for term in query_terms:
        if not term:
            continue
        term_lower = term.lower()
        matches = [m for m in re.finditer(re.escape(term_lower), text_lower)]
        if matches:
            score += 1
            for m in matches:
                highlights.append({"start": m.start(), "end": m.end()})
    denom = len(query_terms) or 1
    return score / denom, highlights


def _embed_cache_key(model: str, text: str) -> str:
    return f"{model}:{hashlib.sha1(text.encode('utf-8')).hexdigest()}"


def _is_token_limit_error(err: Exception) -> bool:
    msg = str(err).lower()
    return "max" in msg and "tokens" in msg and ("per request" in msg or "per_request" in msg or "max" in msg)


def _plan_embedding_batches(
    items: List[Tuple[int, str, int]],
    *,
    max_items: int = EMBED_MAX_BATCH_SIZE,
    max_tokens: int = EMBED_MAX_TOKENS_PER_REQUEST,
) -> List[List[Tuple[int, str, int]]]:
    """
    items: list of (original_index, text, est_tokens)
    Returns list of batches, each constrained by max_items and max_tokens.
    """
    batches: List[List[Tuple[int, str, int]]] = []
    current: List[Tuple[int, str, int]] = []
    current_tokens = 0

    for it in items:
        _, _, tok = it
        # Always make progress, even if a single item is huge.
        if current and (len(current) >= max_items or current_tokens + tok > max_tokens):
            batches.append(current)
            current = []
            current_tokens = 0
        current.append(it)
        current_tokens += tok

    if current:
        batches.append(current)
    return batches


def _embed_with_retries(client: OpenAI, model: str, batch: List[Tuple[int, str, int]]):
    """
    Returns list of (original_index, embedding_vector_list[float]).
    Retries by splitting the batch when token-per-request errors occur.
    """
    if not batch:
        return []

    inputs = [t for _, t, _ in batch]
    try:
        res = client.embeddings.create(model=model, input=inputs)
        return [(idx, out.embedding) for (idx, _, _), out in zip(batch, res.data)]
    except BadRequestError as e:
        if _is_token_limit_error(e) and len(batch) > 1:
            mid = max(1, len(batch) // 2)
            left = _embed_with_retries(client, model, batch[:mid])
            right = _embed_with_retries(client, model, batch[mid:])
            return left + right

        # Single-input safety: if this still triggers a token error, split further and average.
        if _is_token_limit_error(e) and len(batch) == 1:
            idx, text, _ = batch[0]
            logger.warning(
                "Embedding input too large for provider; splitting and averaging embeddings (idx=%s, est_tokens=%s)",
                idx,
                estimate_tokens(text, model=model),
            )
            parts = split_text_into_token_chunks(text, model=model, chunk_tokens=EMBED_MAX_INPUT_TOKENS, overlap_tokens=150)
            if not parts:
                raise
            part_vectors: List[np.ndarray] = []
            for sub_batch in _plan_embedding_batches([(0, p.text, p.est_tokens) for p in parts], max_items=EMBED_MAX_BATCH_SIZE, max_tokens=EMBED_MAX_TOKENS_PER_REQUEST):
                sub_inputs = [t for _, t, _ in sub_batch]
                sub_res = client.embeddings.create(model=model, input=sub_inputs)
                for out in sub_res.data:
                    part_vectors.append(np.array(out.embedding, dtype="float32"))
            avg = np.mean(np.vstack(part_vectors), axis=0)
            return [(idx, avg.astype("float32").tolist())]

        raise


def embed_texts(db: Session, texts: List[str]) -> Tuple[np.ndarray, Any]:
    """
    Returns (vectors, store) with simple on-disk caching for unchanged chunks.
    """
    client = _client()
    model = settings.openai_embed_model
    vectors: List[Optional[np.ndarray]] = [None] * len(texts)
    missing: List[Tuple[int, str, int]] = []

    for idx, text in enumerate(texts):
        key = _embed_cache_key(model, text)
        cached = _embed_cache.get(key)
        if cached:
            vectors[idx] = np.array(cached, dtype="float32")
        else:
            est = estimate_tokens(text, model=model)
            # Oversized single inputs should have been chunked earlier, but guard anyway.
            if est > EMBED_MAX_INPUT_TOKENS:
                logger.info("Oversized chunk detected (idx=%s, est_tokens=%s); will split if needed", idx, est)
            missing.append((idx, text, est))

    if missing:
        total_missing_tokens = sum(t for _, _, t in missing)
        batches = _plan_embedding_batches(missing, max_items=EMBED_MAX_BATCH_SIZE, max_tokens=EMBED_MAX_TOKENS_PER_REQUEST)
        logger.info(
            "Embedding: cached=%s missing=%s planned_batches=%s est_missing_tokens=%s",
            len(texts) - len(missing),
            len(missing),
            len(batches),
            total_missing_tokens,
        )

        filled: List[Tuple[int, List[float], str]] = []
        for bi, batch in enumerate(batches, start=1):
            batch_tokens = sum(t for _, _, t in batch)
            max_item = max((t for _, _, t in batch), default=0)
            logger.info(
                "Embedding batch %s/%s: items=%s est_tokens=%s max_item_tokens=%s",
                bi,
                len(batches),
                len(batch),
                batch_tokens,
                max_item,
            )

            outs = _embed_with_retries(client, model, batch)
            emb_by_idx = {idx: emb for idx, emb in outs}
            for target_idx, raw_text, _ in batch:
                embedding = emb_by_idx.get(target_idx)
                if embedding is None:
                    raise RuntimeError(f"Missing embedding for index {target_idx} in batch {bi}")
                filled.append((target_idx, embedding, raw_text))

        for target_idx, embedding, raw_text in filled:
            vec = np.array(embedding, dtype="float32")
            vectors[target_idx] = vec
            key = _embed_cache_key(model, raw_text)
            _embed_cache[key] = embedding
        _persist_embed_cache()

    if any(v is None for v in vectors):
        raise RuntimeError("Embedding generation failed for one or more chunks.")

    vectors_np = np.vstack(vectors)  # type: ignore[arg-type]
    dim = vectors_np.shape[1]
    store = build_vector_store_if_needed(db, dim=dim)
    return vectors_np, store


def embed_query(db: Session, query: str):
    vecs, store = embed_texts(db, [query])
    return vecs[0:1], store


def _get_chunks_for_vectors(db: Session, vector_ids: List[int], area_ids: List[int]) -> List[Chunk]:
    if not vector_ids:
        return []
    return (
        db.query(Chunk)
        .join(Document, Document.id == Chunk.document_id)
        .filter(Chunk.vector_id.in_(vector_ids))
        .filter(Chunk.area_id.in_(area_ids))
        .filter(Chunk.is_latest.is_(True))
        .filter(Document.deleted_at.is_(None))
        .all()
    )


def retrieve_candidates(db: Session, query: str, area_ids: List[int], vec_top_k: int = 20) -> List[Dict[str, Any]]:
    """
    Stage 1 retrieval: vector search + lexical boost, area-scoped.
    """
    normalized = normalize_query(query)
    query_terms = [t.strip() for t in re.split(r"[\\s,]+", normalized) if len(t.strip()) > 2]

    # If embeddings are unavailable, fall back to keyword-only retrieval.
    if not settings.openai_api_key:
        keyword_filters = [Chunk.content.ilike(f"%{term}%") for term in query_terms]
        ranked: List[Dict[str, Any]] = []
        if keyword_filters:
            fallbacks = (
                db.query(Chunk)
                .join(Document, Document.id == Chunk.document_id)
                .filter(Chunk.area_id.in_(area_ids))
                .filter(Chunk.is_latest.is_(True))
                .filter(Document.deleted_at.is_(None))
                .filter(or_(*keyword_filters))
                .limit(max(10, vec_top_k))
                .all()
            )
            for c in fallbacks:
                kw_score, highlights = _keyword_score(query_terms, c.content)
                ranked.append(
                    {
                        "chunk_id": c.id,
                        "chunk_index": c.chunk_index,
                        "chunk_text": c.content,
                        "heading_path": c.section or "",
                        "document_id": c.document_id,
                        "document_title": c.document.title if c.document else None,
                        "version_id": c.version_id,
                        "area_id": c.area_id,
                        "area_name": c.document.area.name if c.document and c.document.area else None,
                        "area_color": c.document.area.color if c.document and c.document.area else None,
                        "vector_score": 0.0,
                        "keyword_score": float(kw_score),
                        "hybrid_score": float(kw_score),
                        "highlights": highlights,
                    }
                )
            ranked.sort(key=lambda item: item["hybrid_score"], reverse=True)
        return ranked

    qvec, store = embed_query(db, normalized)
    hits = store.search(qvec, top_k=max(vec_top_k, 20))

    score_by_vid = {vid: score for vid, score in hits}
    vids = list(score_by_vid.keys())

    ranked: List[Dict[str, Any]] = []
    chunks = _get_chunks_for_vectors(db, vids, area_ids)
    for c in chunks:
        vec_score = score_by_vid.get(c.vector_id, 0.0)
        vec_score = max(0.0, (vec_score + 1.0) / 2.0)  # normalize cosine to 0..1
        kw_score, highlights = _keyword_score(query_terms, c.content)
        hybrid = VECTOR_WEIGHT * vec_score + KEYWORD_WEIGHT * kw_score
        ranked.append(
            {
                "chunk_id": c.id,
                "chunk_index": c.chunk_index,
                "chunk_text": c.content,
                "heading_path": c.section or "",
                "document_id": c.document_id,
                "document_title": c.document.title if c.document else None,
                "version_id": c.version_id,
                "area_id": c.area_id,
                "area_name": c.document.area.name if c.document and c.document.area else None,
                "area_color": c.document.area.color if c.document and c.document.area else None,
                "vector_score": float(vec_score),
                "keyword_score": float(kw_score),
                "hybrid_score": float(hybrid),
                "highlights": highlights,
            }
        )

    ranked.sort(key=lambda item: item["hybrid_score"], reverse=True)

    if ranked:
        return ranked

    # Fallback lexical search if vectors return nothing (rare / cold start)
    keyword_filters = [Chunk.content.ilike(f"%{term}%") for term in query_terms]
    if keyword_filters:
        fallbacks = (
            db.query(Chunk)
            .join(Document, Document.id == Chunk.document_id)
            .filter(Chunk.area_id.in_(area_ids))
            .filter(Chunk.is_latest.is_(True))
            .filter(Document.deleted_at.is_(None))
            .filter(or_(*keyword_filters))
            .limit(max(5, vec_top_k))
            .all()
        )
        for c in fallbacks:
            kw_score, highlights = _keyword_score(query_terms, c.content)
            ranked.append(
                {
                    "chunk_id": c.id,
                    "chunk_index": c.chunk_index,
                    "chunk_text": c.content,
                    "heading_path": c.section or "",
                    "document_id": c.document_id,
                    "document_title": c.document.title if c.document else None,
                    "version_id": c.version_id,
                    "area_id": c.area_id,
                    "area_name": c.document.area.name if c.document and c.document.area else None,
                    "area_color": c.document.area.color if c.document and c.document.area else None,
                    "vector_score": 0.0,
                    "keyword_score": float(kw_score),
                    "hybrid_score": float(kw_score),
                    "highlights": highlights,
                }
            )
        ranked.sort(key=lambda item: item["hybrid_score"], reverse=True)
    return ranked


def rerank_candidates(
    client: OpenAI, query: str, candidates: List[Dict[str, Any]], target_n: int
) -> Optional[Dict[int, float]]:
    """
    Lightweight LLM reranker. Returns map of chunk_id -> score.
    """
    if not candidates:
        return None

    snippets = []
    for idx, cand in enumerate(candidates[: max(target_n * 2, target_n + 2)]):
        text = cand["chunk_text"]
        snippets.append(f"[{cand['chunk_id']}] {text[:400].strip()}")

    prompt = (
        "Rank the following snippets by relevance to the query. "
        "Return a JSON array of objects with keys 'id' and 'score' (0-1). "
        f"Keep only the top {target_n}."
    )
    user_msg = f"Query: {query}\nSnippets:\n" + "\n\n".join(snippets)

    try:
        resp = client.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[{"role": "system", "content": prompt}, {"role": "user", "content": user_msg}],
            temperature=0,
            max_tokens=150,
        )
        content = resp.choices[0].message.content or ""
        match = re.search(r"\[.*\]", content, re.DOTALL)
        data = json.loads(match.group(0) if match else content)
        scores = {}
        for item in data:
            cid = int(item.get("id"))
            score = float(item.get("score", 0))
            scores[cid] = max(0.0, min(1.0, score))
        return scores
    except Exception:
        logger.debug("Rerank failed; falling back to hybrid scores", exc_info=True)
        return None


def _apply_rerank(candidates: List[Dict[str, Any]], rerank_scores: Optional[Dict[int, float]]) -> List[Dict[str, Any]]:
    for cand in candidates:
        cand["rerank_score"] = rerank_scores.get(cand["chunk_id"]) if rerank_scores else None
        cand["score"] = cand["rerank_score"] if cand["rerank_score"] is not None else cand["hybrid_score"]
    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates


def _dedupe_ranked(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    per_doc: Dict[int, int] = {}
    out: List[Dict[str, Any]] = []

    def fp(text: str) -> str:
        norm = re.sub(r"\s+", " ", (text or "").strip().lower())
        return hashlib.sha1(norm.encode("utf-8")).hexdigest()

    for cand in candidates:
        doc_id = cand.get("document_id")
        if isinstance(doc_id, int) and per_doc.get(doc_id, 0) >= MAX_CHUNKS_PER_DOCUMENT:
            continue
        fingerprint = fp(cand.get("chunk_text") or "")
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        out.append(cand)
        if isinstance(doc_id, int):
            per_doc[doc_id] = per_doc.get(doc_id, 0) + 1
    return out


def _render_sources_section(sources: List[Dict[str, Any]]) -> str:
    if not sources:
        return "Sources:\n- (no matching sources found)"
    lines = ["Sources:"]
    for s in sources[:8]:
        title = s.get("document_title") or f"Document {s.get('document_id')}"
        chunk_index = s.get("chunk_index")
        heading = s.get("heading_path") or ""
        detail = f"chunk {chunk_index}" if chunk_index is not None else "chunk"
        if heading:
            detail = f"{detail} · {heading}"
        lines.append(f"- {title} ({detail})")
    return "\n".join(lines)


def build_prompt_style(accuracy_level: AccuracyLevel, answer_tone: AnswerTone) -> str:
    guide = get_tone_guide(answer_tone)
    if accuracy_level == AccuracyLevel.HIGH:
        accuracy_block = (
            "Accuracy: HIGH. Use only evidence from the snippets. Double-check consistency. "
            "If the snippets do not clearly answer, respond with 'Not enough info in the documents' and ask for missing info. "
            "Always include Sources."
        )
    elif accuracy_level == AccuracyLevel.LOW:
        accuracy_block = (
            "Accuracy: LOW. Prefer brevity and speed, but stay grounded in the snippets. Always include Sources."
        )
    else:
        accuracy_block = (
            "Accuracy: MEDIUM. Balance speed and faithfulness. Note assumptions explicitly and cite when possible."
        )

    rules_block = "\n".join([f"- {r}" for r in guide.rules])
    fmt = guide.formatting
    formatting_block = (
        f"- Use sections in this order: {', '.join(fmt.headings)}.\n"
        f"- {fmt.key_takeaway_label} stays to one sentence; {fmt.next_steps_label} must name an owner/time.\n"
        f"- Max bullets: {fmt.max_bullets}; Max sentences: {fmt.max_sentences}; Use {fmt.sentence_length}."
    )

    return (
        f"{accuracy_block} Tone: {guide.name}. "
        f"Reference: {guide.reference_summary}\n"
        f"Rules:\n{rules_block}\n"
        f"Formatting:\n{formatting_block}\n"
        f"Answer using this template (adapt to context but keep headings):\n{guide.template}"
    )


def _evidence_level(best_score: float, count: int) -> str:
    if count == 0 or best_score < 0.22:
        return "low"
    if best_score < 0.45:
        return "medium"
    return "high"


def _confidence_from_evidence(sources: List[Dict[str, Any]], best_score: Optional[float]) -> Dict[str, Any]:
    if not sources:
        return {
            "percent": 12,
            "label": "LOW",
            "explanation": "No supporting snippets retrieved for this answer.",
        }

    best = max(0.0, min(1.0, best_score or 0.0))
    source_count = len(sources)
    doc_count = len({s.get("document_id") for s in sources if s.get("document_id") is not None}) or 1
    coverage = sum(1 for s in sources if s.get("highlights")) / source_count
    diversity = min(doc_count, 3) / 3
    density = min(source_count, 6) / 6

    # Weighted mix of retrieval strength, citation coverage, and doc diversity.
    raw = (0.5 * best) + (0.3 * coverage) + (0.2 * ((diversity + density) / 2))
    percent = int(max(0.0, min(1.0, raw)) * 100)
    label = "LOW" if percent < 50 else ("MEDIUM" if percent < 75 else "HIGH")
    explanation = (
        f"Based on {source_count} chunk(s) across {doc_count} doc(s); best match score {best:.2f}; "
        f"citation coverage {coverage:.2f}."
    )
    return {"percent": percent, "label": label, "explanation": explanation}


def answer_with_rag(
    db: Session,
    query: str,
    area_ids: List[int],
    top_k: int = 6,
    accuracy_level: AccuracyLevel = AccuracyLevel.MEDIUM,
    answer_tone: AnswerTone = AnswerTone.C_EXECUTIVE,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    retrieval_start = time.time()
    normalized_query = normalize_query(query)
    accuracy_percent_map = {AccuracyLevel.HIGH: 92, AccuracyLevel.MEDIUM: 85, AccuracyLevel.LOW: 75}
    accuracy_percent = accuracy_percent_map.get(accuracy_level, 85)
    cache_key = f"{normalized_query}::{'|'.join(map(str, sorted(area_ids)))}::{accuracy_level.value}"

    cached = _retrieval_cache.get(cache_key)
    if cached and (time.time() - cached["ts"]) < RETRIEVAL_CACHE_TTL:
        candidates = cached["candidates"]
    else:
        candidates = retrieve_candidates(db, normalized_query, area_ids, vec_top_k=max(20, top_k * 3))
        _retrieval_cache[cache_key] = {"ts": time.time(), "candidates": candidates}

    retrieval_ms = int((time.time() - retrieval_start) * 1000)

    rerank_ms = 0
    ranked: List[Dict[str, Any]]
    if settings.openai_api_key:
        client = _client()
        rerank_target = {AccuracyLevel.HIGH: 8, AccuracyLevel.MEDIUM: 6, AccuracyLevel.LOW: 4}[accuracy_level]
        rerank_start = time.time()
        rerank_scores = rerank_candidates(client, normalized_query, candidates, rerank_target)
        rerank_ms = int((time.time() - rerank_start) * 1000)
        ranked = _apply_rerank(list(candidates), rerank_scores)
    else:
        ranked = list(candidates)
        for c in ranked:
            c["score"] = c.get("hybrid_score", 0.0)
        ranked.sort(key=lambda c: c.get("score", 0.0), reverse=True)

    ranked = _dedupe_ranked(ranked)
    top_context = ranked[:top_k]
    best_score = top_context[0]["score"] if top_context else 0.0
    evidence_level = _evidence_level(best_score, len(top_context))
    tone_guide = get_tone_guide(answer_tone)

    sources = [
        {
            "chunk_id": c["chunk_id"],
            "document_id": c["document_id"],
            "document_title": c["document_title"],
            "version_id": c["version_id"],
            "chunk_index": c["chunk_index"],
            "chunk_text": c["chunk_text"],
            "heading_path": c.get("heading_path") or "",
            "score": float(c["score"]),
            "area_id": c.get("area_id"),
            "area_name": c.get("area_name"),
            "area_color": c.get("area_color"),
            "highlights": c.get("highlights", []),
        }
        for c in top_context
    ]
    confidence = _confidence_from_evidence(sources, best_score)

    if not top_context or best_score < MIN_GROUNDED_SCORE:
        msg = (
            "I couldn’t find enough relevant information in the knowledge base to answer that. "
            "Try naming the area, document title, or a specific keyword, and I’ll search again."
        )
        return {
            "answer": f"{msg}\n\n{_render_sources_section(sources)}",
            "sources": sources,
            "matches": sources,
            "best_score": float(best_score),
            "usage": {"prompt_tokens": None, "completion_tokens": None, "total_tokens": None},
            "meta": {
                "accuracy_level": accuracy_level.value,
                "answer_tone": answer_tone.value,
                "evidence_level": evidence_level,
                "tone_reference": tone_guide.reference_summary,
                "tone_preview": tone_guide.preview,
                "confidence_percent": confidence["percent"],
                "confidence_label": confidence["label"],
                "confidence_explanation": confidence["explanation"],
                "accuracy_percent": accuracy_percent,
                "timings": {"retrieval_ms": retrieval_ms, "rerank_ms": rerank_ms},
                "areas": [
                    {
                        "id": c.get("area_id"),
                        "name": c.get("area_name"),
                        "color": c.get("area_color"),
                    }
                    for c in top_context
                    if c.get("area_id") is not None
                ],
            },
        }

    if not settings.openai_api_key:
        excerpts = []
        for s in sources[: min(3, len(sources))]:
            excerpt = (s.get("chunk_text") or "").strip()
            if excerpt:
                excerpts.append(excerpt[:420])
        answer = "Based on the retrieved snippets:" if excerpts else "No excerpt text available."
        if excerpts:
            answer = answer + "\n" + "\n".join([f"- {e}" for e in excerpts])
        return {
            "answer": f"{answer}\n\n{_render_sources_section(sources)}",
            "sources": sources,
            "matches": sources,
            "best_score": float(best_score),
            "usage": {"prompt_tokens": None, "completion_tokens": None, "total_tokens": None},
            "meta": {
                "accuracy_level": accuracy_level.value,
                "answer_tone": answer_tone.value,
                "evidence_level": evidence_level,
                "tone_reference": tone_guide.reference_summary,
                "tone_preview": tone_guide.preview,
                "confidence_percent": confidence["percent"],
                "confidence_label": confidence["label"],
                "confidence_explanation": confidence["explanation"],
                "accuracy_percent": accuracy_percent,
                "timings": {"retrieval_ms": retrieval_ms, "rerank_ms": rerank_ms, "generation_ms": 0},
                "areas": [
                    {"id": c.get("area_id"), "name": c.get("area_name"), "color": c.get("area_color")}
                    for c in top_context
                    if c.get("area_id") is not None
                ],
            },
        }

    context_blocks = []
    for idx, c in enumerate(top_context, start=1):
        heading_label = f" • {c['heading_path']}" if c.get("heading_path") else ""
        context_blocks.append(
            f"[{idx}] Doc {c['document_title'] or c['document_id']} (v{c.get('version_id') or '-'})"
            f"{heading_label} — chunk {c['chunk_index']}\n{c['chunk_text']}"
        )
    context = "\n\n".join(context_blocks).strip() or "(no context retrieved)"

    fmt = tone_guide.formatting
    system = (
        "You are the Studio Knowledge Copilot. Use ONLY the provided context; do not invent facts. "
        "If the question cannot be answered from context, say so clearly. "
        f"Use headings in this order: {', '.join(fmt.headings)}. "
        f"Keep bullets to {fmt.max_bullets} or fewer, sentences {fmt.max_sentences} or fewer, and use {fmt.sentence_length}. "
        "Always end with a 'Sources' section listing the referenced docs/chunks."
        + build_prompt_style(accuracy_level, answer_tone)
        + "\n\nAppend this final section:\nSources:\n- <document title> (chunk N)\n"
    )
    user_msg = f"Question: {query}\n\nContext:\n{context}"

    messages = [{"role": "system", "content": system}]
    history = chat_history or []
    for msg in history[-12:]:
        role = msg.get("role")
        content = (msg.get("content") or "").strip()
        if role not in ("user", "assistant", "system") or not content:
            continue
        messages.append({"role": role, "content": content[:2000]})
    messages.append({"role": "user", "content": user_msg})

    gen_start = time.time()
    resp = client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
        temperature=0.15 if accuracy_level == AccuracyLevel.HIGH else (0.25 if accuracy_level == AccuracyLevel.MEDIUM else 0.35),
    )
    generation_ms = int((time.time() - gen_start) * 1000)

    answer = (resp.choices[0].message.content or "").strip()
    if "sources" not in answer.lower():
        answer = f"{answer}\n\n{_render_sources_section(sources)}"
    usage = getattr(resp, "usage", None)
    usage_block = {
        "prompt_tokens": getattr(usage, "prompt_tokens", None) if usage else None,
        "completion_tokens": getattr(usage, "completion_tokens", None) if usage else None,
        "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
    }

    logger.debug(
        "RAG timings | retrieval=%sms rerank=%sms generation=%sms evidence=%s",
        retrieval_ms,
        rerank_ms,
        generation_ms,
        evidence_level,
    )

    return {
        "answer": answer,
        "sources": sources,
        "matches": sources,  # backward compatibility
        "best_score": float(best_score),
        "usage": usage_block,
        "meta": {
            "accuracy_level": accuracy_level.value,
            "answer_tone": answer_tone.value,
            "evidence_level": evidence_level,
            "tone_reference": tone_guide.reference_summary,
            "tone_preview": tone_guide.preview,
            "confidence_percent": confidence["percent"],
            "confidence_label": confidence["label"],
            "confidence_explanation": confidence["explanation"],
            "timings": {
                "retrieval_ms": retrieval_ms,
                "rerank_ms": rerank_ms,
                "generation_ms": generation_ms,
            },
            "accuracy_percent": accuracy_percent,
            "areas": [
                {
                    "id": c.get("area_id"),
                    "name": c.get("area_name"),
                    "color": c.get("area_color"),
                }
                for c in top_context
                if c.get("area_id") is not None
            ],
        },
    }
