# Studio Knowledge Hub – Dev Notes

## Deploy to Render (Blueprint)

This repo can be deployed on Render using the root `render.yaml` Blueprint:

1) Push this repo to GitHub.
2) In Render: **New** → **Blueprint** → select the repo.
3) Set env vars:
   - Backend (`ophir-backend`):
     - `DATABASE_URL` = optional; if unset defaults to `sqlite:///./app.db`
       - For persistence on Render, attach a persistent disk (e.g. mounted at `/data`) and set:
         - `DATABASE_URL=sqlite:////data/app.db`
         - `DATA_DIR=/data`
     - `FRONTEND_ORIGIN` = your Render Static Site URL (e.g. `https://ophir-frontend.onrender.com`)
     - `JWT_SECRET`, `OPENAI_API_KEY` (and optional: `NOTION_API_KEY`, `INTEGRATION_KEY`)
   - Frontend (`ophir-frontend`):
     - `VITE_API_URL` = your backend Render URL (e.g. `https://ophir-backend.onrender.com`)

Smoke test:
- Backend health: `https://<backend>/health`
- Backend docs: `https://<backend>/docs`

## Seed users (created at startup)
- Super Admin: `superadmin@studio.local` / `Super123!`
- Admin: `admin@studio.local` / `Admin123!`
- Marketing (only Marketing area): `marketing@studio.local` / `Marketing123!`
- Sales (only Sales area): `sales@studio.local` / `Sales123!`

## Quick backend start
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

## Quick frontend start
```bash
cd frontend
npm install
npm run dev
```

## Notion Messaging Blocks Mapping
Create a Notion database named `Messaging Blocks` with these properties (case-insensitive):
- Title (title)
- Content (rich text or page content)
- Sector (multi-select)
- Use Case (multi-select)
- Audience (multi-select)
- Funnel Stage (select)
- Geography (multi-select)
- Language (select)
- Status (select: Draft / Approved / Archived)
- Block ID (text)
- Last Synced At (date, optional)

Studio Hub ingests these properties and stores them as messaging blocks with tag taxonomy enforcement.

## Integration env vars
Add these to `backend/.env` as needed:
- `INTEGRATION_KEY` - API key for n8n/webhook calls (required)
- `NOTION_API_KEY` - Notion API token (required for writeback)
- `NOTION_API_VERSION` - defaults to `2022-06-28`
- `NOTION_API_BASE` - defaults to `https://api.notion.com/v1`
- `OPENAI_API_KEY` - required for AI draft generation

## n8n / Notion webhook (Option A)
Webhook endpoint (idempotent upsert by `page_id` or `block_id`):
```bash
curl -X POST http://localhost:8000/integrations/notion/messaging-blocks/upsert \
  -H "Content-Type: application/json" \
  -H "X-INTEGRATION-KEY: $INTEGRATION_KEY" \
  -d '{
    "page_id": "notion-page-id",
    "last_edited_time": "2024-01-01T00:00:00Z",
    "title": "Approved outreach block",
    "content": "Short approved messaging block...",
    "sector": ["Hospitality"],
    "use_case": ["Onboarding"],
    "audience": ["HR"],
    "funnel_stage": "Consideration",
    "geography": ["EU"],
    "language": "en",
    "status": "Approved",
    "block_id": "MSG-001"
  }'
```

## AI draft endpoint (n8n)
```bash
curl -X POST http://localhost:8000/ai/draft \
  -H "Content-Type: application/json" \
  -H "X-INTEGRATION-KEY: $INTEGRATION_KEY" \
  -d '{
    "objective": "outreach email",
    "context": "Targeting hospital operators for VR training pilots.",
    "filters": {
      "sector": ["Hospitality"],
      "use_case": ["VR training safety"],
      "audience": ["Operations"],
      "funnel_stage": ["Consideration"],
      "geography": ["EU"],
      "language": "en"
    },
    "notion_page_id": "notion-page-id"
  }'
```

## Playground endpoint (internal)
```bash
curl -X POST http://localhost:8000/playground/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "objective": "LinkedIn message",
    "context": "Follow-up after demo request.",
    "filters": {
      "sector": ["Hospitality"],
      "use_case": ["Customer demo"],
      "audience": ["CEO"],
      "funnel_stage": ["Decision"],
      "geography": ["EU"],
      "language": "en"
    }
  }'
```

## Dev checks for RBAC/analytics
1) Login as marketing and list accessible areas (should only return Marketing):
```bash
export MARKETING_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"marketing@studio.local","password":"Marketing123!"}' \
  | jq -r .access_token)

curl -H "Authorization: Bearer $MARKETING_TOKEN" http://localhost:8000/areas
```

