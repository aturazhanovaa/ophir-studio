from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.models import Base, KnowledgeBaseArea, Tag, TagCategory, User
from app.db.session import get_db
from app.main import app
from app.utils.tag_validation import TagValidationError, validate_content_item_tags


def _setup_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)
    session = TestingSession()
    return engine, session


def _db_override(session):
    def _db():
        try:
            yield session
        finally:
            pass

    return _db


def _auth_headers(user_id: int) -> dict:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


def test_validate_content_item_tags_rejects_invalid_category():
    engine, session = _setup_db()
    try:
        sector = TagCategory(key="sector", name="Sector")
        internal = TagCategory(key="internal", name="Internal")
        session.add_all([sector, internal])
        session.commit()

        retail = Tag(category_id=sector.id, key="retail", label="Retail")
        secret = Tag(category_id=internal.id, key="secret", label="Secret")
        session.add_all([retail, secret])
        session.commit()

        try:
            validate_content_item_tags([retail, secret])
            assert False, "Expected TagValidationError"
        except TagValidationError:
            assert True
    finally:
        session.close()
        engine.dispose()


def test_kb_areas_include_required_entries():
    engine, session = _setup_db()
    app.dependency_overrides[get_db] = _db_override(session)
    try:
        user = User(email="user@local", full_name="User", password_hash="x", role="USER", is_admin=False)
        session.add(user)
        session.commit()

        required = [
            "Industries / Verticals",
            "Services / Solutions",
            "Outreach & Sales Enablement",
            "Case Studies & Proof",
        ]
        for idx, name in enumerate(required):
            session.add(KnowledgeBaseArea(key=f"area-{idx}", name=name, description="", order_index=idx))
        session.commit()

        client = TestClient(app)
        resp = client.get("/kb/areas", headers=_auth_headers(user.id))
        assert resp.status_code == 200
        names = {item["name"] for item in resp.json()}
        for name in required:
            assert name in names
    finally:
        session.close()
        engine.dispose()
        app.dependency_overrides = {}


def test_create_content_item_rejects_invalid_tag_category():
    engine, session = _setup_db()
    app.dependency_overrides[get_db] = _db_override(session)
    try:
        user = User(email="user2@local", full_name="User Two", password_hash="x", role="USER", is_admin=False)
        session.add(user)
        session.commit()

        sector = TagCategory(key="sector", name="Sector")
        internal = TagCategory(key="internal", name="Internal")
        session.add_all([sector, internal])
        session.commit()

        retail = Tag(category_id=sector.id, key="retail", label="Retail")
        secret = Tag(category_id=internal.id, key="secret", label="Secret")
        session.add_all([retail, secret])
        session.commit()

        area = KnowledgeBaseArea(key="case-studies", name="Case Studies & Proof", description="", order_index=0)
        session.add(area)
        session.commit()

        payload = {
            "area_id": area.id,
            "title": "Test",
            "body": "Body",
            "status": "APPROVED",
            "language": "en",
            "tag_ids": [retail.id, secret.id],
        }
        client = TestClient(app)
        resp = client.post("/kb/content", json=payload, headers=_auth_headers(user.id))
        assert resp.status_code == 400
    finally:
        session.close()
        engine.dispose()
        app.dependency_overrides = {}
