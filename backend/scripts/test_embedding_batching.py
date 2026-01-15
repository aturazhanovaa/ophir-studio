"""
Simple sanity script for embedding batching (no OpenAI calls).

Run:
  python backend/scripts/test_embedding_batching.py
"""

from app.services.rag import _plan_embedding_batches, EMBED_MAX_TOKENS_PER_REQUEST
from app.utils.tokenization import estimate_tokens


def main():
    # Simulate a large document: many medium chunks.
    model = "text-embedding-3-large"
    texts = ["x" * 3600] * 800  # ~800 chunks
    items = [(i, t, estimate_tokens(t, model=model)) for i, t in enumerate(texts)]
    batches = _plan_embedding_batches(items, max_items=64, max_tokens=250_000)

    assert batches, "expected at least one batch"
    for b in batches:
        total = sum(tok for _, _, tok in b)
        assert total <= 250_000 or len(b) == 1, f"batch too large: {total}"
    est_total = sum(tok for _, _, tok in items)
    print("OK")
    print("chunks:", len(items))
    print("est_total_tokens:", est_total)
    print("planned_batches:", len(batches))
    print("max_tokens_per_request:", EMBED_MAX_TOKENS_PER_REQUEST)


if __name__ == "__main__":
    main()

