"""Weekly internal signals extractor → jarvis/intel/YYYY-MM-DD-signals.md"""

import os, re, subprocess, sys, time
from collections import namedtuple
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import SUPABASE_URL, SUPABASE_KEY, LM_STUDIO_BASE_URL
from supabase_client import sb_get

INTEL_DIR = Path(__file__).resolve().parent.parent / "intel"
JARVIS_DATA = Path(__file__).resolve().parent.parent.parent / "jarvis_data"
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PipelineLogReport = namedtuple("PipelineLogReport", ["text", "count", "patterns", "first_examples"])

THRESHOLD_DAILY_EVENTS_LOW = 10       # Below: cockpit under-utilisation alert
THRESHOLD_DAILY_EVENTS_WARN = 30      # Below: weak usage note
THRESHOLD_DEAD_RATIO_HIGH = 0.3       # Above 30%: dead sections alert
THRESHOLD_DEAD_RATIO_WARN = 0.15      # Above 15%: dead sections note
THRESHOLD_RECURRING_ERROR = 5         # Same pattern N+ times: recurring error alert
THRESHOLD_CTR_LOW = 0.1               # Click-through below 10%: engagement alert
THRESHOLD_CTR_MIN_SAMPLE = 10         # Minimum section_opened count to compute CTR
THRESHOLD_PIPELINE_WARN = 20          # Above: pipeline suffering alert
THRESHOLD_PIPELINE_CRIT = 50          # Above: pipeline critical alert
THRESHOLD_SESSION_GAP = 30            # Minutes gap to split sessions

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

def _events(extra_filter=""):
    return sb_get("usage_events", f"ts=gte.{SINCE}{extra_filter}&select=event_type,payload,ts")
def _git(args):
    try: return subprocess.run(f"git {args}", shell=True, capture_output=True, text=True, timeout=15, cwd=str(REPO_ROOT)).stdout.strip()
    except Exception: return ""
def _top(counts, n=5):
    return ", ".join(f"{k} ({v})" for k, v in sorted(counts.items(), key=lambda x: -x[1])[:n])
