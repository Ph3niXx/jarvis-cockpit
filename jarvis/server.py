"""Jarvis — FastAPI server bridging the cockpit UI to LM Studio + Supabase RAG."""

import asyncio
import sys
import os
import time
from datetime import datetime, timezone

# Ensure jarvis/ is on the Python path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from openai import OpenAI, APIConnectionError, APITimeoutError

import requests as http_requests

from config import (
    LM_STUDIO_BASE_URL,
    LM_STUDIO_API_KEY,
    LLM_MODEL,
    LLM_MAX_TOKENS,
    SUPABASE_URL,
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    CLAUDE_API_URL,
    OBSERVER_INTERVAL_S,
    DAILY_BRIEF_HOUR,
)
from retriever import search, search_and_format
from supabase_client import sb_get, sb_post

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
    mode: str = "quick"  # "quick" = direct LLM, "deep" = RAG + LLM
    session_id: str = ""  # browser session UUID for conversation persistence


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


def _get_profile_facts() -> str:
    """Fetch active profile facts for system prompt injection."""
    try:
        rows = sb_get(
            "profile_facts",
            "superseded_by=is.null&order=created_at.desc&limit=15&select=fact_type,fact_text",
        )
        if not rows:
            return ""
        lines = [f"- {r['fact_type']}: {r['fact_text']}" for r in rows]
        return "[Ce que tu sais sur Jean]\n" + "\n".join(lines)
    except Exception:
        return ""


def _save_conversation(session_id: str, role: str, content: str, mode: str, tokens: int = 0):
    """Save a message to jarvis_conversations (fire-and-forget)."""
    if not session_id:
        return
    try:
        sb_post("jarvis_conversations", {
            "session_id": session_id,
            "role": role,
            "content": content,
            "mode": mode,
            "tokens_used": tokens,
        })
    except Exception as e:
        print(f"  [WARN] save_conversation: {e}")


def _call_local_llm(messages: list, mode: str) -> tuple[str, int]:
    """Call LM Studio local LLM. Returns (answer, tokens)."""
    is_quick = mode == "quick"
    client = _get_llm()
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        max_tokens=512 if is_quick else LLM_MAX_TOKENS,
        temperature=0.3,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}} if is_quick else {},
    )
    answer = response.choices[0].message.content or ""
    tokens = response.usage.total_tokens if response.usage else 0
    return answer, tokens


def _call_claude(system: str, messages: list) -> tuple[str, int]:
    """Call Claude Haiku API. Returns (answer, tokens)."""
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not set")

    # Convert OpenAI-style messages to Claude format (no system in messages)
    claude_messages = []
    for msg in messages:
        if msg["role"] in ("user", "assistant"):
            claude_messages.append({"role": msg["role"], "content": msg["content"]})

    r = http_requests.post(
        CLAUDE_API_URL,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": 4096,
            "system": system,
            "messages": claude_messages,
        },
        timeout=120,
    )
    if r.status_code != 200:
        raise ValueError(f"Claude API {r.status_code}: {r.text[:200]}")

    data = r.json()
    answer = ""
    for block in data.get("content", []):
        if block.get("type") == "text":
            answer += block.get("text", "")

    usage = data.get("usage", {})
    tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
    return answer, tokens


