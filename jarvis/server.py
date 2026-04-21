"""Jarvis — FastAPI server bridging the cockpit UI to LM Studio + Supabase RAG."""

import asyncio
import json
import sys
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure jarvis/ is on the Python path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
import re

from openai import APIConnectionError, APITimeoutError

import requests as http_requests

from config import (
    LM_STUDIO_BASE_URL,
    LLM_MAX_TOKENS,
    SUPABASE_URL,
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    CLAUDE_API_URL,
    OBSERVER_INTERVAL_S,
    OUTLOOK_INTERVAL_S,
    DAILY_BRIEF_HOUR,
)
from llm_client import chat_completion_async, chat_completion_sync, check_lm_studio, get_client, _strip_thinking
from retriever import search, search_and_format
from embeddings import embed_text
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

SYSTEM_PROMPT_BASE = (
    "Tu es Jarvis, l'assistant IA personnel de Jean. "
    "Tu es concis, précis, direct, et tu parles français. "
    "Jean utilise un cockpit IA qui agrège sa veille (IA, sport, gaming, anime/ciné, actus), "
    "ses projets RTE, son profil, sa mémoire structurée, et des opportunités business. "
    "Tu es généraliste : tu peux parler de tech, business, sport, perso, culture, santé, "
    "bref tout ce qui l'intéresse. Ne te limite jamais à un domaine. "
    "Quand un contexte (RAG) t'est fourni dans le system prompt, base-toi dessus en priorité "
    "et cite les sources pertinentes. Quand aucun contexte RAG n'est fourni (mode Rapide), "
    "utilise tes connaissances générales. Si la question concerne une info spécifique au cockpit "
    "de Jean (ses articles, sa mémoire, ses opportunités) et qu'aucun RAG n'est disponible, "
    "précise que tu es en mode Rapide et suggère de passer en mode Deep pour accéder au RAG."
)

def system_prompt_for(mode: str, thinking: str = "auto") -> str:
    """Append /no_think on quick mode only (default behaviour).

    On Qwen3 Thinking variants this flag switches off the <think>…</think>
    chain-of-thought. Default logic: OFF for 'quick' (chat answers should
    be instant), ON for 'deep' (RAG + reasoning over retrieved context).
    'cloud' goes through Claude — the flag is ignored there.

    Callers can force either side via `thinking`:
      - 'on'   → never add /no_think (Qwen thinks even in quick)
      - 'off'  → always add /no_think (Qwen skips thinking even in deep)
      - 'auto' → mode-based default
    """
    if thinking == "on":
        return SYSTEM_PROMPT_BASE
    if thinking == "off":
        return SYSTEM_PROMPT_BASE + " /no_think"
    # auto
    if mode == "quick":
        return SYSTEM_PROMPT_BASE + " /no_think"
    return SYSTEM_PROMPT_BASE


# Back-compat alias so other modules importing SYSTEM_PROMPT still work.
SYSTEM_PROMPT = SYSTEM_PROMPT_BASE + " /no_think"


# ── Models ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    history: list[dict] = Field(default_factory=list, max_length=10)
    mode: str = "quick"  # "quick" = direct LLM, "deep" = RAG + LLM
    session_id: str = ""  # browser session UUID for conversation persistence
    thinking: str = "auto"  # "auto" | "on" | "off" — override the default /no_think logic


class SearchRequest(BaseModel):
    query: str
    k: int = 5
    threshold: float = 0.3


