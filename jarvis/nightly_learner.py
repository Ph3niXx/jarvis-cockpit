"""Jarvis — Nightly Learner: extract facts and entities from daily conversations.

Reads jarvis_conversations since last run (idempotent), groups by session,
sends each to Qwen3.5 local for structured extraction, and upserts
results into profile_facts and entities tables.

Usage:
    python jarvis/nightly_learner.py
    python jarvis/nightly_learner.py --days=3   # reprocess last 3 days (ignores checkpoint)
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

from config import SUPABASE_URL, SUPABASE_KEY, LM_STUDIO_BASE_URL
from supabase_client import sb_get, sb_post, sb_patch

STATE_DIR = Path(__file__).resolve().parent.parent / "jarvis_data"
STATE_FILE = STATE_DIR / "nightly_learner_state.json"
LOG_FILE = STATE_DIR / "nightly_learner.log"

CONVERSATION_EXTRACTION_PROMPT = """Analyse cette conversation entre un utilisateur et son assistant IA.
Extrais les informations suivantes en JSON strict :

1. "facts" : liste de faits sur l'utilisateur (preferences, objectifs, contexte professionnel, competences, opinions).
   Chaque fait a un "type" parmi : preference, goal, context, personality, skill, opinion
   et un "text" qui decrit le fait de maniere concise.

2. "entities" : liste d'entites mentionnees (personnes, projets, outils, entreprises, concepts).
   Chaque entite a un "type" parmi : person, project, tool, company, concept
   un "name" (nom propre) et une "description" courte.

Si la conversation est triviale (salutations, tests), retourne {"facts": [], "entities": []}.

Exemple :
Input: "Jean: Je travaille sur le PI Planning de la semaine prochaine avec l'equipe CRM. Jarvis: Le PI Planning est un evenement SAFe cle."
Output: {"facts": [{"type": "context", "text": "Prepare un PI Planning avec l'equipe CRM"}], "entities": [{"type": "project", "name": "PI Planning", "description": "Evenement SAFe de planification"}]}

Reponds UNIQUEMENT avec le JSON, sans texte avant ou apres. /no_think"""

ACTIVITY_EXTRACTION_PROMPT = """Analyse ces donnees d'activite quotidienne d'un utilisateur.
Extrais les informations DURABLES en JSON strict :

1. "facts" : liste de faits sur les habitudes et rythme de travail.
   Chaque fait a un "type" parmi : preference, context, skill, opinion
   et un "text" qui decrit le fait de maniere concise.
   Concentre-toi sur les PATTERNS (outils principaux, horaires, repartition du temps), pas les details ephemeres.

2. "entities" : liste d'outils, projets ou reunions recurrentes.
   Chaque entite a un "type" parmi : tool, project, person, company, concept
   un "name" et une "description" courte.
   Les reunions recurrentes doivent etre de type "project".

