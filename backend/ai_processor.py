import os
import json
import re
import time
try:
    from google import genai
except ImportError:  # Local demo mode can run without the optional AI package.
    genai = None
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Define the structured output schema for Gemini

class Fact(BaseModel):
    fact: str
    confidence: str
    source_passage: str

class TimelineEvent(BaseModel):
    date: str
    event: str
    evidence: str
    status: str = "document_supported"

class MissingInfo(BaseModel):
    item: str
    reason: str
    suggestion: str

class Clause(BaseModel):
    category: str
    plain_language: str
    original_text: str
    source: str
    attention_note: str

class DocumentAnalysis(BaseModel):
    facts: List[Fact]
    timeline_events: List[TimelineEvent]
    missing_info: List[MissingInfo]
    clauses: List[Clause]


def _get_client():
    """Returns a configured Gemini client, or None if no API key."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or genai is None:
        return None
    return genai.Client(api_key=api_key)


def _get_model():
    """Returns the configured model name."""
    return os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


def _generate_content(client, contents: str, schema=None, temperature: float = 0.2):
    """Call Gemini with a short retry and configurable model fallback."""
    models = [_get_model(), os.getenv("GEMINI_FALLBACK_MODEL", "gemini-flash-lite-latest")]
    models = list(dict.fromkeys(model for model in models if model))
    last_error = None
    for model in models:
        for attempt in range(2):
            try:
                config_kwargs = {"temperature": temperature}
                if schema is not None:
                    config_kwargs.update({"response_mime_type": "application/json", "response_schema": schema})
                return client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=genai.types.GenerateContentConfig(**config_kwargs),
                )
            except Exception as error:
                last_error = error
                error_text = str(error)
                if "404" in error_text or "NOT_FOUND" in error_text:
                    break
                if attempt == 0 and ("503" in error_text or "429" in error_text or "UNAVAILABLE" in error_text):
                    time.sleep(1)
                    continue
                break
    raise last_error or RuntimeError("Gemini did not return a response")


def analyze_document_content(content: str, document_name: str, case_context: dict) -> DocumentAnalysis:
    """
    Analyzes document text using Gemini and extracts facts, timeline events,
    clauses, and missing information.
    """
    client = _get_client()

    # If no API key is provided, return dummy data to prevent crashing in demo mode
    if not client:
        print("WARNING: No GEMINI_API_KEY found. Returning dummy analysis data.")
        return DocumentAnalysis(
            facts=[Fact(fact=f"Mock extracted fact from {document_name}", confidence="document_supported", source_passage="...")],
            timeline_events=[TimelineEvent(date="2026-01-01", event=f"Mock event from {document_name}", evidence=document_name, status="document_supported")],
            missing_info=[MissingInfo(item="Mock missing info", reason="No API key configured", suggestion="Configure GEMINI_API_KEY")],
            clauses=[Clause(category="General", plain_language=f"Mock clause from {document_name}", original_text="...", source=document_name, attention_note="Review this clause")]
        )

    prompt = f"""You are CaseCompass, a legal case preparation assistant.
Analyze the following document named "{document_name}".

Context of the case:
Title: {case_context.get('title', '')}
Description: {case_context.get('description', '')}
Parties: {case_context.get('parties_involved', '')}
Objective: {case_context.get('objective', '')}

Extract the following from the document:

1. **Facts**: Key factual statements supported by this document. For each fact, provide:
   - The fact statement
   - A confidence level: "document_supported" if clearly stated, "user_reported" if inferred, or "needs_confirmation" if unclear
   - The exact source passage from the document that supports this fact

2. **Timeline Events**: Any chronological events with dates explicitly or implicitly mentioned. For each event:
   - The date (ISO format YYYY-MM-DD if possible, otherwise best approximation)
   - Description of the event
   - The evidence source (use the document name: "{document_name}")
   - Status: "document_supported" or "unclear"

3. **Clauses**: Important contractual or legal clauses found in the document. For each clause:
   - Category (e.g. Payment, Termination, Notice, Liability, Dispute Resolution, Confidentiality, etc.)
   - A plain-language explanation of what the clause means
   - The original text of the clause
   - Source document name: "{document_name}"
   - An attention note explaining why this clause may deserve review (do NOT label clauses as legal/illegal/fair/unfair)

4. **Missing Information**: Based on the document and case context, what important information appears to be missing. For each item:
   - What is missing
   - Why it matters
   - A suggestion for the user (use cautious language like "you may want to..." or "consider gathering...")