# ── Endpoints ──────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Check LM Studio + Supabase + nightly_learner health."""
    result = {
        "status": "healthy",
        "lm_studio": "unreachable",
        "supabase": False,
        "vectors_count": 0,
        "active_facts": 0,
        "last_nightly_run": "never",
        "nightly_stats": {},
    }

    # LM Studio (fast ping, 2s timeout)
    lm_status = check_lm_studio(timeout=2)
    result["lm_studio"] = lm_status
    if lm_status != "connected":
        result["status"] = "degraded"

    # Supabase — vectors count
    try:
        rows = sb_get("memories_vectors", "select=id&limit=10000")
        result["supabase"] = True
        result["vectors_count"] = len(rows) if rows else 0
    except Exception:
        result["status"] = "degraded"

    # Supabase — active profile facts
    try:
        facts = sb_get("profile_facts", "superseded_by=is.null&select=id")
        result["active_facts"] = len(facts) if facts else 0
    except Exception:
        pass

    # Nightly learner state
    state_file = Path("jarvis_data/nightly_learner_state.json")
    if state_file.exists():
        try:
            nightly = json.loads(state_file.read_text(encoding="utf-8"))
            result["last_nightly_run"] = nightly.get("last_run", "never")
            result["nightly_stats"] = nightly.get("last_stats", {})
            if nightly.get("last_result") == "empty_extraction":
                result["status"] = "degraded"
            # Stale if last run > 36h ago
            last_run = nightly.get("last_run")
            if last_run:
                last_dt = datetime.fromisoformat(last_run)
                if (datetime.now(timezone.utc) - last_dt).total_seconds() > 36 * 3600:
                    result["status"] = "degraded"
        except Exception:
            pass
    else:
        result["status"] = "no_data"

    # LLM traces (last hour)
    trace_file = Path("jarvis_data/llm_traces.jsonl")
    if not trace_file.exists():
        result["llm_traces"] = "no_data"
    else:
        try:
            lines = trace_file.read_text(encoding="utf-8").splitlines()[-100:]
            now = datetime.now(timezone.utc)
            one_hour_ago = now - timedelta(hours=1)
            recent = []
            last_ts = None
            for line in lines:
                try:
                    span = json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue
                last_ts = span.get("ts", last_ts)
                ts = span.get("ts")
                if ts:
                    span_dt = datetime.fromisoformat(ts)
                    if span_dt >= one_hour_ago:
                        recent.append(span)

            ok_count = sum(1 for s in recent if s.get("status") == "ok")
            avg_lat = round(sum(s.get("latency_ms", 0) for s in recent) / len(recent)) if recent else 0
            result["llm_traces"] = {
                "last_trace_ts": last_ts or "never",
                "traces_1h": len(recent),
                "success_rate_1h": round(ok_count / len(recent) * 100, 1) if recent else 0,
                "avg_latency_ms": avg_lat,
            }
        except Exception:
            result["llm_traces"] = "error"

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


async def _call_local_llm(messages: list, mode: str) -> tuple[str, int]:
    """Call LM Studio local LLM via centralized client. Returns (answer, tokens).

    Qwen3 4B Thinking 2507 is trained to always reason before answering,
    so even with /no_think injected we often see most of the budget spent
    inside <think>…</think> blocks. We give 'quick' 1536 tokens (was 512)
    to leave room for both a short reasoning trace AND a final answer —
    otherwise the stripper eats everything and the user sees '—'.
    """
    is_quick = mode == "quick"
    return await chat_completion_async(
        messages,
        max_tokens=1536 if is_quick else LLM_MAX_TOKENS,
        temperature=0.3,
    )


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
    return _strip_thinking(answer), tokens


def _compact_history(history: list[dict], max_recent: int = 4) -> list[dict]:
    """Summarize old messages when history is long, keeping recent ones intact.

    Returns a compacted history: [summary_msg] + recent_messages.
    Falls back to original history on any error.
    """
    if len(history) <= max_recent + 2:
        return history

    old_messages = history[:-max_recent]
    recent_messages = history[-max_recent:]

    # Format old messages for summarization
    lines = []
    for msg in old_messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            speaker = "Jean" if role == "user" else "Jarvis"
            lines.append(f"{speaker}: {content[:500]}")

    if not lines:
        return history

    prompt = (
        "Resume cette conversation en 2-3 phrases. "
        "Garde les decisions, les questions ouvertes et les faits importants. "
        "Ignore les salutations et bavardages.\n\n"
        + "\n".join(lines)
    )

    try:
        before_chars = sum(len(m.get("content", "")) for m in old_messages)
        summary, _tokens = chat_completion_sync(
            [{"role": "user", "content": prompt}],
            max_tokens=256,
            temperature=0.3,
        )
        if not summary.strip():
            return history

        after_chars = len(summary)
        print(f"  [COMPACT] {len(old_messages)} messages -> 1 summary ({before_chars} -> {after_chars} chars)")

        summary_msg = {"role": "system", "content": f"[Resume conversation precedente] {summary}"}
        return [summary_msg] + recent_messages
    except Exception as e:
        print(f"  [WARN] History compaction failed: {e}")
        return history


