from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import (
    AccuracyLevel,
    AnswerTone,
    AccessGrantSource,
    Area,
    Base,
    Role,
    User,
    UserAreaAccess,
)
from app.main import app
import app.routers.copilot as copilot
import app.services.rag as rag


class DummyUser:
    id = 999
    is_super_admin = False
    is_admin_role = False


def _dummy_db():
    yield None


def _reset_overrides():
    app.dependency_overrides = {}


def _setup_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)
    session = TestingSession()

    user = User(id=999, email="dummy@test.local", full_name="Dummy", password_hash="hash", role=Role.USER.value)
    session.add(user)
    session.add_all(
        [
            Area(id=1, key="area1", name="Area 1"),
            Area(id=2, key="area2", name="Area 2"),
            Area(id=5, key="area5", name="Area 5"),
        ]
    )
    session.add(
        UserAreaAccess(
            user_id=user.id,
            area_id=5,
            granted_by_user_id=None,
            source=AccessGrantSource.MANUAL.value,
        )
    )
    session.commit()
    return engine, session


def _db_override(session):
    def _db():
        try:
            yield session
        finally:
            pass
    return _db


def test_forbidden_area_returns_403():
    client = TestClient(app)
    engine, session = _setup_db()
    app.dependency_overrides[copilot.current_user] = lambda: DummyUser()
    app.dependency_overrides[copilot.get_db] = _db_override(session)
    try:
        with mock.patch("app.routers.copilot.get_allowed_area_ids", return_value=[1]):
            resp = client.post("/copilot/ask", json={"question": "hi", "area_id": 2})
            assert resp.status_code == 403
    finally:
        session.close()
        engine.dispose()
        _reset_overrides()


def test_sources_are_scoped_to_allowed_area():
    client = TestClient(app)
    engine, session = _setup_db()
    app.dependency_overrides[copilot.current_user] = lambda: DummyUser()
    app.dependency_overrides[copilot.get_db] = _db_override(session)
    called = {}

    def stub_answer(db, query, area_ids, chat_history=None, **kwargs):
        called["area_ids"] = area_ids
        source = {
            "chunk_id": 1,
            "document_id": 10,
            "document_title": "Doc",
            "version_id": 1,
            "chunk_index": 0,
            "chunk_text": "Scoped content",
            "heading_path": "",
            "score": 0.8,
            "highlights": [],
        }
        return {
            "answer": "ok",
            "sources": [source],
            "matches": [source],
            "best_score": 0.8,
            "meta": {"evidence_level": "high"},
        }

    try:
        with mock.patch("app.routers.copilot.get_allowed_area_ids", return_value=[5]), mock.patch.object(
            copilot, "answer_with_rag", side_effect=stub_answer
        ):
            resp = client.post("/copilot/ask", json={"question": "hello", "area_id": 5})
            assert resp.status_code == 200
            payload = resp.json()
            assert payload["sources"][0]["document_id"] == 10
            assert called.get("area_ids") == [5]
    finally:
        session.close()
        engine.dispose()
        _reset_overrides()


def test_high_accuracy_refuses_with_no_evidence():
    # Avoid hitting OpenAI and embeddings; force empty retrieval
    with mock.patch.object(rag, "retrieve_candidates", return_value=[]), mock.patch.object(
        rag, "_client", return_value=object()
    ):
        result = rag.answer_with_rag(
            db=None,
            query="What is our policy?",
            area_ids=[1],
            accuracy_level=AccuracyLevel.HIGH,
            answer_tone=AnswerTone.C_EXECUTIVE,
        )
        assert "Not enough info" in result["answer"]
        assert result.get("meta", {}).get("evidence_level") == "low"
