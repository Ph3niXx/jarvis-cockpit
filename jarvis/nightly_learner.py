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

# ── Config ────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mrmgptqpflzyavdfqwwv.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_EvHJAk2BOwXN23stOddXQQ_AAzbKw5e")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3.5-9b")

STATE_DIR = Path(__file__).resolve().parent.parent / "jarvis_data"
STATE_FILE = STATE_DIR / "nightly_learner_state.json"
LOG_FILE = STATE_DIR / "nightly_learner.log"

EXTRACTION_PROMPT = """Analyse cette conversation entre un utilisateur et son assistant IA.
Extrais les informations suivantes en JSON strict :

1. "facts" : liste de faits sur l'utilisateur (preferences, objectifs, contexte professionnel, competences, opinions).
   Chaque fait a un "type" parmi : preference, goal, context, personality, skill, opinion
   et un "text" qui decrit le fait de maniere concise.

2. "entities" : liste d'entites mentionnees (personnes, projets, outils, entreprises, concepts).
   Chaque entite a un "type" parmi : person, project, tool, company, concept
   un "name" (nom propre) et une "description" courte.

Si la conversation est triviale (salutations, tests), retourne {"facts": [], "entities": []}.

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


# ── Supabase helpers ──────────────────────────────────────────

def _headers(service=False):
    key = SUPABASE_SERVICE_KEY if service and SUPABASE_SERVICE_KEY else SUPABASE_KEY
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def sb_read(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        url += f"?{params}"
    r = requests.get(url, headers=_headers(), timeout=10)
    return r.json() if r.status_code == 200 else []


def sb_upsert(table, data, service=True):
    headers = {**_headers(service), "Prefer": "resolution=merge-duplicates"}
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, json=data, timeout=10)
    if r.status_code not in (200, 201):
        log.error("upsert %s: %s %s", table, r.status_code, r.text[:200])
        return False
    return True


# ── Fetch conversations ──────────────────────────────────────

def fetch_conversations(since_iso: str) -> dict[str, list]:
    """Fetch conversations since a date, grouped by session_id."""
    safe_since = since_iso.replace("+00:00", "Z")
    rows = sb_read(
        "jarvis_conversations",
        f"created_at=gte.{safe_since}&order=created_at.asc&limit=500"
    )
    sessions = {}
    for row in rows:
        sid = row.get("session_id", "unknown")
        sessions.setdefault(sid, []).append(row)
    return sessions


# ── LLM extraction ───────────────────────────────────────────

def extract_from_session(messages: list) -> dict:
    """Send a conversation to Qwen3.5 and extract facts + entities."""
    conv_text = ""
    for msg in messages:
        role = "Jean" if msg["role"] == "user" else "Jarvis"
        conv_text += f"{role}: {msg['content']}\n\n"

    if len(conv_text.strip()) < 20:
        return {"facts": [], "entities": []}

    try:
        r = requests.post(
            f"{LM_STUDIO_BASE_URL}/chat/completions",
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": EXTRACTION_PROMPT},
                    {"role": "user", "content": conv_text},
                ],
                "temperature": 0.1,
                "max_tokens": 1024,
            },
            timeout=120,
        )
        if r.status_code != 200:
            log.warning("LLM returned %s", r.status_code)
            return {"facts": [], "entities": []}

        data = r.json()
        raw = data["choices"][0]["message"]["content"] or ""

        if not raw.strip():
            msg_data = data["choices"][0]["message"]
            raw = msg_data.get("reasoning_content", "") or ""

        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            result = json.loads(match.group())
            return {
                "facts": result.get("facts", []),
                "entities": result.get("entities", []),
            }
        log.warning("No JSON found in LLM response (%d chars)", len(raw))
        return {"facts": [], "entities": []}

    except json.JSONDecodeError as e:
        log.warning("JSON parse error: %s", e)
        return {"facts": [], "entities": []}
    except Exception as e:
        log.warning("LLM extraction failed: %s", e)
        return {"facts": [], "entities": []}


# ── Upsert logic ─────────────────────────────────────────────

def save_facts(facts: list, session_id: str):
    """Insert new facts into profile_facts."""
    if not facts:
        return 0
    rows = []
    for f in facts:
        ftype = f.get("type", "context")
        ftext = f.get("text", "").strip()
        if not ftext:
            continue
        rows.append({
            "fact_type": ftype,
            "fact_text": ftext,
            "source": "conversation",
            "confidence": 0.7,
            "session_id": session_id,
        })
    if rows:
        sb_upsert("profile_facts", rows, service=True)
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
        desc = e.get("description", "")

        existing = sb_read("entities", f"name=eq.{requests.utils.quote(name)}&limit=1")
        if existing:
            eid = existing[0]["id"]
            new_count = existing[0].get("mentions_count", 1) + 1
            headers = {**_headers(service=True)}
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/entities?id=eq.{eid}",
                headers=headers,
                json={"mentions_count": new_count, "last_mentioned": datetime.now(tz=timezone.utc).isoformat()},
                timeout=10,
            )
        else:
            sb_upsert("entities", {
                "entity_type": etype,
                "name": name,
                "description": desc,
                "mentions_count": 1,
            }, service=True)
        count += 1
    return count


# ── Main ──────────────────────────────────────────────────────

def run(days: int | None = None) -> dict:
    """Run the nightly learner. Returns stats dict.

    Args:
        days: If set, reprocess last N days (ignores checkpoint).
              If None, process since last successful run (idempotent).
    """
    start_time = time.time()
    log.info("=" * 60)
    log.info("JARVIS — Nightly Learner")
    log.info("=" * 60)

    # 1. Check LM Studio
    log.info("[1/4] Verification de LM Studio...")
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
        log.info("[2/4] Mode retraitement: derniers %d jour(s)", days)
    else:
        last_run = state.get("last_processed_at")
        if last_run:
            since = last_run
            log.info("[2/4] Mode incremental: depuis %s", last_run[:19])
        else:
            since = (datetime.now(tz=timezone.utc) - timedelta(days=1)).isoformat()
            log.info("[2/4] Premier run: dernières 24h")

    # 3. Fetch conversations
    sessions = fetch_conversations(since)
    total_msgs = sum(len(msgs) for msgs in sessions.values())
    log.info("  %d session(s), %d message(s)", len(sessions), total_msgs)

    if not sessions:
        log.info("  Aucune conversation a traiter.")
        # Still update checkpoint so we don't re-scan
        state["last_processed_at"] = datetime.now(tz=timezone.utc).isoformat()
        state["last_run"] = datetime.now(tz=timezone.utc).isoformat()
        state["last_result"] = "no_data"
        _save_state(state)
        return {"status": "ok", "sessions": 0, "facts": 0, "entities": 0}

    # 4. Extract from each session
    log.info("[3/4] Extraction des faits et entites...")
    total_facts = 0
    total_entities = 0
    latest_created_at = since

    for sid, msgs in sessions.items():
        log.info("  Session %s... (%d msgs)", sid[:8], len(msgs))
        result = extract_from_session(msgs)

        facts_count = save_facts(result["facts"], sid)
        entities_count = save_entities(result["entities"])

        total_facts += facts_count
        total_entities += entities_count
        log.info("    -> %d faits, %d entites", facts_count, entities_count)

        # Track latest message timestamp for checkpoint
        for m in msgs:
            ca = m.get("created_at", "")
            if ca > latest_created_at:
                latest_created_at = ca

    # 5. Reindex
    log.info("[4/4] Reindexation des nouvelles donnees...")
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

    # Save checkpoint
    state["last_processed_at"] = latest_created_at
    state["last_run"] = datetime.now(tz=timezone.utc).isoformat()
    state["last_result"] = "ok"
    state["last_stats"] = {"sessions": len(sessions), "facts": total_facts, "entities": total_entities}
    _save_state(state)

    elapsed = round(time.time() - start_time, 1)
    log.info("")
    log.info("=" * 60)
    log.info("Extraction terminee en %ss:", elapsed)
    log.info("  Sessions traitees: %d", len(sessions))
    log.info("  Faits extraits: %d", total_facts)
    log.info("  Entites extraites: %d", total_entities)
    log.info("=" * 60)

    return {"status": "ok", "sessions": len(sessions), "facts": total_facts, "entities": total_entities, "elapsed": elapsed}


def main():
    parser = argparse.ArgumentParser(description="Jarvis — Nightly Learner")
    parser.add_argument("--days", type=int, default=None, help="Reprocess last N days (ignores checkpoint)")
    args = parser.parse_args()

    result = run(days=args.days)
    return 0 if result.get("status") == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