def _normalize_error(line):
    """Strip ISO timestamp + level prefix, replace digits with N."""
    line = re.sub(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\S*", "", line).strip()
    line = re.sub(r"\[(?:WARNING|ERROR|INFO)\]\s*", "", line)
    return re.sub(r"\d+", "N", line)

def section_telemetry():
    events = _events()
    if not events:
        return "## Volume telemetrie\n- Total events : 0\n- Aucune donnee sur la periode.\n", 0, {}, set(), []
    counts, opened, unknown, sec_counts = {}, set(), set(), {}
    link_data, error_data = [], []
    for e in events:
        et, p = e.get("event_type", "?"), e.get("payload") or {}
        counts[et] = counts.get(et, 0) + 1
        if et == "section_opened":
            sec = p.get("section", "")
            if sec:
                opened.add(sec); sec_counts[sec] = sec_counts.get(sec, 0) + 1
                if sec not in KNOWN_SECTIONS: unknown.add(sec)
        elif et == "link_clicked": link_data.append(p)
        elif et == "error_shown": error_data.append(p)
    never = sorted(KNOWN_SECTIONS - opened)
    lines = (f"## Volume telemetrie\n- Total events : {len(events)}\n"
             f"- Top 5 event_types : {_top(counts)}\n"
             f"- Sections jamais ouvertes : {', '.join(never) or 'aucune'}\n")
    revisited = {s: c for s, c in sec_counts.items() if c > 1}
    if revisited:
        lines += "\n### Detail section_opened (sections les plus revisitees)\n"
        for s, c in sorted(revisited.items(), key=lambda x: -x[1])[:5]: lines += f"- {s} : {c} ouvertures\n"
    if link_data:
        domains, dom_secs = {}, {}
        for lk in link_data:
            url, sec = lk.get("url", ""), lk.get("section", "?")
            try: dom = urlparse(url).netloc or "?"
            except Exception: dom = "?"
            domains[dom] = domains.get(dom, 0) + 1; dom_secs.setdefault(dom, set()).add(sec)
        lines += "\n### Detail link_clicked (top 5 domaines)\n"
        for dom, c in sorted(domains.items(), key=lambda x: -x[1])[:5]:
            lines += f"- {dom} : {c} clics (sections : {', '.join(sorted(dom_secs[dom]))})\n"
    if error_data:
        ectx, last_msg = {}, {}
        for ed in error_data:
            ctx = ed.get("context", "?"); ectx[ctx] = ectx.get(ctx, 0) + 1; last_msg[ctx] = (ed.get("message") or "")[:100]
        lines += "\n### Detail error_shown\n"
        for ctx, c in sorted(ectx.items(), key=lambda x: -x[1])[:3]:
            lines += f"- {ctx} : {c} occurrences (derniere : \"{last_msg[ctx]}\")\n"
    return lines, len(events), counts, unknown, events

def section_temporal(events):
    if len(events) < 5:
        return "## Pattern temporel\n- Donnees insuffisantes pour calculer un pattern temporel\n"
    by_day, by_hour, timestamps = {}, {}, []
    for e in events:
        ts = e.get("ts", "")
        if not ts: continue
        timestamps.append(ts)
        try:
            dt = datetime.fromisoformat(ts).astimezone(TZ)
            by_day[dt.strftime("%Y-%m-%d")] = by_day.get(dt.strftime("%Y-%m-%d"), 0) + 1
            by_hour[dt.hour] = by_hour.get(dt.hour, 0) + 1
        except Exception: pass
    if len(timestamps) < 2:
        return "## Pattern temporel\n- Donnees insuffisantes pour calculer un pattern temporel\n"
    active_days = [d for d, c in by_day.items() if c > 0]
    if len(active_days) == 1:
        return (f"## Pattern temporel\n- Session unique le {active_days[0]}, "
                f"pas de pattern recurrent observable ({len(events)} events)\n")
    dist = [f"{'J-'+str(i) if i else 'J0'}:{by_day.get((NOW-timedelta(days=i)).strftime('%Y-%m-%d'),0)}"
            for i in range(6, -1, -1)]
    best_h, best_c = 0, 0
    for h in range(23):
        c = by_hour.get(h, 0) + by_hour.get(h + 1, 0)
        if c > best_c: best_h, best_c = h, c
    sorted_ts = sorted(timestamps)
    sess_n, sess_start = 1, sorted_ts[-1]
    for i in range(len(sorted_ts) - 2, -1, -1):
        if (datetime.fromisoformat(sorted_ts[i+1]) - datetime.fromisoformat(sorted_ts[i])).total_seconds() > THRESHOLD_SESSION_GAP * 60: break
        sess_n += 1; sess_start = sorted_ts[i]
    fmt = lambda t: datetime.fromisoformat(t).astimezone(TZ).strftime("%Y-%m-%d %H:%M")
    all_days = {(NOW - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)}
    inactive = sorted(all_days - set(by_day.keys()))
    return (f"## Pattern temporel\n- Distribution par jour : {', '.join(dist)}\n"
            f"- Heure de pointe : {best_h}h-{best_h+2}h ({best_c} events sur 7j)\n"
            f"- Derniere session active : {fmt(sorted_ts[-1])}, ~{sess_n} events depuis {fmt(sess_start)}\n"
            f"- Jours sans activite : {len(inactive)}" + (f" ({', '.join(inactive)})" if inactive else "") + "\n")

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
    if not JARVIS_DATA.exists():
        return PipelineLogReport("## Erreurs pipelines\n- Aucun dossier de logs trouve.\n", 0, {}, {})
    log_files = list(JARVIS_DATA.rglob("*.log"))
    if not log_files:
        return PipelineLogReport("## Erreurs pipelines\n- Aucun fichier .log dans jarvis_data/.\n", 0, {}, {})
    err, patterns, first_ex = [], {}, {}
    for lf in log_files:
        try:
            for line in lf.read_text(encoding="utf-8", errors="replace").splitlines()[-500:]:
                if any(kw in line.upper() for kw in ("ERROR", "EXCEPTION", "FAILED", "TRACEBACK")):
                    tagged = f"[{lf.name}] {line.strip()[:150]}"
                    err.append(tagged)
                    norm = f"[{lf.name}] {_normalize_error(line)}"
                    patterns[norm] = patterns.get(norm, 0) + 1
                    if norm not in first_ex: first_ex[norm] = tagged
        except Exception: pass
    lines = "## Erreurs pipelines\n"
    if err: lines += f"- {len(err)} ligne(s) d'erreur, 20 dernieres :\n" + "\n".join(err[-20:]) + "\n"
    else: lines += "- Aucune erreur detectee dans les logs.\n"
    return PipelineLogReport(lines, len(err), patterns, first_ex)

def section_health():
    def _count(table, params=""):
        try: return len(sb_get(table, f"{params}select=id&limit=10000"))
        except Exception: return "N/A"
    return (f"## Metriques sante\n"
            f"- Vecteurs Supabase : {_count('memories_vectors')}\n"
            f"- Faits actifs : {_count('profile_facts', 'superseded_by=is.null&')}\n"
            f"- Patterns extraits / valides / rejetes : N/A\n"
            f"- Volume usage_events total : {_count('usage_events')}\n")

def detect_anomalies(data_or_total=0, counts=None, commits=0, unknown=None,
                     pipe_report=None, never_opened=None):
    """Return list of anomaly strings. Empty = RAS. Accepts dict for standalone testing."""
    if isinstance(data_or_total, dict):
        d = data_or_total
        total, counts, commits, unknown = d.get("total_events", 0), {}, 0, set()
        never_opened = set(d.get("sections_mortes", []))
        pipe_report = PipelineLogReport("", len(d.get("erreurs_pipeline", [])), {}, {})
    else:
        total, counts, unknown = data_or_total, counts or {}, unknown or set()
        pipe_report = pipe_report or PipelineLogReport("", 0, {}, {})
        never_opened = never_opened or set()
    a, epd = [], total / 7 if total else 0
    # 1. Cockpit under-utilisation
    if epd < THRESHOLD_DAILY_EVENTS_LOW:
        a.append(f"⚠️ Sous-utilisation : {epd:.1f} events/jour vs cible 50+/jour. Total semaine : {total} (cible : 350+)")
    elif epd < THRESHOLD_DAILY_EVENTS_WARN:
        a.append(f"📉 Usage faible : {epd:.1f} events/jour, a surveiller")
    # 2. Dead sections
    if KNOWN_SECTIONS:
        dr = len(never_opened) / len(KNOWN_SECTIONS)
        if dr > THRESHOLD_DEAD_RATIO_HIGH:
            a.append(f"⚠️ Sections mortes : {int(dr*100)}% du cockpit ({len(never_opened)}/{len(KNOWN_SECTIONS)}) "
                     f"jamais ouvert sur 7j : {', '.join(sorted(never_opened))}")
        elif dr > THRESHOLD_DEAD_RATIO_WARN:
            a.append(f"📉 Sections peu explorees : {int(dr*100)}% jamais ouvertes ({len(never_opened)}/{len(KNOWN_SECTIONS)})")
    # 3. Recurring errors in logs
    top_pat = sorted(pipe_report.patterns.items(), key=lambda x: -x[1])[:3]
    for pat, cnt in top_pat:
        if cnt >= THRESHOLD_RECURRING_ERROR:
            a.append(f"⚠️ Erreur recurrente : {pat} ({cnt} occurrences)\n  Premier exemple : {pipe_report.first_examples.get(pat, '')}")
    if top_pat and not any(c >= THRESHOLD_RECURRING_ERROR for _, c in top_pat):
        a.append("📋 Top 3 patterns d'erreur (sous le seuil) : " + ", ".join(f"{p} ({c}x)" for p, c in top_pat))
    # 4. Low engagement (CTR)
    so, lc = counts.get("section_opened", 0), counts.get("link_clicked", 0)
    if so > THRESHOLD_CTR_MIN_SAMPLE and (lc / so) < THRESHOLD_CTR_LOW:
        a.append(f"⚠️ Engagement faible : {lc/so:.0%} des ouvertures menent a un clic ({lc}/{so})")
    # 5. Search deserted (compare with previous week's file)
    if counts.get("search_performed", 0) == 0:
        prev = INTEL_DIR / f"{(NOW - timedelta(days=7)).strftime('%Y-%m-%d')}-signals.md"
        if prev.exists():
            try:
                for ln in prev.read_text(encoding="utf-8").splitlines():
                    if "search_performed" in ln and "/" in ln:
                        pc = int(ln.split("/")[1].strip().split()[0])
                        if pc > 0: a.append(f"⚠️ Recherche desertee : 0 cette semaine vs {pc} precedemment")
                        break
            except Exception: pass
    # 6. Pipeline broken
    if pipe_report.count > THRESHOLD_PIPELINE_WARN:
        top3 = ", ".join(f"{p} ({c}x)" for p, c in sorted(pipe_report.patterns.items(), key=lambda x: -x[1])[:3])
        lvl = "🔴 Pipeline critique" if pipe_report.count > THRESHOLD_PIPELINE_CRIT else "⚠️ Pipeline en souffrance"
        a.append(f"{lvl} : {pipe_report.count} erreurs cette semaine. Top 3 : {top3}")
    # 7. No commits
    if commits == 0: a.append("⚠️ Aucun commit cette semaine")
    # 8. Unknown sections
    for s in sorted(unknown): a.append(f"❓ Section inconnue : {s} (a ajouter dans extract_signals.py)")
    return a

def main():
    t0 = time.time()
    INTEL_DIR.mkdir(parents=True, exist_ok=True)
    out = INTEL_DIR / f"{TODAY}-signals.md"
    parts, errors = [], []
    total, counts, unknown, commits, all_events = 0, {}, set(), 0, []
    pipe_report, never_opened = PipelineLogReport("", 0, {}, {}), set()
    parts.append(f"# Signaux internes -- {TODAY}\n\n> Genere le {NOW.strftime('%Y-%m-%d a %H:%M:%S')} "
                 f"par extract_signals.py\n> Periode : 7 derniers jours\n")
    try:
        text, total, counts, unknown, all_events = section_telemetry()
        opened = {(e.get("payload") or {}).get("section") for e in all_events
                  if e.get("event_type") == "section_opened"} - {None, ""}
        never_opened = KNOWN_SECTIONS - opened
        parts.append(text); print("[1/8] telemetrie OK")
    except Exception as e:
        parts.append(f"## Volume telemetrie\n- Indisponible : {e}\n")
        errors.append(f"telemetrie ({e})"); print(f"[1/8] telemetrie ERREUR: {e}")
    try: parts.append(section_temporal(all_events)); print("[2/8] pattern_temporel OK")
    except Exception as e:
        parts.append(f"## Pattern temporel\n- Indisponible : {e}\n")
        errors.append(f"pattern_temporel ({e})"); print(f"[2/8] pattern_temporel ERREUR: {e}")
    for i, (name, fn) in enumerate([("recherches", section_searches), ("erreurs_ui", section_errors_ui),
            ("git", section_git), ("pipelines", section_pipeline_errors), ("sante", section_health)], 3):
        try:
            result = fn()
            if name == "pipelines": pipe_report = result; text = result.text
            elif name == "git" and isinstance(result, tuple): text, commits = result
            else: text = result if isinstance(result, str) else result[0]
            parts.append(text); print(f"[{i}/8] {name} OK")
        except Exception as e:
            parts.append(f"## {name.replace('_', ' ').title()}\n- Indisponible : {e}\n")
            errors.append(f"{name} ({e})"); print(f"[{i}/8] {name} ERREUR: {e}")
    try:
        anom = detect_anomalies(total, counts, commits, unknown, pipe_report, never_opened)
        parts.append("## Anomalies detectees\n" + ("\n".join(f"- {x}" for x in anom) if anom else "- RAS") + "\n")
        print("[8/8] anomalies OK")
    except Exception as e:
        parts.append(f"## Anomalies detectees\n- Erreur : {e}\n"); errors.append(f"anomalies ({e})")
    elapsed = round(time.time() - t0, 1)
    parts.append(f"## Meta\n- Duree : {elapsed}s\n- Sections en erreur : {', '.join(errors) or 'aucune'}\n")
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"\n{out} ({elapsed}s)")

if __name__ == "__main__":
    main()
