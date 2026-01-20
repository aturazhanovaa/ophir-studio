from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.models import Base, MessagingBlock, Tag, TagCategory
from app.db.session import get_db
from app.main import app


def _setup_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)
    session = TestingSession()

    sector = TagCategory(key="sector", name="Sector")
    use_case = TagCategory(key="use_case", name="Use Case")
    session.add_all([sector, use_case])
    session.commit()

    session.add(Tag(category_id=sector.id, key="hospitality", label="Hospitality"))
    session.add(Tag(category_id=use_case.id, key="onboarding", label="Onboarding"))
    session.commit()

    return engine, session


def _db_override(session):
    def _db():
        try:
            yield session
        finally:
            pass

    return _db


def test_notion_upsert_idempotent():
    engine, session = _setup_db()
    app.dependency_overrides[get_db] = _db_override(session)
    settings.integration_key = "test-key"
    client = TestClient(app)

    payload = {
        "page_id": "page-123",
        "last_edited_time": datetime(2024, 1, 1, tzinfo=timezone.utc).isoformat(),
        "title": "Block A",
        "content": "Approved messaging copy.",
        "sector": ["Hospitality"],
        "use_case": ["Onboarding"],
        "status": "Approved",
        "language": "en",
    }

    resp = client.post(
        "/integrations/notion/messaging-blocks/upsert",
        json=payload,
        headers={"X-INTEGRATION-KEY": "test-key"},
    )
    assert resp.status_code == 200
    assert session.query(MessagingBlock).count() == 1

    payload["content"] = "Updated copy"
    payload["last_edited_time"] = datetime(2024, 1, 2, tzinfo=timezone.utc).isoformat()

    resp = client.post(
        "/integrations/notion/messaging-blocks/upsert",
        json=payload,
        headers={"X-INTEGRATION-KEY": "test-key"},
    )
    assert resp.status_code == 200
    assert session.query(MessagingBlock).count() == 1
    updated = session.query(MessagingBlock).first()
    assert updated.content == "Updated copy"

    session.close()
    engine.dispose()
    app.dependency_overrides = {}