2) Get area IDs (use Super Admin to see all):
```bash
export SUPER_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":superadmin@studio.local"","password":"Super123!"}' \
  | jq -r .access_token)

curl -H "Authorization: Bearer $SUPER_TOKEN" http://localhost:8000/areas
```

## Legal module

### Routes (frontend)
- `/:locale/legal` – overview (counts + recent activity)
- `/:locale/legal/documents` – documents list (filters/actions)
- `/:locale/legal/documents/new` – create (blank or from template wizard)
- `/:locale/legal/documents/:id` – detail (content/versions/approvals/audit)
- `/:locale/legal/templates` – templates CRUD (Legal Admin only for changes)
- `/:locale/legal/examples` – examples (reference library uploads/search)

### Roles (RBAC)
- `LEGAL_ADMIN` – full legal access + manage templates
- `LEGAL_EDITOR` – create/edit drafts + submit for review
- `LEGAL_APPROVER` – approve/request changes
- `LEGAL_VIEWER` – read-only
- `ADMIN` / `SUPER_ADMIN` – treated as legal viewers/editors/approvers; `SUPER_ADMIN` can also manage templates

### API (backend)
All Legal endpoints live under `http://localhost:8000/api/legal`:
- `GET /overview`
- `GET /documents`, `POST /documents`, `GET/PATCH /documents/:id`
- `POST /documents/:id/duplicate`, `POST /documents/:id/submit-review`
- `POST /documents/:id/approve`, `POST /documents/:id/request-changes`
- `POST /documents/:id/mark-signed`, `POST /documents/:id/archive`
- `GET /documents/:id/versions`, `GET /documents/:id/audit`
- `GET /documents/:id/export?format=txt|pdf|docx` (stub exports return a downloadable text payload)
- `GET /templates`, `POST /templates`, `GET/PATCH/DELETE /templates/:id`
- `POST /templates/:id/generate`
- `POST /examples` (multipart upload)
- `GET /examples`, `GET /examples/:id`, `PATCH /examples/:id`, `DELETE /examples/:id`
- `GET /examples/:id/download` (auth-protected)
- `POST /examples/:id/retry`
- `GET /templates/:id/examples`

### Main flow
Template → Generate preview → Create Draft → Submit for review → Approve/Request changes → Approved → Mark signed → Archive/Export

3) Verify RBAC on analytics (Marketing user asking for Sales area should 403):
```bash
# Replace <SALES_AREA_ID> with the Sales area id from step 2
curl -i -H "Authorization: Bearer $MARKETING_TOKEN" \
  "http://localhost:8000/analytics/top-documents?area_id=<SALES_AREA_ID>"
```

4) Happy path (Marketing user sees only Marketing docs):
```bash
curl -H "Authorization: Bearer $MARKETING_TOKEN" \
  "http://localhost:8000/analytics/top-documents?area_id=<MARKETING_AREA_ID>"
```

5) Super Admin can grant cross-area access on the fly (Marketing gains Sales, analytics now allowed):
```bash
# get marketing user id
MARKETING_ID=$(curl -s -H "Authorization: Bearer $SUPER_TOKEN" http://localhost:8000/admin/users \
  | jq '.[] | select(.email==\"marketing@studio.local\") | .id')

# grant Sales access to marketing (replace <SALES_AREA_ID>)
curl -X POST "http://localhost:8000/admin/users/$MARKETING_ID/areas/grant" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"area_ids\":[<SALES_AREA_ID>],\"source\":\"MANUAL\"}"

# marketing can now query Sales analytics successfully
curl -H "Authorization: Bearer $MARKETING_TOKEN" \
  "http://localhost:8000/analytics/top-documents?area_id=<SALES_AREA_ID>"
```

6) Users can request new areas, admins approve:
```bash
# marketing requests access to Technical + R&D (ids from step 2)
curl -X POST http://localhost:8000/access-requests \
  -H "Authorization: Bearer $MARKETING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"area_ids":[<TECH_ID>,<RND_ID>],"message":"Need to collaborate with engineering"}'

# super admin reviews/approves pending requests
curl -H "Authorization: Bearer $SUPER_TOKEN" http://localhost:8000/admin/access-requests?status=PENDING
curl -X POST -H "Authorization: Bearer $SUPER_TOKEN" http://localhost:8000/admin/access-requests/<REQUEST_ID>/approve
```
#python3 -m venv .venv  source .venv/bin/activate python -m uvicorn app.main:app --reload --port 8000
