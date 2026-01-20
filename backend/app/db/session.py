import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger("app.db")

def ensure_data_dirs():
    os.makedirs(settings.data_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.data_dir, "uploads"), exist_ok=True)

ensure_data_dirs()

def _build_engine():
    db_url = (settings.database_url or "").strip()

    # Default to SQLite in the backend working directory for easy Render deploys.
    # Example: sqlite:///./app.db
    if not db_url:
        db_url = "sqlite:///./app.db"
        logger.info("DATABASE_URL not set; using SQLite at ./app.db")

    connect_args = {}
    try:
        url = make_url(db_url)
        driver = (url.drivername or "").lower()

        # Avoid leaking secrets: log only backend type + host/db.
        if driver.startswith("sqlite"):
            logger.info("DB backend: sqlite")
            connect_args = {"check_same_thread": False}
        else:
            host = url.host or ""
            dbname = url.database or ""
            logger.info("DB backend: %s host=%s db=%s", driver, host, dbname)

            # Supabase pooler pitfall: username must be postgres.<project-ref>
            if host.lower().endswith("pooler.supabase.com") and (url.username or "") == "postgres":
                logger.error("Supabase pooler DATABASE_URL username should be 'postgres.<project-ref>' (got 'postgres').")
    except Exception:
        logger.warning("Could not parse DATABASE_URL; attempting to connect anyway")

    try:
        return create_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
    except ModuleNotFoundError as e:
        # If someone left a Postgres DATABASE_URL set but the driver isn't installed,
        # fall back to SQLite so the API can still boot (health checks, etc.).
        msg = str(e).lower()
        if "psycopg2" in msg or "asyncpg" in msg:
            logger.error("DB driver missing for DATABASE_URL; falling back to SQLite at ./app.db (%s)", e)
            return create_engine("sqlite:///./app.db", pool_pre_ping=True, connect_args={"check_same_thread": False})
        raise

engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
