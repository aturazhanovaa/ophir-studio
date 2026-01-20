import asyncio
import io
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import UploadFile

from app.db.models import Base, LegalAuditLog, LegalDocument, Role, User
from app.routers.legal import (
    create_legal_document,
    create_template,
    delete_example,
    generate_from_template,
    list_examples,
    list_template_examples,
    upload_examples,
)
from app.schemas.legal import LegalDocumentCreateIn, LegalTemplateCreateIn
from app.schemas.legal_examples import LegalTemplateGenerateWithExamplesIn


class LegalExamplesFlowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(self.engine)
        self.session = TestingSession()

        self.admin = self._mk_user("legaladmin@studio.local", Role.LEGAL_ADMIN.value)
        self.editor = self._mk_user("editor@studio.local", Role.LEGAL_EDITOR.value)
        self.viewer = self._mk_user("viewer@studio.local", Role.LEGAL_VIEWER.value)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def _mk_user(self, email: str, role: str):
        u = User(email=email, full_name=email.split("@")[0], password_hash="hash", role=role)
        self.session.add(u)
        self.session.commit()
        self.session.refresh(u)
        return u

    def test_upload_extract_list_and_generate(self):
        tmpl = create_template(
            payload=LegalTemplateCreateIn(name="NDA", type="NDA", body="Hello {{client_name}}"),
            db=self.session,
            user=self.admin,
        )

        f = UploadFile(filename="example.txt", file=io.BytesIO(b"Confidentiality clause example for Acme.\n\nTerm: 12 months."))
        created = asyncio.run(
            upload_examples(
                files=[f],
                title=None,
                document_type="NDA",
                template_id=tmpl.id,
                scope="TEMPLATE",
                client_name=None,
                tags="confidentiality",
                db=self.session,
                user=self.editor,
            )
        )
        self.assertEqual(len(created), 1)
        ex = created[0]
        self.assertEqual(ex.status.value, "READY")

        linked = list_template_examples(template_id=tmpl.id, db=self.session, user=self.viewer)
        self.assertEqual(len(linked), 1)
        self.assertEqual(linked[0].id, ex.id)

        listed = list_examples(q="confidentiality", db=self.session, user=self.viewer, limit=50, offset=0)
        self.assertGreaterEqual(listed.total, 1)

        gen = generate_from_template(
            template_id=tmpl.id,
            payload=LegalTemplateGenerateWithExamplesIn(variables={"client_name": "Acme"}, selected_example_ids=[ex.id], title="Acme NDA"),
            db=self.session,
            user=self.editor,
        )
        self.assertIn("Hello Acme", gen.content)
        self.assertIn(ex.id, gen.used_example_ids)
        self.assertIn("REFERENCE EXAMPLES", gen.content)

        doc = create_legal_document(
            payload=LegalDocumentCreateIn(
                title="Acme NDA",
                type="NDA",
                content=gen.content,
                variables={"client_name": "Acme", "used_example_ids": gen.used_example_ids},
            ),
            db=self.session,
            user=self.editor,
        )
        doc_row = self.session.get(LegalDocument, doc.id)
        self.assertIsInstance(doc_row.variables, dict)
        self.assertEqual(doc_row.variables.get("used_example_ids"), gen.used_example_ids)

        audits = self.session.query(LegalAuditLog).filter(LegalAuditLog.document_id == doc.id).all()
        self.assertTrue(any(a.action == "document_generated_with_examples" for a in audits))

    def test_delete_requires_admin(self):
        tmpl = create_template(
            payload=LegalTemplateCreateIn(name="NDA", type="NDA", body="Body"),
            db=self.session,
            user=self.admin,
        )
        f = UploadFile(filename="example.txt", file=io.BytesIO(b"Text"))
        created = asyncio.run(
            upload_examples(
                files=[f],
                title=None,
                document_type="NDA",
                template_id=tmpl.id,
                scope="TEMPLATE",
                client_name=None,
                tags=None,
                db=self.session,
                user=self.editor,
            )
        )
        ex = created[0]

        with self.assertRaises(HTTPException) as ctx:
            delete_example(example_id=ex.id, db=self.session, user=self.editor)
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()

