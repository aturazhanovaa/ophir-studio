import re
from typing import Dict, List, Tuple

from app.utils.tokenization import estimate_tokens, split_text_into_token_chunks

DEFAULT_MAX_CHARS = 3600  # ≈ 850-900 tokens
DEFAULT_OVERLAP = 480     # ≈ 110-120 tokens
DEFAULT_MAX_TOKENS = 1200
DEFAULT_OVERLAP_TOKENS = 150


def _is_markdown(source_name: str | None, text: str) -> bool:
    return (source_name or "").lower().endswith(".md") or re.search(r"^#{1,6}\s+\S+", text, re.MULTILINE) is not None


def _split_markdown_blocks(text: str) -> List[Tuple[str, str]]:
    """
    Split markdown into blocks keyed by heading path (H1/H2/H3).
    Returns list of (heading_path, block_text).
    """
    lines = text.splitlines()
    blocks: List[Tuple[str, str]] = []
    heading_stack: List[str] = []
    current: List[str] = []

    def flush():
        if current:
            block_text = "\n".join(current).strip()
            if block_text:
                heading_path = " > ".join(heading_stack)
                blocks.append((heading_path, block_text))
            current.clear()

    for line in lines:
        m = re.match(r"^(#{1,6})\s+(.*)", line.strip())
        if m:
            flush()
            level = len(m.group(1))
            title = m.group(2).strip()
            heading_stack = heading_stack[: level - 1] + [title]
            continue
        current.append(line)
    flush()
    return [(h, b) for h, b in blocks if b.strip()]


def _split_paragraphs(text: str) -> List[Tuple[str, str]]:
    return [("", p.strip()) for p in re.split(r"\n\s*\n", text) if p.strip()]


def _slice_long(text: str, max_chars: int, overlap: int) -> List[str]:
    """
    Slice a single long paragraph into smaller overlapping windows using natural breakpoints.
    """
    pieces: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + max_chars, n)
        cut = end
        for sep in ["\n\n", "\n", ". "]:
            idx = text.rfind(sep, start, end)
            if idx != -1 and idx > start + 200:
                cut = idx + len(sep)
                break
        chunk = text[start:cut].strip()
        if chunk:
            pieces.append(chunk)
        if cut >= n:
            break
        start = max(cut - overlap, cut)
    return pieces


def chunk_text(
    text: str,
    source_name: str | None = None,
    max_chars: int = DEFAULT_MAX_CHARS,
    overlap: int = DEFAULT_OVERLAP,
    max_tokens: int | None = DEFAULT_MAX_TOKENS,
    overlap_tokens: int | None = DEFAULT_OVERLAP_TOKENS,
    token_model: str | None = None,
) -> List[Dict[str, str]]:
    """
    Headings-aware chunker:
    - Markdown: group by H1/H2/H3 blocks
    - Plain text: paragraph-based
    - Target ~600–900 tokens with ~100 token overlap
    Returns list of dicts: {text, heading_path}
    """
    normalized = (text or "").replace("\r\n", "\n").strip()
    if not normalized:
        return []

    blocks = _split_markdown_blocks(normalized) if _is_markdown(source_name, normalized) else _split_paragraphs(normalized)

    chunks: List[Dict[str, str]] = []
    buffer = ""
    buffer_heading = ""
    last_heading = ""

    def flush():
        nonlocal buffer, buffer_heading
        if buffer.strip():
            chunks.append({"text": buffer.strip(), "heading_path": buffer_heading.strip()})
        buffer = ""
        buffer_heading = last_heading

    for heading_path, block_text in blocks:
        if heading_path:
            last_heading = heading_path
        heading_for_block = heading_path or last_heading
        paragraph = block_text.strip()
        if not paragraph:
            continue

        if len(paragraph) > max_chars:
            # split the long block and flush any buffered content first
            flush()
            for piece in _slice_long(paragraph, max_chars, overlap):
                chunks.append({"text": piece, "heading_path": heading_for_block})
            continue

        if not buffer:
            buffer_heading = heading_for_block
            buffer = paragraph
            continue

        if len(buffer) + len(paragraph) + 2 <= max_chars:
            buffer = f"{buffer}\n\n{paragraph}"
            buffer_heading = buffer_heading or heading_for_block
        else:
            flush()
            tail = buffer[-overlap:] if overlap > 0 else ""
            buffer = f"{tail}\n\n{paragraph}".strip()
            buffer_heading = heading_for_block

    flush()

    # Final safeguard: ensure each chunk is reasonably sized in tokens.
    if max_tokens and max_tokens > 0:
        expanded: List[Dict[str, str]] = []
        for c in chunks:
            t = c.get("text", "")
            est = estimate_tokens(t, model=token_model)
            if est <= max_tokens:
                expanded.append(c)
                continue
            pieces = split_text_into_token_chunks(
                t,
                model=token_model,
                chunk_tokens=max_tokens,
                overlap_tokens=overlap_tokens or 0,
            )
            for p in pieces:
                expanded.append({"text": p.text, "heading_path": c.get("heading_path", "")})
        chunks = expanded

    return chunks
