"""Jarvis — Project status snapshot generator.

Reads project_status.yaml, enriches with live data (Supabase, Git, LM Studio),
generates a prose summary via Jarvis local LLM, and upserts the snapshot into
Supabase jarvis_status_snapshot table.

Usage:
    python jarvis/status_generator.py
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

# ── Paths ─────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
YAML_PATH = Path(__file__).resolve().parent / "project_status.yaml"

# ── Supabase config ───────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mrmgptqpflzyavdfqwwv.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_EvHJAk2BOwXN23stOddXQQ_AAzbKw5e")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


def load_yaml() -> dict:
    """Load project_status.yaml, converting date objects to strings."""
    with open(YAML_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    # YAML auto-parses dates like 2026-04-04 into datetime.date objects,
    # which are not JSON serializable. Convert them to ISO strings.
    for phase in data.get("phases", []):
        if "completion_date" in phase and hasattr(phase["completion_date"], "isoformat"):
            phase["completion_date"] = phase["completion_date"].isoformat()
    return data


def get_yaml_freshness() -> dict:
    """Get modification time info for the YAML file."""
    try:
        mtime = os.path.getmtime(YAML_PATH)
        mod_dt = datetime.fromtimestamp(mtime, tz=timezone.utc)
        age_days = (datetime.now(tz=timezone.utc) - mod_dt).total_seconds() / 86400
        return {
            "yaml_last_modified_at": mod_dt.isoformat(),
            "yaml_age_days": round(age_days, 1),
        }
    except Exception as e:
        print(f"  [WARN] Cannot read YAML mtime: {e}")
        return {"yaml_last_modified_at": None, "yaml_age_days": None}


# ── Supabase helpers ──────────────────────────────────────────

def sb_read(table: str, params: str = "") -> list:
    """GET rows from Supabase using the publishable key (read-only)."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        url += f"?{params}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    try:
        r = requests.get(url, headers=headers, timeout=10)
        return r.json() if r.status_code == 200 else []
    except Exception as e:
        print(f"  [WARN] sb_read {table}: {e}")
        return []


def sb_upsert_service(table: str, data: dict) -> bool:
    """Upsert a row using the service_role key."""
    if not SUPABASE_SERVICE_KEY:
        print("  [WARN] SUPABASE_SERVICE_KEY not set — skipping upsert.")
        return False
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=headers,
            json=data,
            timeout=10,
        )
        if r.status_code in (200, 201):
            return True
        print(f"  [ERROR] Upsert {table} ({r.status_code}): {r.text[:300]}")
        return False
    except Exception as e:
        print(f"  [ERROR] Upsert {table}: {e}")
        return False


# ── Live data enrichment ──────────────────────────────────────

def get_chunks_count() -> int:
    """Count chunks in memories_vectors."""
    try:
        rows = sb_read("memories_vectors", "select=id&limit=1&offset=0")
        # Use HEAD trick: fetch with count header
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "count=exact",
        }
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/memories_vectors?select=id&limit=0",
            headers=headers,
            timeout=10,
        )
        content_range = r.headers.get("Content-Range", "")
        # Format: "0-0/4217" or "*/4217"
        if "/" in content_range:
            total = content_range.split("/")[-1]
            if total.isdigit():
                return int(total)
        return 0
    except Exception as e:
        print(f"  [WARN] chunks count: {e}")
        return 0


def get_api_cost_month() -> float:
    """Get API cost for current month from weekly_analysis table."""
    try:
        now = datetime.now(tz=timezone.utc)
        month_start = now.strftime("%Y-%m-01")
        rows = sb_read(
            "weekly_analysis",
            f"select=cost_usd&run_date=gte.{month_start}&order=run_date.desc",
        )
        if rows:
            total = sum(float(r.get("cost_usd", 0) or 0) for r in rows)
            return round(total, 2)
        return 0.0
    except Exception as e:
        print(f"  [WARN] API cost: {e}")
        return 0.0


def get_git_stats() -> dict:
    """Get git stats for jarvis/ this month."""
    result = {
        "commits_this_month": 0,
        "last_commit_iso": None,
        "last_commit_relative": "inconnu",
    }
    try:
        now = datetime.now(tz=timezone.utc)
        since = now.strftime("%Y-%m-01")

        # Count commits this month touching jarvis/
        proc = subprocess.run(
            ["git", "log", f"--since={since}", "--oneline", "--", "jarvis/"],
            capture_output=True, text=True, cwd=str(REPO_ROOT), timeout=10,
        )
        lines = [l for l in proc.stdout.strip().split("\n") if l.strip()]
        result["commits_this_month"] = len(lines)

        # Last commit date on jarvis/
        proc2 = subprocess.run(
            ["git", "log", "-1", "--format=%aI", "--", "jarvis/"],
            capture_output=True, text=True, cwd=str(REPO_ROOT), timeout=10,
        )
        iso = proc2.stdout.strip()
        if iso:
            result["last_commit_iso"] = iso
            # Parse and compute relative
            try:
                commit_dt = datetime.fromisoformat(iso)
                delta = datetime.now(tz=commit_dt.tzinfo) - commit_dt
                days = delta.days
                hours = delta.seconds // 3600
                if days > 0:
                    result["last_commit_relative"] = f"il y a {days} jour{'s' if days > 1 else ''}"
                elif hours > 0:
                    result["last_commit_relative"] = f"il y a {hours} heure{'s' if hours > 1 else ''}"
                else:
                    result["last_commit_relative"] = "il y a moins d'une heure"
            except Exception:
                result["last_commit_relative"] = "recemment"
    except Exception as e:
        print(f"  [WARN] git stats: {e}")
    return result



