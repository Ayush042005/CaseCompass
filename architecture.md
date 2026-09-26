# CaseCompass Architecture

CaseCompass is a React + TypeScript frontend backed by a small FastAPI service.

```text
React/Vite dashboard
        |
        | JSON + multipart HTTP
        v
FastAPI + SQLite case store
        |
        +-- document analysis (Gemini, with deterministic fallback)
        +-- text extraction for TXT, Markdown, PDF, and DOCX uploads
        +-- chunked local retrieval over uploaded text
        +-- case Q&A from retrieved passages and extracted case context
        +-- lawyer-question generation
        +-- Markdown case-brief generation
```

## Storage

Cases are stored in a local SQLite database at `backend/casecompass.db` by default. Set `CASECOMPASS_DB_PATH` to use another database location. Uploaded text and extracted fields are stored in the case payload for the MVP. The `public_case` helper prevents internal retrieval text from being returned by normal case endpoints.

## AI behavior

When `GEMINI_API_KEY` is configured, document analysis and generation features try `GEMINI_MODEL`, retry temporary failures, and then try `GEMINI_FALLBACK_MODEL`. Without a key or when the service is unavailable, deterministic fallback content keeps the product usable locally.

All generated content is preparation material and should be reviewed with a qualified legal professional. CaseCompass does not provide legal advice.

## Main API routes

- `GET /api/health`
- `POST /api/cases`
- `GET /api/cases/{case_id}`
- `GET /api/demo`
- `POST /api/cases/{case_id}/documents`
- `POST /api/cases/{case_id}/ask`
- `POST /api/cases/{case_id}/lawyer-questions`
- `POST /api/cases/{case_id}/generate-brief`