@app.post("/chat")
def chat(req: ChatRequest):
    """RAG-augmented chat with Jarvis. Routes to local LLM or Claude cloud."""
    t0 = time.perf_counter()
    use_rag = req.mode in ("deep", "cloud")

    # 1. Retrieve RAG context (deep + cloud modes)
    raw_results = []
    context = ""
    if use_rag:
        try:
            raw_results = search(req.question, k=5, threshold=0.3)
            context = search_and_format(req.question, k=5)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"RAG search failed: {e}")

    # 2. Build messages with profile facts injection
    system = SYSTEM_PROMPT
    profile_context = _get_profile_facts()
    if profile_context:
        system += "\n\n" + profile_context
    if context:
        system += "\n\n" + context

    messages = [{"role": "system", "content": system}]

    for msg in req.history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": req.question})

    # 3. Route to the right LLM backend
    backend = "local"
    try:
        if req.mode == "cloud":
            try:
                answer, tokens = _call_claude(system, messages)
                backend = "claude"
            except ValueError as e:
                # Fallback to local if API key missing or API error
                print(f"  [WARN] Cloud fallback to local: {e}")
                answer, tokens = _call_local_llm(messages, "deep")
        else:
            answer, tokens = _call_local_llm(messages, req.mode)
    except (APIConnectionError, ConnectionError):
        raise HTTPException(status_code=503, detail="LM Studio is not running")
    except APITimeoutError:
        raise HTTPException(status_code=504, detail="LM Studio timeout (120s)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    # 4. Save conversation to Supabase
    _save_conversation(req.session_id, "user", req.question, req.mode)
    _save_conversation(req.session_id, "assistant", answer, req.mode, tokens)

    # 5. Build sources summary
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
        "backend": backend,
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


@app.post("/generate-status")
def generate_status():
    """Run the status generator and return the snapshot."""
    try:
        from status_generator import load_yaml, get_chunks_count, get_api_cost_month, \
            get_git_stats, get_yaml_freshness, generate_prose, sb_upsert_service
        from datetime import datetime, timezone

        yaml_data = load_yaml()
        metrics = {
            "chunks_indexed": get_chunks_count(),
            "commits_this_month": get_git_stats()["commits_this_month"],
            "last_commit_relative": get_git_stats()["last_commit_relative"],
            "last_commit_iso": get_git_stats()["last_commit_iso"],
            "api_cost_eur_month": get_api_cost_month(),
        }
        prose = generate_prose(yaml_data, metrics)
        freshness = get_yaml_freshness()
        now_iso = datetime.now(tz=timezone.utc).isoformat()

        snapshot = {
            "current_phase": yaml_data["current_phase"],
            "phases": yaml_data["phases"],
            "next_step": yaml_data.get("next_step", ""),
            "prose": prose,
            "metrics": metrics,
            "freshness": {"snapshot_generated_at": now_iso, **freshness},
        }
        ok = sb_upsert_service("jarvis_status_snapshot", {"id": 1, "snapshot_data": snapshot, "generated_at": now_iso})
        return {"status": "ok" if ok else "upsert_failed", "prose_length": len(prose), "snapshot": snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status generation failed: {e}")


# ── Window Observer ────────────────────────────────────────────────

_window_observer = None


# ── Schedulers ────────────────────────────────────────────────────

async def _nightly_scheduler():
    """Background task: run nightly_learner.run() every day at midnight local time."""
    while True:
        now = datetime.now()
        tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if tomorrow <= now:
            tomorrow = tomorrow.replace(day=now.day + 1)
        wait_seconds = (tomorrow - now).total_seconds()
        print(f"  [SCHEDULER] Prochain nightly_learner dans {wait_seconds/3600:.1f}h (minuit)")
        await asyncio.sleep(wait_seconds)

        print(f"  [SCHEDULER] Lancement nightly_learner...")
        try:
            from nightly_learner import run as nl_run
            result = nl_run()
            print(f"  [SCHEDULER] nightly_learner terminé: {result}")
        except Exception as e:
            print(f"  [SCHEDULER] nightly_learner erreur: {e}")


async def _daily_brief_scheduler():
    """Background task: generate activity brief every day at DAILY_BRIEF_HOUR."""
    while True:
        now = datetime.now()
        target = now.replace(hour=DAILY_BRIEF_HOUR, minute=0, second=0, microsecond=0)
        if target <= now:
            target = target.replace(day=now.day + 1)
        wait_seconds = (target - now).total_seconds()
        print(f"  [SCHEDULER] Prochain activity brief dans {wait_seconds/3600:.1f}h ({DAILY_BRIEF_HOUR}h)")
        await asyncio.sleep(wait_seconds)

        print(f"  [SCHEDULER] Génération du brief d'activité...")
        try:
            from observers.daily_brief_generator import generate_brief
            result = generate_brief()  # defaults to yesterday
            print(f"  [SCHEDULER] Brief d'activité terminé: {result.get('status')}")
        except Exception as e:
            print(f"  [SCHEDULER] Brief d'activité erreur: {e}")


@app.on_event("startup")
async def _start_background_tasks():
    global _window_observer

    # Start window observer
    try:
        from observers.window_observer import WindowObserver
        _window_observer = WindowObserver(interval_s=OBSERVER_INTERVAL_S)
        asyncio.create_task(_window_observer.start())
        print(f"  [OK] Window observer started (interval={OBSERVER_INTERVAL_S}s)")
    except Exception as e:
        print(f"  [!!] Window observer failed to start: {e}")

    # Start schedulers
    asyncio.create_task(_nightly_scheduler())
    asyncio.create_task(_daily_brief_scheduler())


# ── Manual trigger endpoints ──────────────────────────────────────

@app.post("/nightly-learner")
def trigger_nightly_learner(days: int = None):
    """Manually trigger the nightly learner."""
    try:
        from nightly_learner import run as nl_run
        result = nl_run(days=days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Nightly learner failed: {e}")


@app.get("/activity")
def get_activity():
    """Return today's activity stats from the window observer."""
    if _window_observer is None:
        raise HTTPException(status_code=503, detail="Window observer not running")
    return _window_observer.get_today_stats()


@app.post("/generate-activity-brief")
def trigger_activity_brief(date: str = None):
    """Manually trigger activity brief generation for a specific date."""
    try:
        from observers.daily_brief_generator import generate_brief
        result = generate_brief(date_str=date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brief generation failed: {e}")


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
    print("             POST /nightly-learner | GET /activity | POST /generate-activity-brief")
    print("  CORS: enabled for localhost + file://")
    print("  Stop with Ctrl+C")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    _startup_checks()
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="warning")