Ignore les donnees triviales (<5 min d'activite). Retourne {"facts": [], "entities": []} si rien de notable.

Exemple :
Input: "Activite du 2026-04-10 : Dev: 3h20, Communication: 1h45. Top apps: VS Code (2h50), Teams (1h30), Chrome (45min)"
Output: {"facts": [{"type": "context", "text": "Journee principalement dev avec VS Code, communication via Teams"}], "entities": [{"type": "tool", "name": "VS Code", "description": "IDE principal de developpement"}]}

Reponds UNIQUEMENT avec le JSON, sans texte avant ou apres. /no_think"""


# ── Logging ──────────────────────────────────────────────────

def _setup_logging():
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("nightly_learner")
    logger.setLevel(logging.INFO)
    # File handler
    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
    logger.addHandler(fh)
    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(ch)
    return logger


log = _setup_logging()


# ── State (idempotency) ─────────────────────────────────────

def _load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_state(state: dict):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


# ── Fetch conversations ──────────────────────────────────────

def fetch_conversations(since_iso: str) -> dict[str, list]:
    """Fetch conversations since a date, grouped by session_id."""
    safe_since = since_iso.replace("+00:00", "Z")
    rows = sb_get(
        "jarvis_conversations",
        f"created_at=gte.{safe_since}&order=created_at.asc&limit=500"
    )
    sessions = {}
    for row in rows:
        sid = row.get("session_id", "unknown")
        sessions.setdefault(sid, []).append(row)
    return sessions


# ── LLM extraction ───────────────────────────────────────────

def _parse_json_response(raw: str) -> dict | None:
    """Robustly extract a JSON object with 'facts' and 'entities' from LLM output."""
    # Strip <think>...</think> blocks (Qwen3.5 thinking mode leak)
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', raw).strip()

    # Strip markdown code fences
    cleaned = re.sub(r'```(?:json)?\s*', '', cleaned).strip()

    # Try direct parse first
    try:
        result = json.loads(cleaned)
        if "facts" in result or "entities" in result:
            return result
    except json.JSONDecodeError:
        pass

    # Find JSON block containing "facts" key
    for match in re.finditer(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned):
        try:
            result = json.loads(match.group())
            if "facts" in result or "entities" in result:
                return result
        except json.JSONDecodeError:
            continue

    # Last resort: find outermost braces with "facts" inside
    match = re.search(r'\{[\s\S]*"facts"[\s\S]*\}', cleaned)
    if match:
        # Try progressively shorter substrings from the end to handle trailing garbage
        text = match.group()
        for end in range(len(text), 0, -1):
            if text[end - 1] == '}':
                try:
                    return json.loads(text[:end])
                except json.JSONDecodeError:
                    continue

    return None


def _llm_extract(prompt: str, text: str) -> dict:
    """Send text to Qwen3.5 with a given prompt and extract JSON facts + entities."""
    if len(text.strip()) < 20:
        return {"facts": [], "entities": []}

    try:
        from llm_client import chat_completion_sync

        raw, _tokens = chat_completion_sync(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text},
            ],
            max_tokens=1024,
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        result = _parse_json_response(raw)
        if result:
            return {
                "facts": result.get("facts", []),
                "entities": result.get("entities", []),
            }
        log.warning("No JSON found in LLM response (%d chars): %.100s...", len(raw), raw)
        return {"facts": [], "entities": []}

    except Exception as e:
        log.warning("LLM extraction failed: %s", e)
        return {"facts": [], "entities": []}


def extract_from_session(messages: list) -> dict:
    """Extract facts + entities from a conversation session."""
    conv_text = ""
    for msg in messages:
        role = "Jean" if msg["role"] == "user" else "Jarvis"
        # Truncate long individual messages (e.g. RAG results, code dumps)
        content = msg["content"][:1500] if len(msg["content"]) > 1500 else msg["content"]
        conv_text += f"{role}: {content}\n\n"
    # Cap total text to ~4000 chars to keep LLM processing fast
    if len(conv_text) > 4000:
        conv_text = conv_text[:4000] + "\n[... tronque ...]"
    return _llm_extract(CONVERSATION_EXTRACTION_PROMPT, conv_text)


# ── Activity data sources ────────────────────────────────────

def _get_dates_in_range(since_iso: str) -> list:
    """Return list of dates from since_iso to yesterday (inclusive)."""
    from datetime import date as dt_date
    since_dt = datetime.fromisoformat(since_iso.replace("Z", "+00:00"))
    start = since_dt.date()
    end = dt_date.today()  # include today
    dates = []
    d = start
    while d <= end:
        dates.append(d)
        d += timedelta(days=1)
    return dates


def fetch_activity_data(dates: list) -> list[dict]:
    """Read window activity JSONL files for given dates. Returns list of {date, stats_text}."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "observers"))
    from observers.window_observer import read_day_entries, compute_stats
    from observers.daily_brief_generator import _build_stats_text, _format_minutes

    results = []
    for d in dates:
        entries = read_day_entries(d)
        if not entries:
            continue
        stats = compute_stats(entries)
        if stats.get("total_minutes", 0) < 5:
            continue

        # Build human-readable summary for LLM
        text = f"Activite du {d.isoformat()} :\n"
        text += _build_stats_text(stats)
        results.append({"date": d, "text": text, "source": "window_activity"})

    return results


def fetch_outlook_data(dates: list) -> list[dict]:
    """Read Outlook JSON snapshots for given dates. Returns list of {date, stats_text}."""
    from observers.outlook_observer import read_outlook_data
    from observers.daily_brief_generator import _build_stats_text, _format_minutes

    results = []
    for d in dates:
        outlook = read_outlook_data(d)
        if not outlook:
            continue

        ms = outlook.get("meetings_stats", {})
        em = outlook.get("emails", {})
        if not ms.get("count") and not em.get("received_today"):
            continue

        text = f"Donnees Outlook du {d.isoformat()} :\n"
        text += _build_stats_text({}, outlook=outlook)

        # Add meeting details (subjects help extract entities)
        meetings = outlook.get("meetings", [])
        if meetings:
            text += "\nReunions :\n"
            for m in meetings:
                teams_tag = " (Teams)" if m.get("is_teams") else ""
                text += f"  - {m['start']}-{m['end']} : {m['subject']}{teams_tag}, {m.get('attendees_count', 0)} participants\n"

        results.append({"date": d, "text": text, "source": "outlook"})

    return results


# ── Upsert logic ─────────────────────────────────────────────

VALID_FACT_TYPES = {"preference", "goal", "context", "personality", "skill", "opinion"}
FACT_TYPE_MAP = {"habit": "preference", "pattern": "context", "behavior": "preference"}

VALID_ENTITY_TYPES = {"person", "project", "tool", "company", "concept"}
ENTITY_TYPE_MAP = {"meeting": "project", "event": "project", "organization": "company"}


def save_facts(facts: list, session_id: str | None, source: str = "conversation"):
    """Insert new facts into profile_facts."""
    if not facts:
        return 0
    rows = []
    for f in facts:
        ftype = f.get("type", "context")
        ftype = FACT_TYPE_MAP.get(ftype, ftype)
        if ftype not in VALID_FACT_TYPES:
            ftype = "context"
        ftext = f.get("text", "").strip()
        if not ftext:
            continue
        row = {
            "fact_type": ftype,
            "fact_text": ftext,
            "source": source,
            "confidence": 0.7,
        }
        if session_id is not None:
            row["session_id"] = session_id
        rows.append(row)
    if rows:
        sb_post("profile_facts", rows, upsert=True)
    return len(rows)


def save_entities(entities: list):
    """Upsert entities, incrementing mentions_count if they already exist."""
    if not entities:
        return 0
    count = 0
    for e in entities:
        name = e.get("name", "").strip()
        if not name:
            continue
        etype = e.get("type", "concept")
        etype = ENTITY_TYPE_MAP.get(etype, etype)
        if etype not in VALID_ENTITY_TYPES:
            etype = "concept"
        desc = e.get("description", "")

        existing = sb_get("entities", f"name=eq.{requests.utils.quote(name)}&limit=1")
        if existing:
            eid = existing[0]["id"]
            new_count = existing[0].get("mentions_count", 1) + 1
            sb_patch("entities", f"id=eq.{eid}", {
                "mentions_count": new_count,
                "last_mentioned": datetime.now(tz=timezone.utc).isoformat(),
            })
        else:
            sb_post("entities", {
                "entity_type": etype,
                "name": name,
                "description": desc,
                "mentions_count": 1,
            }, upsert=True)
        count += 1
    return count


# ── Main ──────────────────────────────────────────────────────

def run(days: int | None = None) -> dict:
    """Run the nightly learner on all sources. Returns stats dict.

    Sources processed:
    1. Conversations (from Supabase jarvis_conversations)
    2. Window activity (from local JSONL files)
    3. Outlook data (from local JSON snapshots)

    Args:
        days: If set, reprocess last N days (ignores checkpoint).
              If None, process since last successful run (idempotent).
    """
    start_time = time.time()
    log.info("=" * 60)
    log.info("JARVIS — Nightly Learner (multi-source)")
    log.info("=" * 60)

    # 1. Check LM Studio
    log.info("[1/5] Verification de LM Studio...")
    try:
        r = requests.get(f"{LM_STUDIO_BASE_URL}/models", timeout=5)
        if r.status_code != 200:
            raise Exception("not reachable")
        log.info("  [OK] LM Studio connecte")
    except Exception:
        log.error("  [X] LM Studio non disponible. Reporte a demain.")
        return {"status": "error", "reason": "lm_studio_unavailable"}

    # 2. Determine since when to fetch
    state = _load_state()
    if days is not None:
        since = (datetime.now(tz=timezone.utc) - timedelta(days=days)).isoformat()
        log.info("[2/5] Mode retraitement: derniers %d jour(s)", days)
    else:
        last_run = state.get("last_processed_at")
        if last_run:
            since = last_run
            log.info("[2/5] Mode incremental: depuis %s", last_run[:19])
        else:
            since = (datetime.now(tz=timezone.utc) - timedelta(days=1)).isoformat()
            log.info("[2/5] Premier run: dernieres 24h")

    total_facts = 0
    total_entities = 0
    total_sessions = 0

    # 3. Source 1: Conversations
    log.info("[3/5] Source: Conversations...")
    sessions = fetch_conversations(since)
    total_msgs = sum(len(msgs) for msgs in sessions.values())
    log.info("  %d session(s), %d message(s)", len(sessions), total_msgs)

    latest_created_at = since

    consecutive_failures = 0
    session_ids = list(sessions.keys())
    for idx, sid in enumerate(session_ids):
        msgs = sessions[sid]
        log.info("  Session %s... (%d msgs)", sid[:8], len(msgs))
        result = extract_from_session(msgs)

        facts_count = save_facts(result["facts"], sid, source="conversation")
        entities_count = save_entities(result["entities"])

        if facts_count == 0 and entities_count == 0:
            consecutive_failures += 1
            if consecutive_failures >= 3:
                remaining = len(session_ids) - idx - 1
                log.error("Circuit breaker: %d echecs consecutifs, skip %d sessions restantes", consecutive_failures, remaining)
                break
        else:
            log.debug("consecutive_failures reset apres extraction OK sur session %s", sid[:8])
            consecutive_failures = 0

        total_facts += facts_count
        total_entities += entities_count
        total_sessions += 1
        log.info("    -> %d faits, %d entites", facts_count, entities_count)

        for m in msgs:
            ca = m.get("created_at", "")
            if ca > latest_created_at:
                latest_created_at = ca

    # 4. Source 2 & 3: Activity + Outlook
    log.info("[4/5] Source: Activite + Outlook...")
    dates = _get_dates_in_range(since)
    log.info("  Dates a traiter: %s", ", ".join(d.isoformat() for d in dates))

    activity_items = fetch_activity_data(dates)
    outlook_items = fetch_outlook_data(dates)
    observer_items = activity_items + outlook_items

    if observer_items:
        # Group by date and merge into a single text per date for efficiency
        by_date = {}
        for item in observer_items:
            d = item["date"]
            by_date.setdefault(d, []).append(item["text"])

        for d, texts in by_date.items():
            combined = "\n\n".join(texts)
            log.info("  %s (%d sources, %d chars)...", d.isoformat(), len(texts), len(combined))
            result = _llm_extract(ACTIVITY_EXTRACTION_PROMPT, combined)

            facts_count = save_facts(result["facts"], None, source="activity")
            entities_count = save_entities(result["entities"])

            total_facts += facts_count
            total_entities += entities_count
            log.info("    -> %d faits, %d entites", facts_count, entities_count)
    else:
        log.info("  Aucune donnee d'activite a traiter.")

    # 5. Reindex
    log.info("[5/5] Reindexation des nouvelles donnees...")
    try:
        os.environ.setdefault("SUPABASE_URL", SUPABASE_URL)
        os.environ.setdefault("SUPABASE_KEY", SUPABASE_KEY)
        sys.path.insert(0, os.path.dirname(__file__))
        from indexer import index_table
        for table in ("profile_facts", "entities"):
            stats = index_table(table, incremental=True)
            log.info("  %s: %d chunks indexes", table, stats["chunks"])
    except Exception as e:
        log.warning("Reindexation echouee: %s", e)

    # No data at all — still update checkpoint
    if total_facts == 0 and total_entities == 0 and not sessions and not observer_items:
        state["last_result"] = "no_data"
    else:
        state["last_result"] = "ok"

    state["last_processed_at"] = latest_created_at
    state["last_run"] = datetime.now(tz=timezone.utc).isoformat()
    state["last_stats"] = {
        "sessions": total_sessions,
        "activity_days": len(observer_items),
        "facts": total_facts,
        "entities": total_entities,
    }
    _save_state(state)

    elapsed = round(time.time() - start_time, 1)
    log.info("")
    log.info("=" * 60)
    log.info("Extraction terminee en %ss:", elapsed)
    log.info("  Conversations: %d sessions", total_sessions)
    log.info("  Activite/Outlook: %d jours", len(observer_items))
    log.info("  Faits extraits: %d", total_facts)
    log.info("  Entites extraites: %d", total_entities)
    log.info("=" * 60)

    return {
        "status": "ok",
        "sessions": total_sessions,
        "activity_days": len(observer_items),
        "facts": total_facts,
        "entities": total_entities,
        "elapsed": elapsed,
    }


def main():
    parser = argparse.ArgumentParser(description="Jarvis — Nightly Learner")
    parser.add_argument("--days", type=int, default=None, help="Reprocess last N days (ignores checkpoint)")
    args = parser.parse_args()

    result = run(days=args.days)
    return 0 if result.get("status") == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
