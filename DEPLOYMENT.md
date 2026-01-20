# Deployment (Vercel + Render + Supabase)

This repo is a **2-service** setup:

- **Frontend**: `frontend/` (Vite + React) → deploy to **Vercel**
- **Backend**: `backend/` (FastAPI) → deploy to **Render (Web Service)**
- **Database + Vector search**: **Supabase Postgres + pgvector**
- **File storage** (documents + legal examples): **Supabase Storage** (Render disk is ephemeral)

## Critical rule: secrets

Never put secrets in frontend env vars. Any `VITE_*` (Vite) values are shipped to the browser.

- Frontend env: **only** `VITE_API_BASE_URL`
- Backend env: `DATABASE_URL`, `OPENAI_API_KEY`, Notion keys, Supabase keys, etc.

---

## 1) Supabase setup

### 1.1 Create project + get credentials

In Supabase:
- Create a project
- Get the **Database connection string** (prefer the “Connection string” in Supabase settings)
- Get:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

### 1.2 Enable pgvector

Run in Supabase SQL editor:

```sql
create extension if not exists vector;
```

### 1.3 (Recommended) Add a vector index

This project stores normalized embeddings on `chunks.embedding` and uses cosine distance.

```sql
create index if not exists chunks_embedding_ivfflat_idx
on public.chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

analyze public.chunks;
```

Notes:
- If you change `EMBEDDING_DIM` or the embedding model dimension, you must recreate the column/index.

---

## 2) Backend (Render)

### 2.1 Create a Render Web Service

Render settings:
- **Root Directory**: `backend`
- **Environment**: Docker
- **Health Check Path**: `/health`

This repo includes:
- `backend/Dockerfile` (Render builds and runs it)
- `render.yaml` (optional Blueprint; no secrets embedded)

### 2.2 Backend environment variables (Render)

Copy from `backend/.env.example` and set values in Render.

Required:
- `APP_ENV=production`
- `DATABASE_URL=` (Supabase Postgres connection string, e.g. `postgresql+psycopg2://...?...sslmode=require`)
- `JWT_SECRET=`
- `OPENAI_API_KEY=`
- `CORS_ORIGINS=` (comma-separated, include your Vercel domain)
- `STORAGE_PROVIDER=supabase`
- `SUPABASE_URL=`
- `SUPABASE_SERVICE_ROLE_KEY=`
- `SUPABASE_STORAGE_BUCKET=legal-examples`

Optional (depending on your features):
- `NOTION_API_KEY=`
- `INTEGRATION_KEY=`
- `OPENAI_CHAT_MODEL=...`
- `OPENAI_EMBED_MODEL=...`
- `EMBEDDING_DIM=1536`

### 2.3 Verify backend

- Health: `https://<your-render-service>/health`
- OpenAPI docs (FastAPI): `https://<your-render-service>/docs`

---

## 3) Frontend (Vercel)

### 3.1 Create a Vercel project

Vercel settings:
- **Root Directory**: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

### 3.2 Frontend environment variables (Vercel)

Copy from `frontend/.env.example`.

Only:
- `VITE_API_BASE_URL=https://<your-render-service>`

No secrets in frontend env vars.

### 3.3 Verify frontend

- Visit your Vercel URL
- Login
- Smoke checks:
  - Analytics pages should be visible only to `SUPER_ADMIN`
  - Legal module should be visible to all authenticated users

---

## 4) Production storage guardrails

Render’s filesystem is ephemeral. This repo is configured so that in non-local environments:
- Document uploads (Knowledge Hub) and Legal example uploads **must** use Supabase Storage (`STORAGE_PROVIDER=supabase`)
- If `STORAGE_PROVIDER` is not set correctly, uploads fail fast with a clear error instead of silently losing files.

