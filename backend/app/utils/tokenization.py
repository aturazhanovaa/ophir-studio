from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


def _try_get_tiktoken():
    try:
        import tiktoken  # type: ignore

        return tiktoken
    except Exception:
        return None


def _get_tiktoken_encoding(model: Optional[str]):
    tiktoken = _try_get_tiktoken()
    if not tiktoken:
        return None
    try:
        # Prefer model-specific encoding when possible.
        if model:
            return tiktoken.encoding_for_model(model)
        else:
            return tiktoken.get_encoding("cl100k_base")
    except Exception:
        return tiktoken.get_encoding("cl100k_base")


def estimate_tokens(text: str, model: Optional[str] = None) -> int:
    """
    Best-effort token estimate.
    - Uses tiktoken if installed.
    - Falls back to a conservative heuristic (~4 chars/token).
    """
    if not text:
        return 0

    enc = _get_tiktoken_encoding(model)
    if enc:
        try:
            return len(enc.encode(text))
        except Exception:
            # fall through to heuristic
            pass
    # Heuristic (conservative): ~3 characters per token.
    # This intentionally over-estimates to keep per-request token totals safely under provider limits
    # when tiktoken is unavailable.
    return max(1, (len(text) + 2) // 3)


@dataclass(frozen=True)
class TokenChunk:
    text: str
    est_tokens: int


def split_text_into_token_chunks(
    text: str,
    *,
    model: Optional[str] = None,
    chunk_tokens: int = 1200,
    overlap_tokens: int = 150,
) -> List[TokenChunk]:
    """
    Split text into overlapping chunks sized by tokens.
    If tiktoken is available, splits using real token counts.
    Otherwise falls back to a conservative char-based approximation.
    """
    normalized = (text or "").strip()
    if not normalized:
        return []

    if chunk_tokens <= 0:
        raise ValueError("chunk_tokens must be > 0")
    if overlap_tokens < 0:
        raise ValueError("overlap_tokens must be >= 0")
    if overlap_tokens >= chunk_tokens:
        overlap_tokens = max(0, chunk_tokens // 5)

    enc = _get_tiktoken_encoding(model)
    if not enc:
        # Approximate by characters.
        chunk_chars = max(1, chunk_tokens * 4)
        overlap_chars = max(0, overlap_tokens * 4)
        out: List[TokenChunk] = []
        start = 0
        n = len(normalized)
        while start < n:
            end = min(start + chunk_chars, n)
            piece = normalized[start:end].strip()
            if piece:
                out.append(TokenChunk(piece, estimate_tokens(piece, model=model)))
            if end >= n:
                break
            start = max(end - overlap_chars, end)
        return out

    token_ids = enc.encode(normalized)
    out: List[TokenChunk] = []
    start = 0
    n = len(token_ids)
    while start < n:
        end = min(start + chunk_tokens, n)
        piece_tokens = token_ids[start:end]
        piece = enc.decode(piece_tokens).strip()
        if piece:
            out.append(TokenChunk(piece, len(piece_tokens)))
        if end >= n:
            break
        start = max(end - overlap_tokens, end)
    return out
