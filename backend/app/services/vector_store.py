import os
from typing import List, Tuple, Optional
import numpy as np
import faiss
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models import Chunk

INDEX_PATH = os.path.join(settings.data_dir, "faiss.index")

def _normalize(v: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(v, axis=1, keepdims=True) + 1e-12
    return v / norms

class FaissVectorStore:
    """
    Simple FAISS store:
    - IndexFlatIP (cosine similarity after normalization)
    - chunk.vector_id stores row position in FAISS index
    """
    def __init__(self, dim: int):
        self.dim = dim
        self.index = self._load_or_create()

    def _load_or_create(self):
        if os.path.exists(INDEX_PATH):
            idx = faiss.read_index(INDEX_PATH)
            return idx
        return faiss.IndexFlatIP(self.dim)

    def persist(self):
        faiss.write_index(self.index, INDEX_PATH)

    def add_vectors(self, vectors: np.ndarray) -> List[int]:
        vectors = vectors.astype("float32")
        vectors = _normalize(vectors)
        start_id = self.index.ntotal
        self.index.add(vectors)
        self.persist()
        return list(range(start_id, start_id + vectors.shape[0]))

    def search(self, query_vec: np.ndarray, top_k: int = 6) -> List[Tuple[int, float]]:
        q = query_vec.astype("float32")
        q = _normalize(q)
        scores, ids = self.index.search(q, top_k)
        out = []
        for vid, score in zip(ids[0].tolist(), scores[0].tolist()):
            if vid == -1:
                continue
            out.append((vid, float(score)))
        return out

def build_vector_store_if_needed(db: Session, dim: int) -> Optional[FaissVectorStore]:
    """
    Local dev fallback: FAISS on disk (SQLite).
    In production (Postgres/Supabase), retrieval uses pgvector stored in the DB,
    so no on-disk vector index is created.
    """
    if settings.is_postgres():
        return None
    return FaissVectorStore(dim=dim)
