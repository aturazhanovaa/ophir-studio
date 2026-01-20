from sqlalchemy.orm import Session
from app.db.models import Document, DocumentVersion, Chunk
from app.utils.text_extract import extract_text_from_bytes
from app.utils.chunking import chunk_text
from app.services.rag import embed_texts
from app.core.config import settings


def ingest_document(db: Session, doc: Document, version: DocumentVersion, file_bytes: bytes) -> int:
    """
    Extract -> chunk -> embed -> store vectors -> persist chunk.vector_id
    Returns number of chunks created.
    """
    text = extract_text_from_bytes(file_bytes, version.original_name)
    chunks = chunk_text(
        text,
        source_name=version.original_name,
        max_tokens=1200,
        overlap_tokens=150,
        token_model=settings.openai_embed_model,
    )

    if not chunks:
        return 0

    payloads = [c["text"] for c in chunks]
    vectors, store = embed_texts(db, payloads)

    # Always persist embeddings to DB (JSON for SQLite; pgvector for Postgres).
    norms = (vectors**2).sum(axis=1, keepdims=True) ** 0.5
    norms = (norms + 1e-12)
    vectors_norm = vectors / norms

    vector_ids = None
    if store is not None:
        vector_ids = store.add_vectors(vectors_norm)

    for i, chunk in enumerate(chunks):
        vid = vector_ids[i] if vector_ids is not None else None
        embedding = vectors_norm[i].astype("float32").tolist()
        db.add(
            Chunk(
                document_id=doc.id,
                version_id=version.id,
                area_id=doc.area_id,
                chunk_index=i,
                content=chunk["text"],
                section=chunk.get("heading_path") or None,
                vector_id=vid,
                embedding=embedding,
                is_latest=True,
            )
        )

    db.commit()
    return len(chunks)
