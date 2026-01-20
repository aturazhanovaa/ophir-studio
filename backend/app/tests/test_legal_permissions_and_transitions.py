import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, LegalAuditLog, LegalDocument, Role, User
from app.routers.legal import (
    approve_document,
    archive_document,
    create_legal_document,
    create_template,
    generate_from_template,
    get_template,
    list_templates,
    mark_signed,
    submit_for_review,
    update_legal_document,
)
from app.schemas.legal import (
    LegalDecisionIn,
    LegalDocumentCreateIn,
    LegalDocumentUpdateIn,
    LegalSubmitForReviewIn,
    LegalTemplateCreateIn,
)
from app.schemas.legal_examples import LegalTemplateGenerateWithExamplesIn


class LegalRBACAndTransitionsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(self.engine)
        self.session = TestingSession()

        self.viewer = self._mk_user("viewer@studio.local", Role.LEGAL_VIEWER.value)
        self.editor = self._mk_user("editor@studio.local", Role.LEGAL_EDITOR.value)
        self.approver = self._mk_user("approver@studio.local", Role.LEGAL_APPROVER.value)
        self.legal_admin = self._mk_user("legaladmin@studio.local", Role.LEGAL_ADMIN.value)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def _mk_user(self, email: str, role: str):
        u = User(email=email, full_name=email.split("@")[0], password_hash="hash", role=role)
        self.session.add(u)
        self.session.commit()
        self.session.refresh(u)
        return u

    def test_template_admin_permissions(self):
        list_templates(db=self.session, user=self.viewer)  # should not raise

        with self.assertRaises(HTTPException) as ctx:
            create_template(
                payload=LegalTemplateCreateIn(name="NDA", type="NDA", body="Hello {{client_name}}"),
                db=self.session,
                user=self.viewer,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        tmpl = create_template(
            payload=LegalTemplateCreateIn(name="NDA", type="NDA", body="Hello {{client_name}}", variables=["client_name"], default_approvers=[self.approver.id]),
            db=self.session,
            user=self.legal_admin,
        )
        self.assertEqual(tmpl.name, "NDA")

        templates = list_templates(db=self.session, user=self.viewer)
        self.assertTrue(any(t.id == tmpl.id for t in templates))

        fetched = get_template(template_id=tmpl.id, db=self.session, user=self.viewer)
        self.assertEqual(fetched.id, tmpl.id)

        gen = generate_from_template(
            template_id=tmpl.id,
            payload=LegalTemplateGenerateWithExamplesIn(variables={"client_name": "Acme"}),
            db=self.session,
            user=self.editor,
        )
        self.assertEqual(gen.content, "Hello Acme")

    def test_document_permissions_and_transitions(self):
        with self.assertRaises(HTTPException) as ctx:
            create_legal_document(
                payload=LegalDocumentCreateIn(title="MSA", type="MSA", content="x"),
                db=self.session,
                user=self.viewer,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        created = create_legal_document(
            payload=LegalDocumentCreateIn(title="MSA", type="MSA", content="Hello {{client_name}}", variables={"client_name": "Acme"}),
            db=self.session,
            user=self.editor,
        )
        self.assertEqual(created.status.value, "DRAFT")

        with self.assertRaises(HTTPException) as ctx:
            mark_signed(document_id=created.id, db=self.session, user=self.editor)
        self.assertEqual(ctx.exception.status_code, 400)

        submit_for_review(
            document_id=created.id,
            payload=LegalSubmitForReviewIn(approver_ids=[self.approver.id]),
            db=self.session,
            user=self.editor,
        )
        doc = self.session.get(LegalDocument, created.id)
        self.assertEqual(doc.status, "IN_REVIEW")

        with self.assertRaises(HTTPException) as ctx:
            approve_document(
                document_id=created.id,
                payload=LegalDecisionIn(comment="ok"),
                db=self.session,
                user=self.editor,
            )
        self.assertEqual(ctx.exception.status_code, 403)

        approve_document(
            document_id=created.id,
            payload=LegalDecisionIn(comment="ok"),
            db=self.session,
            user=self.approver,
        )
        doc = self.session.get(LegalDocument, created.id)
        self.assertEqual(doc.status, "APPROVED")

        mark_signed(document_id=created.id, db=self.session, user=self.editor)
        doc = self.session.get(LegalDocument, created.id)
        self.assertEqual(doc.status, "SIGNED")

        archive_document(document_id=created.id, db=self.session, user=self.editor)
        doc = self.session.get(LegalDocument, created.id)
        self.assertEqual(doc.status, "ARCHIVED")

        with self.assertRaises(HTTPException) as ctx:
            update_legal_document(
                document_id=created.id,
                payload=LegalDocumentUpdateIn(content="nope"),
                db=self.session,
                user=self.editor,
            )
        self.assertEqual(ctx.exception.status_code, 400)

        audit_count = self.session.query(LegalAuditLog).filter(LegalAuditLog.document_id == created.id).count()
        self.assertGreaterEqual(audit_count, 3)


if __name__ == "__main__":
    unittest.main()
