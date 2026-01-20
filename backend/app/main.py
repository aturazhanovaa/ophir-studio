import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.init_db import init_db

from app.routers import (
    auth,
    areas,
    documents,
    copilot,
    admin,
    analytics,
    access_requests,
    conversations,
    knowledge_base,
    tags,
    integrations,
    ai,
    playground,
    legal,
)

logger = logging.getLogger("app")

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    db: Session = SessionLocal()
    try:
        init_db(db)
    except Exception:
        # Allow the server to start even if DB is unreachable (Render boot, network hiccups).
        # DB-dependent endpoints may fail until DB is available.
        logger.exception("Startup DB init failed (continuing without DB)")
    finally:
        db.close()


# ---------- Routers ----------
app.include_router(auth.router)
app.include_router(areas.router)
app.include_router(documents.router)
app.include_router(copilot.router)
app.include_router(admin.router)
app.include_router(analytics.router)
app.include_router(access_requests.router)
app.include_router(conversations.router)
app.include_router(knowledge_base.router)
app.include_router(tags.router)
app.include_router(integrations.router)
app.include_router(ai.router)
app.include_router(playground.router)
app.include_router(legal.router)


# ---------- Health / Root ----------
@app.get("/")
def root():
    return {
        "status": "ok",
        "service": settings.app_name,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    # Must not depend on DB (Render healthchecks / simple uptime check)
    return {"status": "ok"}


@app.get("/ready")
def ready():
    """
    Optional readiness check:
    - returns ok if DB connection works
    - returns degraded if DB is unavailable
    """
    db: Session = SessionLocal()
    try:
        db.execute("SELECT 1")
        return {"status": "ok", "db": "ok"}
    except Exception:
        logger.exception("Readiness DB check failed")
        return {"status": "degraded", "db": "unavailable"}
    finally:
        db.close()
