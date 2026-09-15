# Aivoa – AI-Powered Customer Complaint Management

Pharmaceutical (API & FDF) customer-complaint intake with an AI assistant that
reads a complaint document or email and fills the QMS form for you.

## What it does

1. Drop a complaint document (PDF, DOCX, TXT, EML — max 10 MB) or paste the email text.
2. A LangGraph graph extracts the 13 form fields, assesses risk, and checks completeness;
   the UI shows real per-node progress.
3. The **Log Customer Complaint** form is populated (AI-filled fields are tagged until you
   edit them) and the **AI Copilot Risk Assessment** card shows severity, priority, rationale
   and risk factors. Missing fields are called out.
4. Review, correct, **Save Complaint** — the record, the source text and the AI risk assessment
   are stored in the database with status `pending_triage`.
5. Ask the **AI Copilot** anything about the complaint ("which batch?", "what should we do
   first?"): a second LangGraph graph answers from the form, the source document and the risk
   assessment, and says so when the record does not contain the answer.
6. The **Complaint Register** lists every logged complaint; opening a row loads it back into the
   form (with the copilot) where **Update Complaint** saves changes.

Try it with the files in [`samples/`](samples/): a distributor email (Minor/Major tablet
discolouration), an API assay OOS letter, a hospital packaging-defect form, and a
particulate-matter report for an injectable (Critical).

```
Browser (React + Redux Toolkit)
  IntakeAssistant ── upload / paste ──▶ POST /api/intake/upload | /extract   (NDJSON stream)
        │                                        │
        │  progress events                        ▼  app/agents/intake_graph.py (LangGraph)
        │◀───────────────────────  START → extract_fields → assess_risk → check_completeness → END
        │                                        │              (Groq via app/agents/llm.py)
        ▼  fills the Redux draft                 ▼
  ComplaintForm ── Save ──▶ POST /api/complaints ──▶ SQLAlchemy ──▶ MySQL `complaints`
```

**Stack:** React + Redux Toolkit (Vite) with shadcn/ui + Tailwind · FastAPI · LangGraph · Groq · MySQL/Postgres via SQLAlchemy + Alembic · Google Inter.

## Run locally

```bash
# 1. Database — either
mysql -u root -e "CREATE DATABASE IF NOT EXISTS aivoa"      # local MySQL, or
#   a hosted Postgres (e.g. Neon): paste its postgresql://... URL as DATABASE_URL

# 2. Backend  → http://localhost:8000  (docs at /docs)
cd backend
cp .env.example .env            # then set GROQ_API_KEY
uv sync
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload

# 3. Frontend → http://localhost:5173
cd frontend
npm install
npm run dev
```

## Model note (read this before the demo)

`backend/app/agents/llm.py` keeps the ids the assignment mandates: `gemma2-9b-it` for every
call and `llama-3.3-70b-versatile` for long documents. **Groq has decommissioned both** (gemma2
on 2025-10-08, llama-3.3-70b on 2026-08-16). Verified live on 2026-09-15: `gemma2-9b-it` → 400
"decommissioned", the llama ids → 404, and the account's `/models` list offers no llama-3.x.
With these ids every extraction ends with an in-band error in the AI panel.
Groq's list: https://console.groq.com/docs/deprecations

To run the AI live, change the two constants in `llm.py` (nowhere else) to models the key can
use. Tested on 2026-09-15 with all four `samples/` — every field extracted correctly, Major/High
for the tablet and assay cases, Critical/High for the injectable particulate case:

| Role         | Tested replacement    | Typical time |
| ------------ | --------------------- | ------------ |
| default      | `openai/gpt-oss-20b`  | 2–3 s        |
| long context | `openai/gpt-oss-120b` | 3 s          |
| alternative  | `qwen/qwen3.8-27b`    | 1–2 s        |

## Checks

```bash
# frontend
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm test

# backend
cd backend && .venv/bin/python -m ruff format --check . && .venv/bin/python -m ruff check . \
  && .venv/bin/python -m pytest -q
```

The API round-trip test runs only when a scratch DB is configured:
`mysql -u root -e "CREATE DATABASE aivoa_test"`, then
`DATABASE_URL=mysql+pymysql://root@localhost:3306/aivoa_test .venv/bin/alembic upgrade head`, then
`TEST_DATABASE_URL=mysql+pymysql://root@localhost:3306/aivoa_test .venv/bin/python -m pytest -q`.

## API

| Method | Path                   | In                                  | Out                            |
| ------ | ---------------------- | ----------------------------------- | ------------------------------ |
| POST   | `/api/intake/extract`  | `{ "text": "..." }`                 | NDJSON stream of `IntakeEvent` |
| POST   | `/api/intake/upload`   | multipart `file` (pdf/docx/txt/eml) | NDJSON stream of `IntakeEvent` |
| POST   | `/api/complaints`      | `ComplaintCreate`                   | `ComplaintOut` (201)           |
| GET    | `/api/complaints`      | –                                   | `ComplaintOut[]`               |
| GET    | `/api/complaints/{id}` | –                                   | `ComplaintOut`                 |

An `IntakeEvent` line is `{"progress": 60, "message": "..."}` while the graph runs, then
`{"result": {fields, risk, missing_fields, source_text}}` or `{"error": "..."}`.
Interactive docs: http://localhost:8000/docs.

## Layout

```
backend/app
  config.py          all env/secrets (pydantic-settings)
  db.py              SQLAlchemy engine/session + Base
  models/            ORM tables (schema changes ship with alembic/versions/*; 0002 adds ai_risk)
  schemas/risk.py    severity/priority vocabulary + RiskAssessment (stored with the complaint)
  schemas/           Pydantic request/response models
  routers/           FastAPI routes: one file per domain
  agents/llm.py      the single ChatGroq factory (model ids live here)
  agents/intake_graph.py  LangGraph: extract_fields → assess_risk → check_completeness
  agents/copilot_graph.py LangGraph: ground → answer (chat grounded in the complaint)
  documents.py       PDF / DOCX / TXT / EML → text
frontend/src
  config.ts          API base URL from VITE_API_URL
  store/             Redux Toolkit store, intake slice, RTK Query api
  components/ui/     shadcn/ui primitives (button, card, input, table, …) — generated, do not hand-edit
  features/          complaint form · AI intake assistant + copilot chat · complaint register
  useHashRoute.ts    '#/' (log complaint) and '#/register' without a router dependency
```
