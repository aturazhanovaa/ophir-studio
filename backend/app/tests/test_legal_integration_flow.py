import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, LegalApproval, LegalDocument, Role, User
from app.routers.legal import create_legal_document, create_template, generate_from_template, submit_for_review
from app.schemas.legal import (
    LegalDocumentCreateIn,
    LegalSubmitForReviewIn,
    LegalTemplateCreateIn,
)
from app.schemas.legal_examples import LegalTemplateGenerateWithExamplesIn


class LegalIntegrationFlowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(self.engine)
        self.session = TestingSession()

        self.admin = self._mk_user("legaladmin@studio.local", Role.LEGAL_ADMIN.value)
        self.editor = self._mk_user("editor@studio.local", Role.LEGAL_EDITOR.value)
        self.approver = self._mk_user("approver@studio.local", Role.LEGAL_APPROVER.value)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def _mk_user(self, email: str, role: str):
        u = User(email=email, full_name=email.split("@")[0], password_hash="hash", role=role)
        self.session.add(u)
        self.session.commit()
        self.session.refresh(u)
        return u

    def test_template_to_document_to_review(self):
        tmpl = create_template(
            payload=LegalTemplateCreateIn(
                name="NDA",
                type="NDA",
                body="NDA for {{client_name}} starting {{start_date}}",
                variables=["client_name", "start_date"],
                default_approvers=[self.approver.id],
            ),
            db=self.session,
            user=self.admin,
        )

        gen = generate_from_template(
            template_id=tmpl.id,
            payload=LegalTemplateGenerateWithExamplesIn(variables={"client_name": "Acme", "start_date": "2026-01-01"}),
            db=self.session,
            user=self.editor,
        )
        self.assertIn("Acme", gen.content)

        doc = create_legal_document(
            payload=LegalDocumentCreateIn(
                title="Acme NDA",
                type=tmpl.type,
                content=gen.content,
                variables={
                    "client_name": "Acme",
                    "start_date": "2026-01-01",
                    "_template_id": tmpl.id,
                    "_approver_ids": tmpl.default_approvers,
                },
            ),
            db=self.session,
            user=self.editor,
        )

        submitted = submit_for_review(
            document_id=doc.id,
            payload=LegalSubmitForReviewIn(),
            db=self.session,
            user=self.editor,
        )
        self.assertEqual(submitted.status.value, "IN_REVIEW")

        approvals = self.session.query(LegalApproval).filter(LegalApproval.document_id == doc.id).all()
        self.assertEqual(len(approvals), 1)
        self.assertEqual(approvals[0].approver_id, self.approver.id)

        doc_row = self.session.get(LegalDocument, doc.id)
        self.assertEqual(doc_row.status, "IN_REVIEW")


if __name__ == "__main__":
    unittest.main()
