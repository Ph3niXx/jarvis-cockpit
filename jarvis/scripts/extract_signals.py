"""Jarvis — Weekly internal signals extractor.

Queries Supabase usage_events, git log, and local log files to produce
jarvis/intel/YYYY-MM-DD-signals.md.

Usage: python jarvis/scripts/extract_signals.py
"""

import os, subprocess, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import SUPABASE_URL, SUPABASE_KEY, LM_STUDIO_BASE_URL
from supabase_client import sb_get

INTEL_DIR = Path(__file__).resolve().parent.parent / "intel"
JARVIS_DATA = Path(__file__).resolve().parent.parent.parent / "jarvis_data"
REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# A synchroniser manuellement avec les <button data-panel="..."> de index.html.
# Derniere mise a jour : 2026-04-12.
KNOWN_SECTIONS = {
    "brief", "myweek", "updates", "llm", "agents", "energy", "finserv",
    "tools", "biz", "reg", "papers", "wiki", "signals", "opportunities",
    "radar", "recos", "challenges", "ideas", "rte", "jarvis",
    "jarvis-project", "tft", "costs", "profile", "search", "history",
}

TZ = timezone(timedelta(hours=2))
NOW = datetime.now(tz=TZ)
TODAY = NOW.strftime("%Y-%m-%d")
SINCE = (NOW - timedelta(days=7)).strftime("%Y-%m-%dT00:00:00")


def _events(extra_filter=""): return sb_get("usage_events", f"ts=gte.{SINCE}{extra_filter}&select=event_type,payload")
def _git(args):
    try: return subprocess.run(f"git {args}", shell=True, capture_output=True, text=True, timeout=15, cwd=str(REPO_ROOT)).stdout.strip()
    except Exception: return ""
def _top(counts, n=5): return ", ".join(f"{k} ({v})" for k, v in sorted(counts.items(), key=lambda x: -x[1])[:n])


def section_telemetry():
    events = _events()
    if not events:
        return "## Volume telemetrie\n- Total events : 0\n- Aucune donnee sur la periode.\n", 0, {}, set()
    counts, opened, unknown = {}, set(), set()
    for e in events:
        et = e.get("event_type", "?")
        counts[et] = counts.get(et, 0) + 1
        if et == "section_opened":
            sec = (e.get("payload") or {}).get("section", "")
            if sec:
                opened.add(sec)
                if sec not in KNOWN_SECTIONS: unknown.add(sec)
    never = sorted(KNOWN_SECTIONS - opened)
    return (f"## Volume telemetrie\n- Total events : {len(events)}\n"
            f"- Top 5 event_types : {_top(counts)}\n"
            f"- Sections jamais ouvertes : {', '.join(never) or 'aucune'}\n"), len(events), counts, unknown


def section_searches():
    events = _events("&event_type=eq.search_performed")
    zero = [e for e in events if (e.get("payload") or {}).get("results_count", 1) == 0]
    lines = f"## Recherches infructueuses\n- search_performed avec results_count=0 : {len(zero)} / {len(events)} total\n"
    if zero:
        avg = sum((e.get("payload") or {}).get("query_length", 0) for e in zero) / len(zero)
        lines += f"- query_length moyen des echecs : {avg:.0f} caracteres\n"
    return lines


def section_errors_ui():
    events = _events("&event_type=eq.error_shown")
    lines = f"## Erreurs UI captees\n- Total error_shown : {len(events)}\n"
    if events:
        ctx = {}
        for e in events: c = (e.get("payload") or {}).get("context", "?"); ctx[c] = ctx.get(c, 0) + 1
        lines += f"- Top 3 contextes : {_top(ctx, 3)}\n"
    return lines


def section_git():
    log = _git('log --oneline --since="7 days ago"')
    if not log: return "## Activite git\n- Git indisponible ou aucun commit.\n", 0
    commits = log.split("\n")
    files_raw = _git('log --since="7 days ago" --name-only --pretty=format:')
    fc = {}
    for f in files_raw.split("\n"):
        f = f.strip()
        if f: fc[f] = fc.get(f, 0) + 1
    lines = (f"## Activite git\n- Commits cette semaine : {len(commits)}\n"
             f"- Top 5 fichiers modifies : {_top(fc)}\n- Derniers commits :\n")
    for c in commits[:5]: lines += f"  - {c}\n"
    return lines, len(commits)