def _get_activity_context(question: str) -> str:
    """Inject today's activity context if question is about activity. Returns formatted text or ""."""
    q_lower = question.lower()
    activity_keywords = ["fait aujourd", "fait quoi", "journée", "activité", "réunion", "meeting", "email", "mail", "outlook", "agenda", "calendrier"]
    if not any(kw in q_lower for kw in activity_keywords):
        return ""

    try:
        from observers.daily_brief_generator import _build_stats_text
        from observers.window_observer import read_day_entries, compute_stats
        from observers.outlook_observer import read_outlook_data
        from datetime import date as dt_date

        today = dt_date.today()
        entries = read_day_entries(today)
        outlook = read_outlook_data(today)
        if not entries and not outlook:
            return ""

        stats = compute_stats(entries) if entries else {}
        result = (
            f"\n\n[Activité observée aujourd'hui ({today.isoformat()})]\n"
            + _build_stats_text(stats, outlook=outlook if outlook else None)
        )
        if outlook and outlook.get("meetings"):
            meetings_list = ", ".join(
                f"{m['start']}-{m['end']} {m['subject']}" + (" (Teams)" if m.get("is_teams") else "")
                for m in outlook["meetings"]
            )
            result += f"\nRéunions détail : {meetings_list}"
        return result
    except Exception as e:
        print(f"  [WARN] Activity context injection failed: {e}")
        return ""


