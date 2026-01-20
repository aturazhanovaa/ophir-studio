import logging
from typing import List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_NOTION_TEXT = 1800


def _split_text(text: str, max_len: int = MAX_NOTION_TEXT) -> List[str]:
    chunks: List[str] = []
    for block in (text or "").split("\n\n"):
        chunk = block.strip()
        if not chunk:
            continue
        while len(chunk) > max_len:
            chunks.append(chunk[:max_len])
            chunk = chunk[max_len:]
        if chunk:
            chunks.append(chunk)
    if not chunks:
        chunks.append("")
    return chunks


def _build_rich_text(content: str) -> List[dict]:
    return [{"type": "text", "text": {"content": content}}]


def append_draft_to_page(page_id: str, draft_text: str, heading: str = "Draft") -> dict:
    if not settings.notion_api_key:
        raise RuntimeError("NOTION_API_KEY is required to write back to Notion.")

    url = f"{settings.notion_api_base}/blocks/{page_id}/children"
    headers = {
        "Authorization": f"Bearer {settings.notion_api_key}",
        "Notion-Version": settings.notion_api_version,
        "Content-Type": "application/json",
    }

    paragraphs = _split_text(draft_text)
    children = [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": _build_rich_text(heading)},
        }
    ]
    for paragraph in paragraphs:
        children.append(
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": _build_rich_text(paragraph)},
            }
        )

    payload = {"children": children}
    with httpx.Client(timeout=15) as client:
        resp = client.patch(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            logger.warning("Notion writeback failed: %s %s", resp.status_code, resp.text)
            raise RuntimeError(f"Notion writeback failed: {resp.status_code}")
        return resp.json()
