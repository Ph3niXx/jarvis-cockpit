"""Jarvis — Nightly Learner: extract facts and entities from daily conversations.

Reads jarvis_conversations from the past 24h, groups by session,
sends each to Qwen3.5 local for structured extraction, and upserts
results into profile_facts and entities tables.

Usage:
    python jarvis/nightly_learner.py
    python jarvis/nightly_learner.py --days=3   # reprocess last 3 days
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta

import requests

# ── Config ────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mrmgptqpflzyavdfqwwv.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_EvHJAk2BOwXN23stOddXQQ_AAzbKw5e")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3.5-9b")

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
        print(f"  [ERROR] upsert {table}: {r.status_code} {r.text[:200]}")
        return False
    return True


# ── Fetch conversations ──────────────────────────────────────

def fetch_conversations(since_iso: str) -> dict[str, list]:
    """Fetch conversations since a date, grouped by session_id."""
    rows = sb_read(
        "jarvis_conversations",
        f"created_at=gte.{since_iso}&order=created_at.asc&limit=500"
    )
    sessions = {}
    for row in rows:
        sid = row.get("session_id", "unknown")
        sessions.setdefault(sid, []).append(row)
    return sessions


# ── LLM extraction ───────────────────────────────────────────

def extract_from_session(messages: list) -> dict:
    """Send a conversation to Qwen3.5 and extract facts + entities."""
    # Build conversation text
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
            print(f"  [WARN] LLM returned {r.status_code}")
            return {"facts": [], "entities": []}

        data = r.json()
        raw = data["choices"][0]["message"]["content"] or ""

        # Also check reasoning_content (Qwen thinking mode)
        if not raw.strip():
            msg_data = data["choices"][0]["message"]
            raw = msg_data.get("reasoning_content", "") or ""

        # Extract JSON from the response (may have extra text around it)
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            result = json.loads(match.group())
            return {
                "facts": result.get("facts", []),
                "entities": result.get("entities", []),
            }
        print(f"  [WARN] No JSON found in LLM response ({len(raw)} chars)")
        return {"facts": [], "entities": []}

    except json.JSONDecodeError as e:
        print(f"  [WARN] JSON parse error: {e}")
        return {"facts": [], "entities": []}
    except Exception as e:
        print(f"  [WARN] LLM extraction failed: {e}")
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

        # Check if entity already exists
        existing = sb_read("entities", f"name=eq.{requests.utils.quote(name)}&limit=1")
        if existing:
            # Update mentions count and last_mentioned
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

def main():
    parser = argparse.ArgumentParser(description="Jarvis — Nightly Learner")
    parser.add_argument("--days", type=int, default=1, help="Number of days to look back (default: 1)")
    args = parser.parse_args()

    print("=" * 60)
    print("JARVIS — Nightly Learner")
    print("=" * 60)
    print()

    # 1. Check LM Studio
    print("[1/4] Verification de LM Studio...")
    try:
        r = requests.get(f"{LM_STUDIO_BASE_URL}/models", timeout=5)
        if r.status_code != 200:
            raise Exception("not reachable")
        print("  [OK] LM Studio connecte")
    except Exception:
        print("  [X] LM Studio non disponible. Reporte a demain.")
        return 1

    # 2. Fetch conversations
    since = (datetime.now(tz=timezone.utc) - timedelta(days=args.days)).isoformat()
    print(f"\n[2/4] Recuperation des conversations depuis {args.days} jour(s)...")
    sessions = fetch_conversations(since)
    total_msgs = sum(len(msgs) for msgs in sessions.values())
    print(f"  {len(sessions)} session(s), {total_msgs} message(s)")

    if not sessions:
        print("\n  Aucune conversation a traiter.")
        print("=" * 60)
        return 0

    # 3. Extract from each session
    print(f"\n[3/4] Extraction des faits et entites...")
    total_facts = 0
    total_entities = 0

    for sid, msgs in sessions.items():
        print(f"\n  Session {sid[:8]}... ({len(msgs)} msgs)")
        result = extract_from_session(msgs)

        facts_count = save_facts(result["facts"], sid)
        entities_count = save_entities(result["entities"])

        total_facts += facts_count
        total_entities += entities_count
        print(f"    -> {facts_count} faits, {entities_count} entites")

    # 4. Reindex
    print(f"\n[4/4] Reindexation des nouvelles donnees...")
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from indexer import index_table
        for table in ("profile_facts", "entities"):
            stats = index_table(table, incremental=True)
            print(f"  {table}: {stats['chunks']} chunks indexes")
    except Exception as e:
        print(f"  [WARN] Reindexation echouee: {e}")
        print("  Lancer manuellement: python jarvis/indexer.py --table=profile_facts")

    # Recap
    print()
    print("=" * 60)
    print(f"Extraction terminee:")
    print(f"  Sessions traitees: {len(sessions)}")
    print(f"  Faits extraits: {total_facts}")
    print(f"  Entites extraites: {total_entities}")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
