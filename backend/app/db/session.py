import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

def ensure_data_dirs():
    os.makedirs(settings.data_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.data_dir, "uploads"), exist_ok=True)

ensure_data_dirs()

def _build_engine():
    if settings.database_url:
        # Render/Supabase Postgres
        return create_engine(settings.database_url, pool_pre_ping=True)

    # Local SQLite fallback
    db_path = os.path.join(settings.data_dir, "app.db")
    return create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