def section_pipeline_errors():
    if not JARVIS_DATA.exists(): return "## Erreurs pipelines\n- Aucun dossier de logs trouve.\n"
    log_files = list(JARVIS_DATA.rglob("*.log"))
    if not log_files: return "## Erreurs pipelines\n- Aucun fichier .log dans jarvis_data/.\n"
    err = []
    for lf in log_files:
        try:
            for line in lf.read_text(encoding="utf-8", errors="replace").splitlines()[-500:]:
                if any(kw in line.upper() for kw in ("ERROR", "EXCEPTION", "FAILED", "TRACEBACK")):
                    err.append(f"  [{lf.name}] {line.strip()[:150]}")
        except Exception: pass
    lines = f"## Erreurs pipelines\n"
    if err:
        lines += f"- {len(err)} ligne(s) d'erreur, 20 dernieres :\n" + "\n".join(err[-20:]) + "\n"
    else:
        lines += "- Aucune erreur detectee dans les logs.\n"
    return lines


def section_health():
    def _count(table, params=""):
        try: return len(sb_get(table, f"{params}select=id&limit=10000"))
        except Exception: return "N/A"
    return (f"## Metriques sante\n"
            f"- Vecteurs Supabase : {_count('memories_vectors')}\n"
            f"- Faits actifs : {_count('profile_facts', 'superseded_by=is.null&')}\n"
            f"- Patterns extraits / valides / rejetes : N/A\n"
            f"- Volume usage_events total : {_count('usage_events')}\n")


def section_anomalies(total, counts, commits, unknown):
    a = []
    if total == 0:
        a.append("!! Telemetrie vide cette semaine. Soit usage_events vient d'etre deployee, "
                 "soit le frontend ne trace pas. Verifier track() dans index.html.")
    if counts.get("error_shown", 0) > 10:
        a.append(f"Pic d'erreurs UI : {counts['error_shown']} error_shown.")
    if commits == 0: a.append("Aucun commit cette semaine.")
    for s in sorted(unknown): a.append(f"Section inconnue : {s} (a ajouter dans extract_signals.py)")
    lines = "## Anomalies detectees\n"
    return lines + ("\n".join(f"- {x}" for x in a) if a else "- RAS") + "\n"


def main():
    t0 = time.time()
    INTEL_DIR.mkdir(parents=True, exist_ok=True)
    out = INTEL_DIR / f"{TODAY}-signals.md"
    parts, errors = [], []
    total, counts, unknown, commits = 0, {}, set(), 0

    parts.append(f"# Signaux internes -- {TODAY}\n\n> Genere le {NOW.strftime('%Y-%m-%d a %H:%M:%S')} "
                 f"par extract_signals.py\n> Periode : 7 derniers jours\n")

    steps = [
        ("telemetrie", lambda: section_telemetry()),
        ("recherches", lambda: section_searches()),
        ("erreurs_ui", lambda: section_errors_ui()),
        ("git", lambda: section_git()),
        ("pipelines", lambda: section_pipeline_errors()),
        ("sante", lambda: section_health()),
    ]
    for i, (name, fn) in enumerate(steps, 1):
        try:
            result = fn()
            if isinstance(result, tuple):
                text = result[0]
                if name == "telemetrie": _, total, counts, unknown = result
                elif name == "git": _, commits = result
            else:
                text = result
            parts.append(text)
            print(f"[{i}/7] {name} OK")
        except Exception as e:
            parts.append(f"## {name.replace('_', ' ').title()}\n- Indisponible : {e}\n")
            errors.append(f"{name} ({e})")
            print(f"[{i}/7] {name} ERREUR: {e}")

    try:
        parts.append(section_anomalies(total, counts, commits, unknown))
        print("[7/7] anomalies OK")
    except Exception as e:
        parts.append(f"## Anomalies detectees\n- Erreur : {e}\n")
        errors.append(f"anomalies ({e})")

    elapsed = round(time.time() - t0, 1)
    parts.append(f"## Meta\n- Duree : {elapsed}s\n- Sections en erreur : {', '.join(errors) or 'aucune'}\n")
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"\n{out} ({elapsed}s)")


if __name__ == "__main__":
    main()