Document Content:
{content[:15000]}
"""

    try:
        response = _generate_content(client, prompt, DocumentAnalysis, 0.2)
        return DocumentAnalysis.model_validate_json(response.text)
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        # Keep the uploaded document visible when the remote AI service is unavailable.
        return DocumentAnalysis(
            facts=[Fact(
                fact=f"Document '{document_name}' was uploaded and is available for review.",
                confidence="document_supported",
                source_passage=content[:500],
            )],
            timeline_events=[],
            missing_info=[MissingInfo(
                item="AI extraction could not be completed",
                reason="The document was saved, but the Gemini service did not respond successfully.",
                suggestion="Try analyzing the document again when the AI service is available.",
            )],
            clauses=[],
        )


class MissingInfoAnalysis(BaseModel):
    missing_items: List[MissingInfo]


class CaseQuestions(BaseModel):
    questions: List[str]


class CaseAnswer(BaseModel):
    answer: str
    sources: List[str]
    limitation: str


class CaseBrief(BaseModel):
    brief: str


def analyze_missing_info(case_context: dict) -> List[MissingInfo]:
    """
    Analyzes the full case context and identifies missing information,
    documents, and evidence gaps.
    """
    client = _get_client()

    if not client:
        print("WARNING: No GEMINI_API_KEY found. Returning empty missing info.")
        return []

    # Build a summary of what the case currently has
    facts_summary = ""
    if case_context.get("facts"):
        facts_summary = "\n".join([f"- {f['fact']} (source: {f.get('evidence', 'unknown')})" for f in case_context["facts"]])
    
    docs_summary = ""
    if case_context.get("documents"):
        docs_summary = "\n".join([f"- {d['name']} ({d.get('type', 'unknown')})" for d in case_context["documents"]])

    clauses_summary = ""
    if case_context.get("clauses"):
        clauses_summary = "\n".join([f"- [{c['category']}] {c['plain_language']}" for c in case_context["clauses"]])

    prompt = f"""You are CaseCompass, a legal case preparation assistant.

Analyze the current state of this case and identify what information, documents, or evidence may still be missing or unclear.

Case Title: {case_context.get('title', '')}
Description: {case_context.get('description', '')}
Parties: {case_context.get('parties_involved', '')}
Objective: {case_context.get('objective', '')}

Currently known facts:
{facts_summary or "No facts extracted yet."}

Currently uploaded documents:
{docs_summary or "No documents uploaded yet."}

Currently identified clauses:
{clauses_summary or "No clauses identified yet."}

For each missing item, provide:
- What is missing (item)
- Why it matters for the case (reason)
- A suggestion using cautious language like "you may want to..." or "consider gathering..."

Focus on actionable, practical gaps. Do not generate speculative legal conclusions.
"""

    try:
        response = _generate_content(client, prompt, MissingInfoAnalysis, 0.3)
        result = MissingInfoAnalysis.model_validate_json(response.text)
        return [item.model_dump() for item in result.missing_items]
    except Exception as e:
        print(f"Error analyzing missing info: {e}")
        return []


def _case_context_text(case_context: dict) -> str:
    """Build a bounded context shared by the generation features."""
    facts = "\n".join(
        f"- {item.get('fact', '')} (source: {item.get('evidence', 'unknown')})"
        for item in case_context.get("facts", [])
    )
    timeline = "\n".join(
        f"- {item.get('date', '')}: {item.get('event', '')} (source: {item.get('evidence', 'unknown')})"
        for item in case_context.get("timeline", [])
    )
    clauses = "\n".join(
        f"- [{item.get('category', '')}] {item.get('plain_language', '')} (source: {item.get('source', 'unknown')})"
        for item in case_context.get("clauses", [])
    )
    missing = "\n".join(
        f"- {item.get('item', '')}: {item.get('reason', '')}"
        for item in case_context.get("missing_info", [])
        if isinstance(item, dict)
    )
    documents = ", ".join(item.get("name", "") for item in case_context.get("documents", []))
    return f"""Case: {case_context.get('title', '')}
Description: {case_context.get('description', '')}
Parties: {case_context.get('parties_involved', '')}
Objective: {case_context.get('objective', '')}
Documents: {documents or 'None'}
Facts:
{facts or 'None'}
Timeline:
{timeline or 'None'}
Clauses:
{clauses or 'None'}
Missing information:
{missing or 'None'}"""[:24000]


def retrieve_case_passages(case_context: dict, question: str, limit: int = 4) -> list[dict]:
    """Rank uploaded text passages by simple token overlap for local MVP retrieval."""
    query_terms = {token for token in re.findall(r"[a-z0-9]+", question.lower()) if len(token) > 3}
    ranked = []
    for chunk in case_context.get("_text_chunks", []):
        terms = set(re.findall(r"[a-z0-9]+", chunk.get("text", "").lower()))
        score = len(query_terms & terms)
        if score:
            ranked.append((score, chunk))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in ranked[:limit]]


def _fallback_case_answer(case_context: dict, passages: list[dict]) -> CaseAnswer:
    sources = [item.get("document", "") for item in passages if item.get("document")]
    if not sources:
        sources = [item.get("name", "") for item in case_context.get("documents", []) if item.get("name")]
    if passages:
        material = " ".join(item.get("text", "") for item in passages)
        return CaseAnswer(
            answer=f"I found this relevant material in the uploaded document: {material} Review the source document before relying on it.",
            sources=sources,
            limitation="Gemini is temporarily unavailable, so this is a document passage lookup rather than an AI-generated legal analysis.",
        )
    facts = [item.get("fact", "") for item in case_context.get("facts", []) if item.get("fact")]
    if facts:
        return CaseAnswer(
            answer="The case currently records these extracted facts: " + "; ".join(facts[:5]),
            sources=sources,
            limitation="Gemini is temporarily unavailable. Review the linked source documents before relying on these facts.",
        )
    return CaseAnswer(
        answer="The document was saved, but no extracted facts are available yet. Gemini may be temporarily unavailable; please try again after the service recovers.",
        sources=sources,
        limitation="This case assistant is informational preparation material, not legal advice.",
    )


def generate_lawyer_questions(case_context: dict) -> List[str]:
    fallback_questions = [
        "What outcome would you like to achieve, and what deadline matters most?",
        "Which facts are supported by documents, and which are based only on memory or reports?",
        "Are there additional contracts, messages, receipts, notices, or photographs that should be collected?",
        "What communications have you had with the other party since the issue began?",
        "Are there any upcoming deadlines, hearings, limitation periods, or required notices?",
    ]
    client = _get_client()
    if not client:
        return fallback_questions

    prompt = f"""You are a legal case preparation assistant. Generate 6 concise, neutral questions a person can take to a qualified legal professional.
