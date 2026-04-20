#!/usr/bin/env python3
"""
Sport RSS -> Supabase sync pipeline.

Fetches ~10 French sport RSS feeds (L'Equipe, RMC, Eurosport, Cyclism'Actu)
grouped by discipline, de-duplicates by URL, and upserts into sport_articles.

Usage:
    python pipelines/sport_sync.py
    python pipelines/sport_sync.py --dry-run
"""

import os
import sys
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser

import feedparser
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# (source_name, url, category)
# category values must match cockpit/app.jsx sport panel: foot / rugby / cyclisme / tennis / natation / esport
LEQUIPE_BASE = "https://dwh.lequipe.fr/api/edito/rss?path="
RSS_FEEDS = [
    # Football
    ("L'Equipe Football",  LEQUIPE_BASE + "/football",                           "foot"),
    ("RMC Sport Football", "https://rmcsport.bfmtv.com/rss/football/",           "foot"),

    # Rugby
    ("L'Equipe Rugby",     LEQUIPE_BASE + "/rugby",                              "rugby"),
    ("RMC Sport Rugby",    "https://rmcsport.bfmtv.com/rss/rugby/",              "rugby"),

    # Cyclisme
    ("L'Equipe Cyclisme",  LEQUIPE_BASE + "/cyclisme",                           "cyclisme"),
    ("Cyclism'Actu",       "https://feeds.feedburner.com/cyclismactu",           "cyclisme"),
    ("RMC Cyclisme",       "https://rmcsport.bfmtv.com/rss/cyclisme/",           "cyclisme"),

    # Tennis
    ("L'Equipe Tennis",    LEQUIPE_BASE + "/tennis",                             "tennis"),
    ("RMC Tennis",         "https://rmcsport.bfmtv.com/rss/tennis/",             "tennis"),

    # Natation
    ("L'Equipe Natation",  LEQUIPE_BASE + "/natation",                           "natation"),
    ("RMC Natation",       "https://rmcsport.bfmtv.com/rss/natation/",           "natation"),

    # E-sport
    ("L'Equipe E-sport",   LEQUIPE_BASE + "/esport",                             "esport"),
]

MAX_ARTICLES_PER_FEED = 15
REQUEST_TIMEOUT = 15
USER_AGENT = "Mozilla/5.0 (compatible; AI-Cockpit-Sport/1.0; +https://github.com/)"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def get_text(self):
        return "".join(self.parts)


def strip_html(text):
    if not text:
        return ""
    s = _HTMLStripper()
    try:
        s.feed(text)
    except Exception:
        return re.sub(r"<[^>]+>", " ", text).strip()
    return re.sub(r"\s+", " ", s.get_text()).strip()


def parse_date(entry):
    """Best-effort publish date -> ISO string (UTC) or None."""
    for attr in ("published_parsed", "updated_parsed"):
        val = entry.get(attr)
        if val:
            try:
                return datetime(*val[:6], tzinfo=timezone.utc).isoformat()
            except Exception:
                continue
    return None


def env_required(name):
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: missing env var {name}")
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_feed(source, url, category):
    print(f"  [{category}] {source}...", end=" ", flush=True)
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
    except Exception as exc:
        print(f"FAIL ({exc})")
        return []

    feed = feedparser.parse(resp.content)
    out = []
    for entry in feed.entries[:MAX_ARTICLES_PER_FEED]:
        link = (entry.get("link") or "").strip()
        title = strip_html(entry.get("title") or "").strip()
        if not link or not title:
            continue
        summary = strip_html(entry.get("summary") or entry.get("description") or "")[:500]
        out.append({
            "source": source,
            "title": title[:500],
            "url": link,
            "summary": summary,
            "date_published": parse_date(entry),
            "category": category,
            "fetch_date": datetime.now(timezone.utc).date().isoformat(),
        })
    print(f"{len(out)} items")
    return out


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------

def upsert_batch(rows, supabase_url, supabase_key):
    if not rows:
        return 0
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        # on_conflict=url => upsert by unique URL, skip duplicates silently
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    url = f"{supabase_url}/rest/v1/sport_articles?on_conflict=url"

    saved = 0
    batch = 50
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        resp = requests.post(url, headers=headers, json=chunk, timeout=30)
        if resp.status_code in (200, 201, 204):
            saved += len(chunk)
        else:
            print(f"  WARN: batch {i // batch + 1}: {resp.status_code} {resp.text[:200]}")
    return saved


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")
    else:
        supabase_url = env_required("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or env_required("SUPABASE_KEY")

    print(f"Sport sync starting ({len(RSS_FEEDS)} feeds)")
    print(f"  dry_run={dry_run}")

    t0 = time.time()
    all_rows = []
    for source, url, category in RSS_FEEDS:
        rows = fetch_feed(source, url, category)
        all_rows.extend(rows)
        time.sleep(0.2)

    print(f"\nFetched {len(all_rows)} articles in {time.time() - t0:.1f}s")
    by_cat = {}
    for r in all_rows:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
    for cat, n in sorted(by_cat.items()):
        print(f"  {cat}: {n}")

    if dry_run:
        print("\n[dry-run] skipping DB write")
        return

    print("\nUpserting to Supabase...")
    saved = upsert_batch(all_rows, supabase_url, supabase_key)
    print(f"  -> {saved}/{len(all_rows)} rows posted (duplicates silently skipped)")


if __name__ == "__main__":
    main()
