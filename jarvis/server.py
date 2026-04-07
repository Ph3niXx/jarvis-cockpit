"""Jarvis — FastAPI server bridging the cockpit UI to LM Studio + Supabase RAG."""

import sys
import os
import time

# Ensure jarvis/ is on the Python path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from openai import OpenAI, APIConnectionError, APITimeoutError

from config import (
    LM_STUDIO_BASE_URL,
    LM_STUDIO_API_KEY,
    LLM_MODEL,
    LLM_MAX_TOKENS,
    SUPABASE_URL,
)
from retriever import search, search_and_format
from supabase_client import sb_get

# ── App ────────────────────────────────────────────────────────────

app = FastAPI(title="Jarvis Server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "null",                        # file:// sends Origin: null
        "http://localhost",
        "http://127.0.0.1",
        "https://ph3nixx.github.io",   # GitHub Pages
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.trycloudflare\.com$|^https://.*\.github\.io$",
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = (
    "Tu es Jarvis, l'assistant IA personnel de John. "
    "Tu es concis, précis, et tu parles français. "
    "Tu te bases sur le contexte fourni pour répondre. "
    "Si le contexte ne contient pas l'information demandée, dis-le honnêtement. "
    "/no_think"
)

_llm_client = None


def _get_llm():
    global _llm_client
    if _llm_client is None:
        _llm_client = OpenAI(base_url=LM_STUDIO_BASE_URL, api_key=LM_STUDIO_API_KEY, timeout=120.0)
    return _llm_client


# ── Models ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    history: list[dict] = Field(default_factory=list, max_length=10)


class SearchRequest(BaseModel):
    query: str
    k: int = 5
    threshold: float = 0.3


# ── Endpoints ──────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Check LM Studio + Supabase connectivity."""
    result = {"status": "ok", "lm_studio": False, "supabase": False, "vectors_count": 0}

    # LM Studio
    try:
        client = _get_llm()
        client.models.list()
        result["lm_studio"] = True
    except Exception:
        result["status"] = "degraded"

    # Supabase
    try:
        rows = sb_get("memories_vectors", "select=id&limit=10000")
        result["supabase"] = True
        result["vectors_count"] = len(rows) if rows else 0
    except Exception:
        result["status"] = "degraded"

    return result


@app.post("/chat")
def chat(req: ChatRequest):
    """RAG-augmented chat with Jarvis."""
    t0 = time.perf_counter()

    # 1. Retrieve context
    try:
        raw_results = search(req.question, k=5, threshold=0.3)
        context = search_and_format(req.question, k=5)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"RAG search failed: {e}")

    # 2. Build messages
    system = SYSTEM_PROMPT
    if context:
        system += "\n\n" + context

    messages = [{"role": "system", "content": system}]

    # Add conversation history (last 10)
    for msg in req.history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": req.question})

    # 3. Call LLM
    try:
        client = _get_llm()
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=LLM_MAX_TOKENS,
            temperature=0.3,
        )
    except (APIConnectionError, ConnectionError):
        raise HTTPException(status_code=503, detail="LM Studio is not running")
    except APITimeoutError:
        raise HTTPException(status_code=504, detail="LM Studio timeout (120s)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    answer = response.choices[0].message.content or ""
    tokens = response.usage.total_tokens if response.usage else 0

    # 4. Build sources summary
    sources = []
    for r in (raw_results or []):
        sources.append({
            "source_table": r.get("source_table", ""),
            "source_id": r.get("source_id", ""),
            "similarity": round(r.get("similarity", 0), 3),
            "chunk_preview": (r.get("chunk_text", ""))[:200],
        })

    return {
        "answer": answer,
        "sources": sources,
        "tokens_used": tokens,
        "latency_ms": elapsed_ms,
    }


@app.post("/search")
def search_endpoint(req: SearchRequest):
    """Raw semantic search (no LLM)."""
    try:
        results = search(req.query, k=req.k, threshold=req.threshold)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Search failed: {e}")

    return {
        "results": [
            {
                "source_table": r.get("source_table", ""),
                "source_id": r.get("source_id", ""),
                "similarity": round(r.get("similarity", 0), 3),
                "chunk_text": r.get("chunk_text", ""),
                "metadata": r.get("metadata", {}),
            }
            for r in (results or [])
        ]
    }


# ── Startup banner ─────────────────────────────────────────────────

def _startup_checks():
    print("\n" + "=" * 50)
    print("  JARVIS Server starting...")
    print("=" * 50)

    # LM Studio
    try:
        client = _get_llm()
        models = client.models.list()
        model_ids = [m.id for m in models.data]
        print(f"  [OK] LM Studio: connected ({len(model_ids)} models)")
    except Exception:
        print(f"  [!!] LM Studio: NOT reachable at {LM_STUDIO_BASE_URL}")

    # Supabase
    try:
        rows = sb_get("memories_vectors", "select=id&limit=10000")
        count = len(rows) if rows else 0
        print(f"  [OK] Supabase: connected ({count} vectors)")
    except Exception:
        print(f"  [!!] Supabase: NOT reachable")
        if not SUPABASE_URL:
            print("       -> SUPABASE_URL env var is empty!")

    print()
    print("  Ready on http://localhost:8765")
    print("  Endpoints: GET /health | POST /chat | POST /search")
    print("  CORS: enabled for localhost + file://")
    print("  Stop with Ctrl+C")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    _startup_checks()
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="warning")