Do not give legal advice or conclusions. Focus on facts, evidence, deadlines, objectives, and practical next steps.
Return questions only.

{_case_context_text(case_context)}"""
    try:
        response = _generate_content(client, prompt, CaseQuestions, 0.3)
        return CaseQuestions.model_validate_json(response.text).questions
    except Exception as e:
        print(f"Error generating lawyer questions: {e}")
        return fallback_questions


def answer_case_question(case_context: dict, question: str) -> CaseAnswer:
    client = _get_client()
    passages = retrieve_case_passages(case_context, question)
    retrieved_text = "\n".join(f"[{item.get('document', 'document')}] {item.get('text', '')}" for item in passages)
    if not client:
        searchable = (_case_context_text(case_context) + "\n" + retrieved_text).lower()
        overlap = [word for word in question.lower().split() if len(word) > 4 and word in searchable]
        if overlap:
            relevant_material = retrieved_text or "; ".join(item.get("fact", "") for item in case_context.get("facts", [])[:3])
            return CaseAnswer(
                answer="Relevant material found in the case file: " + relevant_material + " Review the linked source documents before relying on it.",
                sources=[item.get("document", "") for item in passages] or [item.get("evidence", "") for item in case_context.get("facts", [])[:3] if item.get("evidence")],
                limitation="This answer uses the case information currently stored and is not legal advice.",
            )
        return _fallback_case_answer(case_context, passages)

    prompt = f"""Answer the user's question using only the case context below. Do not invent facts or give legal advice.
If the answer is not present, say so clearly and identify what information would help. Cite source document names when available.
Return a concise answer, a list of source names, and a limitation statement.

User question: {question}

Retrieved document passages:
{retrieved_text or 'No directly matching document passages were found.'}

{_case_context_text(case_context)}"""
    try:
        response = _generate_content(client, prompt, CaseAnswer, 0.2)
        return CaseAnswer.model_validate_json(response.text)
    except Exception as e:
        print(f"Error answering case question: {e}")
        return _fallback_case_answer(case_context, passages)


def generate_case_brief(case_context: dict) -> str:
    client = _get_client()
    if not client:
        facts = "\n".join(f"- {item.get('fact', '')} ({item.get('evidence', 'source unknown')})" for item in case_context.get("facts", [])) or "- No facts extracted yet."
        timeline = "\n".join(f"- {item.get('date', '')}: {item.get('event', '')}" for item in case_context.get("timeline", [])) or "- No timeline events recorded yet."
        missing = "\n".join(f"- {item.get('item', '')}" for item in case_context.get("missing_info", []) if isinstance(item, dict)) or "- No missing information recorded yet."
        return f"""# Case Brief: {case_context.get('title', 'Untitled Case')}

## Situation
{case_context.get('description', '')}

## Parties and Objective
- Parties: {case_context.get('parties_involved', '') or 'Not recorded'}
- Objective: {case_context.get('objective', '') or 'Not recorded'}

## Known Facts
{facts}

## Timeline
{timeline}

## Open Questions and Missing Information
{missing}

## Preparation Note
This is AI-generated preparation material for discussion with a qualified legal professional. It is not legal advice."""

    prompt = f"""Create a concise Markdown case brief from the context below with sections for Situation, Parties and Objective, Known Facts, Timeline, Key Clauses, Missing Information, and Questions for a Legal Professional.
Use cautious language, cite source document names where present, and include this exact final note: This is AI-generated preparation material for discussion with a qualified legal professional. It is not legal advice.

{_case_context_text(case_context)}"""
    try:
        response = _generate_content(client, prompt, temperature=0.2)
        return response.text
    except Exception as e:
        print(f"Error generating case brief: {e}")
        return "Unable to generate a case brief right now. Please try again.\n\nThis is not legal advice."
