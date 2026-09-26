# CaseCompass

CaseCompass is an AI-powered legal preparation assistant that helps users organize case details, documents, facts, timelines, clauses, evidence, and missing information in one place.

It helps users:

- Create and manage case files
- Upload TXT, Markdown, PDF, and DOCX documents
- Extract facts, clauses, and timeline events
- Identify missing information and evidence gaps
- Ask questions about their case documents
- Generate questions for a legal professional
- Create and download structured case briefs

## Tech Stack

- React
- TypeScript
- Vite
- FastAPI
- Python
- SQLite
- Google Gemini API
- Docker
- Render

## Local Setup

### Backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-flash-lite-latest
```

Never commit `.env` or expose your API key.

## Deployment

The project includes a root `Dockerfile` and `render.yaml` for deployment on Render. Connect the GitHub repository to Render and configure `GEMINI_API_KEY` as a secret environment variable.

## Disclaimer

CaseCompass provides informational preparation assistance only. It does not provide legal advice and does not replace a qualified legal professional.
```
