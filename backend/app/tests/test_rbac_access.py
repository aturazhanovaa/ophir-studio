import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base, Role, User
from app.db.session import get_db
from app.routers import analytics as analytics_router
from app.routers import legal as legal_router


class _DBMixin:
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(self.engine)
        self.session = self.TestingSession()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def _override_get_db(self):
        session = self.TestingSession()
        try:
            yield session
        finally:
            session.close()


class AnalyticsRBACTests(_DBMixin, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.app = FastAPI()
        self.app.include_router(analytics_router.router)
        self.app.dependency_overrides[get_db] = self._override_get_db

        self.user = User(email="user@studio.local", full_name="User", password_hash="x", role=Role.USER.value)
        self.admin = User(email="admin@studio.local", full_name="Admin", password_hash="x", role=Role.ADMIN.value)
        self.super_admin = User(
            email="superadmin@studio.local", full_name="Super Admin", password_hash="x", role=Role.SUPER_ADMIN.value
        )
        self.session.add_all([self.user, self.admin, self.super_admin])
        self.session.commit()

        self.client = TestClient(self.app)

    def test_analytics_forbidden_for_user(self):
        self.app.dependency_overrides[analytics_router.current_user] = lambda: self.user
        r = self.client.get("/analytics/overview")
        self.assertEqual(r.status_code, 403)

        r = self.client.get("/analytics/top-documents")
        self.assertEqual(r.status_code, 403)

    def test_analytics_forbidden_for_admin(self):
        self.app.dependency_overrides[analytics_router.current_user] = lambda: self.admin
        r = self.client.get("/analytics/overview")
        self.assertEqual(r.status_code, 403)

        r = self.client.get("/analytics/top-documents")
        self.assertEqual(r.status_code, 403)

    def test_analytics_allowed_for_super_admin(self):
        self.app.dependency_overrides[analytics_router.current_user] = lambda: self.super_admin
        r = self.client.get("/analytics/overview")
        self.assertEqual(r.status_code, 200)

        r = self.client.get("/analytics/top-documents")
        self.assertEqual(r.status_code, 200)


class LegalAccessTests(_DBMixin, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.app = FastAPI()
        self.app.include_router(legal_router.router)
        self.app.dependency_overrides[get_db] = self._override_get_db

        self.user = User(email="user@studio.local", full_name="User", password_hash="x", role=Role.USER.value)
        self.session.add(self.user)
        self.session.commit()

        self.client = TestClient(self.app)

    def test_legal_visible_to_user(self):
        self.app.dependency_overrides[legal_router.current_user] = lambda: self.user

        r = self.client.get("/api/legal/overview")
        self.assertEqual(r.status_code, 200)

        r = self.client.get("/api/legal/documents")
        self.assertEqual(r.status_code, 200)

    def test_legal_create_forbidden_for_user(self):
        self.app.dependency_overrides[legal_router.current_user] = lambda: self.user
        r = self.client.post("/api/legal/documents", json={"title": "Test", "type": "NDA", "content": ""})
        self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main()
