import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.models import AnalyticsEvent, Base, User
from app.db.session import get_db
from app.main import app
from app.utils.date_ranges import last_quarter_range, resolve_date_range


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


class DateRangeTests(unittest.TestCase):
    def test_last_quarter_range_february(self):
        now = datetime(2024, 2, 10, 12, 0, tzinfo=timezone(timedelta(hours=-5)))
        rng = last_quarter_range(now)
        self.assertEqual(rng.start, datetime(2023, 10, 1, 0, 0, tzinfo=now.tzinfo))
        self.assertEqual(rng.end, datetime(2023, 12, 31, 23, 59, 59, 999_999, tzinfo=now.tzinfo))

    def test_last_quarter_range_august(self):
        now = datetime(2024, 8, 10, 12, 0, tzinfo=timezone(timedelta(hours=2)))
        rng = last_quarter_range(now)
        self.assertEqual(rng.start, datetime(2024, 4, 1, 0, 0, tzinfo=now.tzinfo))
        self.assertEqual(rng.end, datetime(2024, 6, 30, 23, 59, 59, 999_999, tzinfo=now.tzinfo))

    def test_resolve_date_range_accepts_last_quarter_key(self):
        now = datetime(2024, 2, 10, 12, 0, tzinfo=timezone.utc)
        rng = resolve_date_range(range_key="last_quarter", start_date=None, end_date=None, now=now)
        self.assertEqual(rng.start, datetime(2023, 10, 1, 0, 0, tzinfo=timezone.utc))
        self.assertEqual(rng.end, datetime(2023, 12, 31, 23, 59, 59, 999_999, tzinfo=timezone.utc))


class AnalyticsRangeIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.engine, self.session = _setup_db()
        app.dependency_overrides[get_db] = _db_override(self.session)

        super_admin = User(
            email="superadmin@local",
            full_name="Super Admin",
            password_hash="x",
            role="SUPER_ADMIN",
            is_admin=True,
        )
        self.session.add(super_admin)
        self.session.commit()
        self.super_admin = super_admin
        self.client = TestClient(app)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()
        app.dependency_overrides = {}

    def test_analytics_overview_respects_start_end_dates(self):
        # Window: 2024-01-01 through 2024-01-31 UTC inclusive
        start = datetime(2024, 1, 1, 0, 0, tzinfo=timezone.utc)
        end = datetime(2024, 1, 31, 23, 59, 59, tzinfo=timezone.utc)

        self.session.add_all(
            [
                AnalyticsEvent(event_type="question_asked", created_at=start + timedelta(days=1)),
                AnalyticsEvent(event_type="question_asked", created_at=start + timedelta(days=2)),
                AnalyticsEvent(event_type="question_asked", created_at=start - timedelta(days=1)),  # out of range
                AnalyticsEvent(event_type="unanswered_question", created_at=start + timedelta(days=3)),
                AnalyticsEvent(event_type="unanswered_question", created_at=end + timedelta(days=1)),  # out of range
            ]
        )
        self.session.commit()

        resp = self.client.get(
            "/analytics/overview",
            params={"start_date": start.isoformat(), "end_date": end.isoformat()},
            headers=_auth_headers(self.super_admin.id),
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["total_questions"], 2)
        self.assertEqual(body["unanswered_questions"], 1)
