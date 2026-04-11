"""Jarvis — Daily Brief Generator: summarize window + Outlook activity into an HTML brief.

Reads local activity JSONL files and Outlook snapshots, computes stats,
generates a narrative via LLM, and upserts the brief into Supabase.

Usage:
    from observers.daily_brief_generator import generate_brief
    result = generate_brief()           # today
    result = generate_brief("2026-04-10")  # specific date
"""

import json
import logging
import os
import re
import sys
from datetime import date, datetime, timedelta

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

log = logging.getLogger("daily_brief_generator")

BRIEF_PROMPT = """Tu es Jarvis, assistant personnel de Jean.
Résume cette journée de travail en 2-3 phrases en français. Sois factuel et concis.
Mentionne les activités principales et le rythme de la journée.
Ne donne pas de conseils, juste un résumé.
/no_think"""


def _sb_headers() -> dict:
    """Use service_role key for writes, fall back to anon."""
    key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _format_minutes(minutes: int) -> str:
    """Format minutes into 'Xh' or 'XhYY' or 'Xmin'."""
    if minutes < 60:
        return f"{minutes}min"
    h = minutes // 60
    m = minutes % 60
    return f"{h}h{m:02d}" if m else f"{h}h"


def _build_stats_text(stats: dict, outlook: dict | None = None) -> str:
    """Build a human-readable stats summary for the LLM prompt."""
    lines = []

    cats = stats.get("categories", {})
    if cats:
        cat_parts = []
        cat_labels = {
            "dev": "Développement",
            "communication": "Communication",
            "browsing": "Navigation web",
            "documents": "Documents",
            "other": "Autre",
        }
        for cat, minutes in sorted(cats.items(), key=lambda x: x[1], reverse=True):
            label = cat_labels.get(cat, cat.capitalize())
            cat_parts.append(f"{label}: {_format_minutes(minutes)}")
        lines.append("Catégories : " + ", ".join(cat_parts))

    top_apps = stats.get("top_apps", [])
    if top_apps:
        app_parts = [f"{a['name']} ({_format_minutes(a['minutes'])})" for a in top_apps[:5]]
        lines.append("Top apps : " + ", ".join(app_parts))

    first = stats.get("first_activity", "")
    last = stats.get("last_activity", "")
    if first and last:
        lines.append(f"Première activité : {first} — Dernière : {last}")

    total = stats.get("total_minutes", 0)
    lines.append(f"Temps total observé : {_format_minutes(total)}")

    # Outlook data
    if outlook:
        ms = outlook.get("meetings_stats", {})
        em = outlook.get("emails", {})
        if ms.get("count"):
            teams_info = f" (dont {ms['teams_count']} Teams)" if ms.get("teams_count") else ""
            lines.append(f"Réunions : {ms['count']}{teams_info}, {_format_minutes(ms['total_minutes'])} total")
        if em.get("received_today") or em.get("sent_today"):
            lines.append(f"Emails : {em.get('received_today', 0)} reçus, {em.get('sent_today', 0)} envoyés, {em.get('inbox_unread', 0)} non lus")

    return "\n".join(lines)


def _call_llm(stats_text: str) -> str:
    """Call local LLM to generate narrative brief via centralized client."""
    try:
        from llm_client import chat_completion_sync

        answer, _tokens = chat_completion_sync(
            messages=[
                {"role": "system", "content": BRIEF_PROMPT},
                {"role": "user", "content": stats_text},
            ],
            max_tokens=256,
            temperature=0.3,
        )
        return answer
    except Exception as e:
        log.warning("LLM call failed: %s", e)
        return ""


