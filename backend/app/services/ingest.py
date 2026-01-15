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
    vector_ids = store.add_vectors(vectors)

    for i, (chunk, vid) in enumerate(zip(chunks, vector_ids)):
        db.add(
            Chunk(
                document_id=doc.id,
                version_id=version.id,
                area_id=doc.area_id,
                chunk_index=i,
                content=chunk["text"],
                section=chunk.get("heading_path") or None,
                vector_id=vid,
                is_latest=True,
            )
        )

    db.commit()
    return len(chunks)
