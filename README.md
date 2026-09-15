# Aivoa – AI Customer Complaint Management

Aivoa is an AI-powered complaint management system for pharmaceutical companies.

Upload a complaint file or paste an email, and AI will:

* Extract complaint details
* Assess risk and priority
* Find missing information
* Fill the complaint form

The user can review the result, edit it, save the complaint, and later ask the AI Copilot questions about it.

## Main Flow

```text
Upload / Paste Complaint
          ↓
      AI Processing
          ↓
Extract Fields + Risk Check
          ↓
     Review / Edit
          ↓
      Save Complaint
          ↓
    Complaint Register
          ↓
      AI Copilot
```

## Tech Stack

**Frontend:** React, Vite, Redux Toolkit, shadcn/ui, Tailwind CSS

**Backend:** FastAPI, LangGraph, Groq, SQLAlchemy, Alembic

**Database:** MySQL / PostgreSQL

## Project Structure

```text
aivoa/
├── backend/       # FastAPI + AI + Database
├── frontend/      # React application
└── samples/       # Sample complaint files
```

## Run Locally

### Backend

```bash
cd backend
cp .env.example .env
```

Add your database URL and Groq API key to `.env`.

Then:

```bash
uv sync
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

Backend:

`http://localhost:8000`

API Docs:

`http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

`http://localhost:5173`

## Test Data

Sample complaints are available in:

```text
samples/
```

## Important

The old Groq models used by the project have been decommissioned.

Update the model names in:

```text
backend/app/agents/llm.py
```

with models currently available for your Groq API key.

## API

```text
POST /api/intake/extract
POST /api/intake/upload

POST /api/complaints
GET  /api/complaints
GET  /api/complaints/{id}
```

That's it — **upload a complaint → AI processes it → review → save → use Copilot.**
