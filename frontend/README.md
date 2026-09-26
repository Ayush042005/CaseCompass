# CaseCompass

CaseCompass organizes a user's story, documents, facts, timeline, clauses, evidence gaps, and preparation questions for a conversation with a qualified legal professional. It supports text, Markdown, PDF, and DOCX uploads. It provides preparation assistance, not legal advice.

## Run locally

From `backend`, install the declared dependencies and start FastAPI:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

From `frontend`, install dependencies and start Vite:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

## Configuration

Copy `.env.example` to `.env` and add `GEMINI_API_KEY` to enable Gemini analysis and generation. Without a key, local deterministic fallback responses keep the demo usable. Use `CASECOMPASS_DB_PATH` to choose a different SQLite database location.

## Verification

```powershell
# frontend
npm run build

# backend
python -m unittest -v test_api.py
python -m compileall -q main.py ai_processor.py
```

The repository-level design and API notes are in [`../architecture.md`](../architecture.md).

## Google Cloud Run

The root `Dockerfile` builds the Vite frontend and serves it from FastAPI as one Cloud Run service. After enabling billing for the Google Cloud project:

```powershell
gcloud.cmd config set project YOUR_PROJECT_ID
gcloud.cmd builds submit --tag gcr.io/YOUR_PROJECT_ID/casecompass
gcloud.cmd run deploy casecompass --image gcr.io/YOUR_PROJECT_ID/casecompass --region asia-south1 --platform managed --allow-unauthenticated --set-env-vars CASECOMPASS_DB_PATH=/tmp/casecompass.db
```

Configure `GEMINI_API_KEY` through Secret Manager for a deployed service rather than committing it or passing it in source files. Cloud Run's local filesystem is ephemeral, so move SQLite to a managed database or Firestore before treating the deployment as production storage.

## Render deployment

This repository includes [`render.yaml`](../render.yaml) for a free Docker web service. Connect the GitHub repository `Ayush042005/CaseCompass` in the Render dashboard, choose **Blueprint**, and apply the blueprint. Enter `GEMINI_API_KEY` as a secret environment variable when prompted. Render will build the root `Dockerfile` and expose the combined frontend/backend service. The free service sleeps after inactivity, and `/tmp/casecompass.db` is ephemeral, so use managed storage for durable cases.