def _build_context(question: str, mode: str, history: list[dict], thinking: str = "auto") -> tuple[list, list]:
    """Build system prompt + messages list with RAG, activity and profile facts.

    Returns (messages, raw_results) where raw_results are the RAG search hits
    (empty list if mode == "quick").
    """
    use_rag = mode in ("deep", "cloud")

    # 1. Retrieve RAG context (deep + cloud modes)
    raw_results = []
    context = ""
    if use_rag:
        try:
            qvec = embed_text(question)
            raw_results = search(question, k=5, threshold=0.3, query_vector=qvec)
            context = search_and_format(question, k=5, query_vector=qvec)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"RAG search failed: {e}")

    activity_context = _get_activity_context(question)

    # 2. Build system prompt with profile facts.
    # system_prompt_for() handles /no_think placement. Honour the user's
    # override (Settings → Thinking) if they want to force it on or off
    # regardless of the mode.
    system = system_prompt_for(mode, thinking)
    profile_context = _get_profile_facts()
    if profile_context:
        system += "\n\n" + profile_context
    if activity_context:
        system += activity_context
    if context:
        system += "\n\n" + context

    messages = [{"role": "system", "content": system}]

    # Compact long histories (skip in quick mode — short conversations)
    compacted = _compact_history(history) if mode != "quick" else history
    did_compact = len(compacted) < len(history)
    compacted_count = len(history) - len(compacted) + 1 if did_compact else 0  # +1 = summary replaces N msgs

    # Inject compaction summary (system message) if present
    for msg in compacted:
        if msg.get("role") == "system" and msg.get("content", "").startswith("[Resume"):
            messages.append(msg)
            break

    # Sanitize history: enforce strict user/assistant alternation (Qwen3.5 requirement)
    last_role = "system"
    for msg in compacted[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content and role != last_role:
            messages.append({"role": role, "content": content})
            last_role = role

    # Ensure last history message isn't "user" (we add the real question next)
    if messages[-1]["role"] == "user":
        messages.pop()

    messages.append({"role": "user", "content": question})

    compaction_info = {"compacted": did_compact, "compacted_count": compacted_count}
    return messages, raw_results, compaction_info


async def _route_llm(messages: list, mode: str) -> tuple[str, int, str]:
    """Route to the right LLM backend. Returns (answer, tokens, backend)."""
    backend = "local"
    try:
        if mode == "cloud":
            try:
                system = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
                answer, tokens = _call_claude(system, messages)
                backend = "claude"
            except ValueError as e:
                # Fallback to local if API key missing or API error
                print(f"  [WARN] Cloud fallback to local: {e}")
                answer, tokens = await _call_local_llm(messages, "deep")
        else:
            answer, tokens = await _call_local_llm(messages, mode)
    except (APIConnectionError, ConnectionError):
        raise HTTPException(status_code=503, detail="LM Studio is not running")
    except APITimeoutError:
        raise HTTPException(status_code=504, detail="LM Studio timeout (60s)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    return answer, tokens, backend


def _persist_exchange(session_id: str, question: str, answer: str, mode: str, tokens: int):
    """Save user + assistant messages to jarvis_conversations."""
    _save_conversation(session_id, "user", question, mode)
    _save_conversation(session_id, "assistant", answer, mode, tokens)


@app.post("/chat")
async def chat(req: ChatRequest):
    """RAG-augmented chat with Jarvis. Routes to local LLM or Claude cloud."""
    t0 = time.perf_counter()

    messages, raw_results, compaction_info = _build_context(req.question, req.mode, req.history, getattr(req, "thinking", "auto"))
    answer, tokens, backend = await _route_llm(messages, req.mode)
    _persist_exchange(req.session_id, req.question, answer, req.mode, tokens)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    # Build sources summary
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
        "compacted": compaction_info["compacted"],
        "compacted_count": compaction_info["compacted_count"],
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


# ── Observers ─────────────────────────────────────────────────────

_window_observer = None
_outlook_observer = None


# ── Schedulers ────────────────────────────────────────────────────

async def _nightly_scheduler():
    """Background task: run nightly_learner.run() every day at midnight local time."""
    while True:
        now = datetime.now()
        tomorrow_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        wait_seconds = (tomorrow_midnight - now).total_seconds()
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
            target += timedelta(days=1)
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
    global _window_observer, _outlook_observer

    # Start window observer
    try:
        from observers.window_observer import WindowObserver
        _window_observer = WindowObserver(interval_s=OBSERVER_INTERVAL_S)
        asyncio.create_task(_window_observer.start())
        print(f"  [OK] Window observer started (interval={OBSERVER_INTERVAL_S}s)")
    except Exception as e:
        print(f"  [!!] Window observer failed to start: {e}")

    # Start Outlook observer
    try:
        from observers.outlook_observer import OutlookObserver
        _outlook_observer = OutlookObserver(interval_s=OUTLOOK_INTERVAL_S)
        asyncio.create_task(_outlook_observer.start())
        print(f"  [OK] Outlook observer started (interval={OUTLOOK_INTERVAL_S}s)")
    except ImportError:
        print("  [!!] pywin32 not installed, Outlook observer disabled")
    except Exception as e:
        print(f"  [!!] Outlook observer failed to start: {e}")

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
    """Return today's activity stats (window + outlook merged)."""
    result = {}
    if _window_observer:
        result["window"] = _window_observer.get_today_stats()
    if _outlook_observer:
        result["outlook"] = _outlook_observer.get_today_data()
    if not result:
        raise HTTPException(status_code=503, detail="No observers running")
    return result


@app.get("/outlook")
def get_outlook():
    """Return today's Outlook snapshot (meetings + emails)."""
    if _outlook_observer is None:
        raise HTTPException(status_code=503, detail="Outlook observer not running")
    return _outlook_observer.get_today_data()


@app.post("/poll-outlook")
async def poll_outlook_now():
    """Force an immediate Outlook poll."""
    try:
        from observers.outlook_observer import _poll_outlook, _save_snapshot, _executor
        from datetime import date as dt_date
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(_executor, _poll_outlook)
        if data:
            _save_snapshot(dt_date.today(), data)
            if _outlook_observer:
                _outlook_observer._last_data = data
        return data if data else {"status": "no_data"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outlook poll failed: {e}")


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
        client = get_client()
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
    print("             POST /nightly-learner | GET /activity | GET /outlook")
    print("             POST /generate-activity-brief")
    print("  CORS: enabled for localhost + file://")
    print("  Stop with Ctrl+C")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    _startup_checks()
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="warning")
