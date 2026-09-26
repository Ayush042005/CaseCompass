from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import os
import re
import sqlite3
import uuid
from io import BytesIO
from pydantic import BaseModel
from typing import List, Optional

import ai_processor

app = FastAPI(title="CaseCompass API")

# Allow frontend requests (Update for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("CASECOMPASS_DB_PATH", os.path.join(os.path.dirname(__file__), "casecompass.db"))


def _load_cases() -> dict:
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        rows = connection.execute("SELECT id, payload FROM cases").fetchall()
    return {case_id: json.loads(payload) for case_id, payload in rows}


def _save_case(case: dict) -> None:
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            "INSERT INTO cases (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
            (case["id"], json.dumps(case)),
        )


def _chunk_text(text: str, size: int = 1200, overlap: int = 180) -> list[str]:
    """Create small overlapping passages for lightweight local retrieval."""
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    chunks = []
    start = 0
    while start < len(normalized):
        end = min(start + size, len(normalized))
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = end - overlap
    return chunks


def _extract_text(filename: str, content: bytes) -> str:
    """Extract text from supported document formats without failing uploads."""
    extension = os.path.splitext(filename.lower())[1]
    if extension in {".txt", ".md"}:
        return content.decode("utf-8", errors="replace")
    if extension == ".pdf":
        try:
            from pypdf import PdfReader
            return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages)
        except Exception as error:
            print(f"PDF text extraction failed: {error}")
            return ""
    if extension == ".docx":
        try:
            from docx import Document
            return "\n".join(paragraph.text for paragraph in Document(BytesIO(content)).paragraphs)
        except Exception as error:
            print(f"DOCX text extraction failed: {error}")
            return ""
    return ""


def _merge_analysis(case: dict, filename: str, text_content: str) -> None:
    for chunk in _chunk_text(text_content[:20000]):
        case["_text_chunks"].append({"document": filename, "text": chunk})
    analysis = ai_processor.analyze_document_content(text_content, filename, case)
    case["facts"].extend({
        "fact": fact.fact,
        "evidence": filename,
        "confidence": fact.confidence,
        "source_passage": fact.source_passage,
    } for fact in analysis.facts)
    case["timeline"].extend({
        "date": event.date,
        "event": event.event,
        "evidence": filename,
        "status": event.status,
    } for event in analysis.timeline_events)
    case["clauses"].extend({
        "category": clause.category,
        "plain_language": clause.plain_language,
        "original_text": clause.original_text,
        "source": filename,
        "attention_note": clause.attention_note,
    } for clause in analysis.clauses)
    case["missing_info"].extend({
        "item": missing.item,
        "reason": missing.reason,
        "suggestion": missing.suggestion,
    } for missing in analysis.missing_info)


db_cases = _load_cases()

class CaseCreate(BaseModel):
    title: str = "Untitled Case"
    description: str
    parties_involved: str = ""
    approximate_date: str = ""
    objective: str = ""


class QuestionRequest(BaseModel):
    question: str


def public_case(case: dict) -> dict:
    """Keep internal retrieval state out of API responses."""
    return {key: value for key, value in case.items() if not key.startswith("_")}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Backend is connected!"}


@app.post("/api/cases")
def create_case(case_data: CaseCreate):
    case_id = str(uuid.uuid4())
    # Generate a quick title if not provided
    title = case_data.title if case_data.title and case_data.title != "Untitled Case" else "New Case"
    
    new_case = {
        "id": case_id,
        "title": title,
        "description": case_data.description,
        "parties_involved": case_data.parties_involved,
        "approximate_date": case_data.approximate_date,
        "objective": case_data.objective,
        "status": "New",
        "facts": [],
        "clauses": [],
        "timeline": [],
        "documents": [],
        "missing_info": [],
        "_text_chunks": []
    }
    db_cases[case_id] = new_case
    _save_case(new_case)
    return public_case(new_case)


@app.get("/api/cases")
def list_cases():
    return [public_case(case) for case in db_cases.values()]


@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    if case_id in db_cases:
        return public_case(db_cases[case_id])
    raise HTTPException(status_code=404, detail="Case not found")


@app.get("/api/demo")
def get_demo_case():
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "demo_case.json")
    try:
        with open(fixture_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Demo fixture not found")


@app.post("/api/cases/{case_id}/documents")
async def upload_document(case_id: str, file: UploadFile = File(...)):
    if case_id not in db_cases:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Read file content for MVP synchronous processing
    content_bytes = await file.read()
    
    # Store document metadata
    doc_id = str(uuid.uuid4())
    doc_meta = {
        "id": doc_id,
        "name": file.filename,
        "type": file.content_type,
        "size": len(content_bytes)
    }
    
    db_cases[case_id]["documents"].append(doc_meta)
    
    text_content = _extract_text(file.filename or "", content_bytes)
    if text_content:
        try:
            _merge_analysis(db_cases[case_id], file.filename or "uploaded-document", text_content)
        except Exception as e:
            print(f"Failed to process document content: {e}")

    _save_case(db_cases[case_id])
            
    return {"message": "Document uploaded successfully", "document": doc_meta}


@app.post("/api/cases/{case_id}/analyze-missing")
def analyze_missing_info(case_id: str):
    """Re-analyze the case to identify missing information and evidence gaps."""
    if case_id not in db_cases:
        raise HTTPException(status_code=404, detail="Case not found")
    
    missing_items = ai_processor.analyze_missing_info(db_cases[case_id])
    
    # Replace existing missing info with fresh analysis
    db_cases[case_id]["missing_info"] = missing_items
    _save_case(db_cases[case_id])
    
    return {"missing_info": missing_items}


@app.post("/api/cases/{case_id}/reanalyze-documents")
def reanalyze_documents(case_id: str):
    """Retry analysis for text already extracted from uploaded documents."""
    if case_id not in db_cases:
        raise HTTPException(status_code=404, detail="Case not found")
    case = db_cases[case_id]
    grouped: dict[str, list[str]] = {}
    for chunk in case.get("_text_chunks", []):
        grouped.setdefault(chunk.get("document", "uploaded-document"), []).append(chunk.get("text", ""))
    if not grouped:
        raise HTTPException(status_code=422, detail="No extractable document text is available")
    case["facts"] = []
    case["timeline"] = []
    case["clauses"] = []
    case["missing_info"] = []
    case["_text_chunks"] = []
    for filename, chunks in grouped.items():
        _merge_analysis(case, filename, " ".join(chunks))
    _save_case(case)
    return public_case(case)


@app.post("/api/cases/{case_id}/lawyer-questions")
def lawyer_questions(case_id: str):
    if case_id not in db_cases:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"questions": ai_processor.generate_lawyer_questions(db_cases[case_id])}


@app.post("/api/cases/{case_id}/ask")
def ask_case_question(case_id: str, request: QuestionRequest):
    if case_id not in db_cases:
        raise HTTPException(status_code=404, detail="Case not found")
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be empty")
    return ai_processor.answer_case_question(db_cases[case_id], question).model_dump()


@app.post("/api/cases/{case_id}/generate-brief")
def generate_brief(case_id: str):
    if case_id not in db_cases:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"brief": ai_processor.generate_case_brief(db_cases[case_id])}


# The production container serves the Vite build from FastAPI. Local development
# continues to use the separate Vite dev server when this directory is absent.
static_directory = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_directory):
    app.mount("/", StaticFiles(directory=static_directory, html=True), name="frontend")