# ── Prose generation ──────────────────────────────────────────

def generate_prose(yaml_data: dict, metrics: dict) -> str:
    """Build a clean prose summary from YAML data."""
    current = yaml_data["current_phase"]
    phases = yaml_data["phases"]
    next_step = yaml_data.get("next_step", "")
    done_phases = [p for p in phases if p["status"] == "done"]
    current_phase = next((p for p in phases if p["id"] == current), None)

    title = current_phase["title"] if current_phase else "?"
    criterion = current_phase.get("success_criterion", "") if current_phase else ""

    # Build prose from data
    parts = []

    # Sentence 1: current phase
    done_titles = ", ".join(p["title"] for p in done_phases)
    parts.append(
        f"Tu es en Phase {current} — {title}, "
        f"apres avoir termine {done_titles}."
    )

    # Sentence 2: success criterion
    if criterion:
        parts.append(f"L'objectif de cette phase : {criterion}.")

    # Sentence 3: learnings from done phases
    learnings = []
    for p in done_phases:
        for b in p.get("bullets", []):
            if "learning" in b.lower():
                learnings.append(b)
    if learnings:
        parts.append(learnings[-1].rstrip(".") + ".")

    # Sentence 4: next step
    if next_step:
        parts.append(f"Prochaine etape concrete : {next_step}.")

    prose = " ".join(parts)
    print(f"  [OK] Prose generee ({len(prose)} chars)")
    return prose


# ── Main ──────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("JARVIS — Status Snapshot Generator")
    print("=" * 60)
    print()

    # 1. Load YAML
    print("[1/5] Chargement de project_status.yaml...")
    yaml_data = load_yaml()
    current = yaml_data["current_phase"]
    phases = yaml_data["phases"]
    next_step = yaml_data.get("next_step", "")
    print(f"  Phase courante: {current}, {len(phases)} phases definies")

    # 2. Enrich with live data
    print("[2/5] Collecte des donnees live...")

    chunks = get_chunks_count()
    print(f"  Chunks indexes: {chunks}")

    api_cost = get_api_cost_month()
    print(f"  Cout API ce mois: {api_cost} EUR")

    git = get_git_stats()
    print(f"  Commits jarvis/ ce mois: {git['commits_this_month']}")
    print(f"  Dernier commit: {git['last_commit_relative']}")

    freshness = get_yaml_freshness()
    print(f"  Age du YAML: {freshness['yaml_age_days']} jours")

    metrics = {
        "chunks_indexed": chunks,
        "commits_this_month": git["commits_this_month"],
        "last_commit_relative": git["last_commit_relative"],
        "last_commit_iso": git["last_commit_iso"],
        "api_cost_eur_month": api_cost,
    }

    # 3. Generate prose
    print("[3/5] Generation de la prose via Jarvis local...")
    prose = generate_prose(yaml_data, metrics)
    print(f"  Prose: {len(prose)} caracteres")

    # 4. Build snapshot
    print("[4/5] Construction du snapshot...")
    now_iso = datetime.now(tz=timezone.utc).isoformat()

    snapshot = {
        "current_phase": current,
        "phases": phases,
        "next_step": next_step,
        "prose": prose,
        "metrics": metrics,
        "freshness": {
            "snapshot_generated_at": now_iso,
            **freshness,
        },
    }

    # 5. Upsert to Supabase
    print("[5/5] Upsert dans Supabase...")
    row = {
        "id": 1,
        "snapshot_data": snapshot,
        "generated_at": now_iso,
    }
    ok = sb_upsert_service("jarvis_status_snapshot", row)

    # Recap
    print()
    print("=" * 60)
    status = "OK" if ok else "ECHOUE (verifier SUPABASE_SERVICE_KEY)"
    print(f"Snapshot genere:")
    print(f"  Chunks: {chunks}")
    print(f"  Commits ce mois: {git['commits_this_month']}")
    print(f"  Dernier commit: {git['last_commit_relative']}")
    print(f"  Prose: {len(prose)} caracteres")
    print(f"  Upsert: {status}")
    print("=" * 60)

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