def _build_brief_html(stats: dict, narrative: str, outlook: dict | None = None) -> str:
    """Build HTML for the activity brief."""
    cats = stats.get("categories", {})
    total = max(stats.get("total_minutes", 1), 1)
    top_apps = stats.get("top_apps", [])
    first = stats.get("first_activity", "")
    last = stats.get("last_activity", "")

    cat_colors = {
        "dev": "#6C5CE7",
        "communication": "#0984E3",
        "browsing": "#FDCB6E",
        "documents": "#00B894",
        "other": "#B2BEC3",
    }
    cat_labels = {
        "dev": "Dev",
        "communication": "Comm",
        "browsing": "Web",
        "documents": "Docs",
        "other": "Autre",
    }

    # Category bars
    bars_html = ""
    for cat, minutes in sorted(cats.items(), key=lambda x: x[1], reverse=True):
        pct = round(minutes / total * 100)
        color = cat_colors.get(cat, "#B2BEC3")
        label = cat_labels.get(cat, cat)
        bars_html += (
            f'<div style="display:flex;align-items:center;gap:8px;margin:3px 0">'
            f'<span style="width:50px;font-size:.8em;color:var(--muted)">{label}</span>'
            f'<div style="flex:1;height:14px;background:var(--bg2);border-radius:7px;overflow:hidden">'
            f'<div style="width:{pct}%;height:100%;background:{color};border-radius:7px"></div>'
            f'</div>'
            f'<span style="width:40px;font-size:.78em;color:var(--muted);text-align:right">{_format_minutes(minutes)}</span>'
            f'</div>'
        )

    # Outlook: meetings + emails
    outlook_html = ""
    if outlook:
        ms = outlook.get("meetings_stats", {})
        em = outlook.get("emails", {})
        parts = []
        if ms.get("count"):
            teams_tag = f" ({ms['teams_count']} Teams)" if ms.get("teams_count") else ""
            parts.append(f'<span style="margin-right:14px">&#128197; {ms["count"]} réunion{"s" if ms["count"]>1 else ""}{teams_tag} · {_format_minutes(ms["total_minutes"])}</span>')
        if em.get("received_today") or em.get("sent_today"):
            parts.append(f'<span>&#128231; {em.get("received_today",0)} reçus · {em.get("sent_today",0)} envoyés · {em.get("inbox_unread",0)} non lus</span>')
        if parts:
            outlook_html = f'<div style="font-size:.82em;color:var(--muted);margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">{"".join(parts)}</div>'

    # Top apps list
    apps_html = ""
    if top_apps[:4]:
        apps = " &middot; ".join(f"{a['name']} ({_format_minutes(a['minutes'])})" for a in top_apps[:4])
        apps_html = f'<div style="font-size:.78em;color:var(--muted);margin-top:6px">Top : {apps}</div>'

    # Time range
    time_html = ""
    if first and last:
        time_html = f'<div style="font-size:.78em;color:var(--muted);margin-top:2px">{first} &rarr; {last} &middot; {_format_minutes(total)} observé</div>'

    # Narrative
    narr_html = ""
    if narrative:
        narr_html = f'<div style="margin-top:8px;font-size:.88em;line-height:1.4">{narrative}</div>'

    return (
        f'<div style="margin-top:10px">'
        f'<div style="font-weight:600;font-size:.9em;margin-bottom:6px">Activité hier</div>'
        f'{bars_html}'
        f'{outlook_html}'
        f'{apps_html}'
        f'{time_html}'
        f'{narr_html}'
        f'</div>'
    )


def generate_brief(date_str: str | None = None) -> dict:
    """Generate activity brief for a date. Returns {"status", "brief_html", "stats"}.

    Args:
        date_str: ISO date string (YYYY-MM-DD). Defaults to yesterday.
    """
    from observers.window_observer import read_day_entries, compute_stats
    from observers.outlook_observer import read_outlook_data

    if date_str:
        target = date.fromisoformat(date_str)
    else:
        target = date.today() - timedelta(days=1)

    log.info("Generating activity brief for %s", target.isoformat())

    # Window activity
    entries = read_day_entries(target)
    # Outlook data
    outlook = read_outlook_data(target)

    if not entries and not outlook:
        log.info("No activity data for %s", target.isoformat())
        return {"status": "no_data", "brief_html": "", "stats": {}}

    stats = compute_stats(entries) if entries else {"total_minutes": 0, "categories": {}, "top_apps": [], "first_activity": "", "last_activity": "", "window_changes": 0}

    if stats["total_minutes"] < 5 and not outlook:
        log.info("Less than 5 minutes of activity for %s and no Outlook data, skipping", target.isoformat())
        return {"status": "insufficient_data", "brief_html": "", "stats": stats}

    # Generate narrative via LLM
    stats_text = _build_stats_text(stats, outlook=outlook if outlook else None)
    narrative = _call_llm(stats_text)

    # Build HTML
    brief_html = _build_brief_html(stats, narrative, outlook=outlook if outlook else None)

    # Merge outlook stats into payload
    merged_stats = {**stats}
    if outlook:
        merged_stats["meetings"] = outlook.get("meetings_stats", {})
        merged_stats["emails"] = outlook.get("emails", {})

    # Upsert to Supabase
    payload = {
        "date": target.isoformat(),
        "brief_html": brief_html,
        "stats": merged_stats,
    }
    headers = {**_sb_headers(), "Prefer": "resolution=merge-duplicates"}
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/activity_briefs",
            headers=headers,
            json=payload,
            timeout=10,
        )
        if r.status_code in (200, 201):
            log.info("Brief upserted for %s (%d min observed)", target.isoformat(), stats["total_minutes"])
        else:
            log.warning("Upsert failed: %s %s", r.status_code, r.text[:200])
    except Exception as e:
        log.warning("Supabase upsert failed: %s", e)

    return {"status": "ok", "brief_html": brief_html, "stats": merged_stats}
