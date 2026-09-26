# CaseCompass Implementation Plan

## Phase 1: Setup and Basic Scaffolding
- Initialize Git repository and `.gitignore`.
- Create `.env.example` and `repository-size-check.sh`.
- Set up Frontend: React + TypeScript + Vite (`/frontend`).
- Set up Backend: Python + FastAPI (`/backend`).
- Verify basic connection between frontend and backend.

## Phase 2: MVP Core (P0 Features)
- **Demo Mode**: Implement a hardcoded demo case with small JSON fixtures.
- **Case Intake**: Build frontend UI and backend API for creating a case.
- **Document Management**: Implement file upload (limited types) and list UI.
- **Fact Extraction**: Hook up Gemini API to extract facts and clauses from text.
- **Timeline Generation**: Use Gemini to build a timeline from case context.
- **Evidence Linking**: Ensure extracted facts reference specific document names and pages.
- **Missing Information**: Use Gemini to identify missing details based on the case type.
- **Case Dashboard**: Build the main UI with Overview, Timeline, Documents, Evidence, Clauses, Missing Info.

## Phase 3: RAG & Generation (P0 Features)
- **Case Q&A**: Implement chunking, vector search (using simple in-memory or Firestore for MVP), and a chat interface.
- **Lawyer Questions Generator**: Implement endpoint and UI for generating preparatory questions.
- **Case Brief Generator**: Implement endpoint and UI to export a structured text summary.

## Phase 4: Polish & Delivery
- **UI Quality**: Refine colors (Deep Blue #274C77, Secondary #6096BA, etc.), typography, loading states, accessibility.
- **Error Handling**: Add graceful fallbacks for AI API failures.
- **Tests**: Write basic backend and frontend tests.
- **Documentation**: Update `README.md` and `architecture.md`.
- **Final Checks**: Run `repository-size-check.sh` and ensure everything builds correctly.
