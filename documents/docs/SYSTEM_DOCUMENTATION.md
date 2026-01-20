# Studio Knowledge Hub — System Documentation

## 1. Project Overview
- **What**: Studio Knowledge Hub is an internal knowledge workspace with areas, documents, AI Q&A, and usage analytics.
- **Why**: Centralizes team knowledge, keeps AI answers scoped to relevant content, and enforces access controls.
- **Who**: Internal users, admins, and super admins managing organization knowledge and access.

## 2. Core Concepts
- **Area**: Workspace scope (e.g., Marketing, Sales, Technical). All permissions and AI context are area-scoped.
- **Document**: A stored file within an area.
- **Document Version**: Versioned uploads per document; newest version is the default.
- **User**: Authenticated person interacting with areas and documents.
- **Role**: SUPER_ADMIN, ADMIN, USER define global capabilities.
- **Access (UserAreaAccess)**: Grants a user read/manage rights to specific areas.
- **Ask AI**: Area-scoped AI assistant answering questions from documents in allowed areas.
- **Analytics**: Aggregated usage metrics (questions, documents, unanswered, tones, accuracy levels).

Relationships: Users have roles and area access; areas contain documents; documents have versions; Ask AI queries operate within allowed areas; analytics records events tied to areas/users.

## 3. User Roles & Permissions (RBAC)
| Role | Areas Access | Documents | Analytics | Users | Access Requests |
| --- | --- | --- | --- | --- | --- |
| SUPER_ADMIN | All areas; can grant/revoke | Create/read/update/delete | View all | Manage users | Approve/reject |
| ADMIN | Areas they are granted; can grant within scope | Create/read/update/delete in granted areas | View for granted areas | Manage users (scoped) | Approve/reject |
| USER | Only granted areas | Read; manage if granted `can_manage` | View only granted areas | No | Can submit/cancel |

- Users can belong to multiple areas.
- Super Admin/Admin can grant/revoke area access.
- Users can request access; requests can be approved/rejected.

## 4. User Flows
4.1 **Login**
1. User submits credentials.
2. Backend returns JWT token.
3. Token is used on subsequent API calls.

4.2 **Browse areas/documents**
1. Select area from header.
2. Documents list loads for that area.
3. Apply search/tag filters as needed.

4.3 **Upload/version documents**
1. Open Upload in Documents.
2. Provide title, tags, file; submit.
3. New version appears; latest version is active.

4.4 **Ask AI (area-scoped)**
1. Click global Ask AI button (modal opens).
2. Select area (if not already).
3. Choose tone (Technical/Executive/Colloquial) and accuracy (Low/Medium/High).
4. Ask question; answer and sources return scoped to selected area.

4.5 **Request area access**
1. User opens Access Center.
2. Select areas to request and optional message.
3. Submit request.

4.6 **Admin approve/reject access**
1. Admin/Super Admin views pending requests.
2. Approve or reject with optional note.
3. Access granted/denied; requester notified in UI.

## 5. Ask AI System
- Scoped to the selected area; only uses documents from allowed areas.
- Natural-language questions supported; answers include source chunks.
- **Answer Tone**:
  - Technical: Structured, precise, steps, edge cases.
  - Executive: Short, outcome/ROI-focused, minimal jargon.
  - Colloquial: Friendly, simple language, short sentences.
- **Accuracy Level**:
  - Low: Faster, minimal validation, fewer citations.
  - Medium (default): Balanced, uses docs first, notes assumptions.
  - High: Strict with citations, cautious; if unsure, asks for missing info.
- Tone controls style; accuracy controls strictness/citation/refusal behavior.

## 6. Analytics
- Tracks: total questions, top documents, top questions, active users, unanswered questions.
- Area-scoped; respects user access.
- Each question record includes tone and accuracy level for breakdowns/filters.

## 7. System Architecture
- **Frontend**: React + Vite UI, handles auth, area selection, documents, Ask AI modal, analytics.
- **Backend**: FastAPI service (JWT auth, RBAC checks, documents, access requests, analytics, Ask AI).
- **Database**: Relational (SQLAlchemy models) storing users, areas, documents, versions, access, analytics events.
- **AI Integration**: OpenAI chat/embedding; requests include area context and prompt modifiers for tone/accuracy.
- **Request flow**: Client → Auth (token) → API (RBAC check) → DB/AI → Response.

## 8. Backend API Overview
- **Authentication**: Login, me; issues/validates JWT.
- **Areas**: List areas, list user areas; RBAC: visible if granted or admin.
- **Documents & Versions**: CRUD, upload, versioning, download; RBAC by area permissions.
- **Ask AI**: `/copilot/ask` accepts question, area_id, tone, accuracy_level; enforces area permissions.
- **Analytics**: Overview, top-documents, top-questions, unanswered, questions summary/trends; filters by tone/accuracy; RBAC area-scoped/admin as required.
- **Access Requests**: Create, list mine, cancel; admin approve/reject.
- **Users (Admin)**: List/create/update users; grant/revoke area access; requires ADMIN/SUPER_ADMIN.

## 9. Database Model (Logical)
- **Users** (id, email, role, password_hash, created_at).
- **Areas** (id, key, name).
- **UserAreaAccess** (user_id, area_id, granted_by, source).
- **Documents** (id, area_id, title, latest_version_id, tags, created_by, deleted_at).
- **DocumentVersions** (id, document_id, version, file_path, created_at).
- **Chunks** (document text segments tied to versions/areas for retrieval).
- **AnalyticsEvents** (event_type, user_id, area_id, document_id, query, accuracy_level, answer_tone, tokens, latency, created_at).
- **AccessRequests** (requester_user_id, area_id, status, message, decided_by, decided_at, decision_reason).
- Relationships: Users ↔ Areas via UserAreaAccess; Areas ↔ Documents ↔ DocumentVersions ↔ Chunks; Ask AI writes AnalyticsEvents per question; AccessRequests link users and areas.

## 10. Running the System Locally
- **Backend**:
  - `cd backend`
  - `python3 -m venv .venv && source .venv/bin/activate`
  - `pip install -r requirements.txt`
  - `uvicorn app.main:app --reload --port 8000`
  - Environment: `OPENAI_API_KEY` required.
- **Frontend**:
  - `cd frontend`
  - `npm install`
  - `npm run dev` (http://localhost:5173)
- **Seed users (dev)**:
  - superadmin@studio.local (SUPER_ADMIN)
  - admin@studio.local (ADMIN)
  - marketing@studio.local (USER)
  - sales@studio.local (USER)
  - Passwords set in seed/init (e.g., Admin123!/Super123!/Marketing123!/Sales123! in dev seeds).

## 11. Validation Checklist
- [ ] Login works and returns token.
- [ ] RBAC enforces area isolation (Marketing user cannot see Sales docs/analytics).
- [ ] Ask AI only answers from allowed areas and applies tone/accuracy settings.
- [ ] Analytics shows tone/accuracy columns and filters; data matches asked questions.
- [ ] Document upload/versioning works; latest version used in answers.
- [ ] Access requests can be submitted, approved, rejected; permissions update.
- [ ] Only one Ask AI entry point (global header/modal).

## 12. Limitations & Future Improvements
- Retrieval/search relevance can be improved (better ranking, synonyms).
- Stronger AI citations (inline markers, richer source metadata).
- Audit logs for admin actions and access changes.
- UI refinements: more responsive layouts, richer analytics visualizations, toast/notification consistency.
