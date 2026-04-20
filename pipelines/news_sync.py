#!/usr/bin/env python3
"""
Actualités RSS -> Supabase sync pipeline.

Fetches ~12 French news feeds grouped by zone (Paris / France / International),
upserts into news_articles. Category comes from the source, not regex —
a Le Monde International article is international, full stop.

Usage:
    python pipelines/news_sync.py
    python pipelines/news_sync.py --dry-run
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
# Feed sources — category is intrinsic to each feed
# ---------------------------------------------------------------------------

RSS_FEEDS = [
    # Paris
    ("Le Parisien · Paris",  "https://www.leparisien.fr/paris-75/rss.xml",          "paris"),
    ("20 Minutes · Paris",   "https://www.20minutes.fr/feeds/rss-paris.xml",        "paris"),
    ("BFM Paris",            "https://www.bfmtv.com/rss/paris/",                    "paris"),

    # France
    ("Le Monde · À la Une",  "https://www.lemonde.fr/rss/une.xml",                  "france"),
    ("Le Figaro",            "https://www.lefigaro.fr/rss/figaro_actualites.xml",   "france"),
    ("FranceInfo · France",  "https://www.francetvinfo.fr/france.rss",              "france"),
    ("20 Minutes · Une",     "https://www.20minutes.fr/feeds/rss-une.xml",          "france"),
    ("Libération",           "https://www.liberation.fr/arc/outboundfeeds/rss/",    "france"),

    # International
    ("Le Monde · International", "https://www.lemonde.fr/international/rss_full.xml", "international"),
    ("BBC World",                "https://feeds.bbci.co.uk/news/world/rss.xml",       "international"),
    ("France 24",                "https://www.france24.com/fr/rss",                   "international"),
    ("RFI · Monde",              "https://www.rfi.fr/fr/monde/rss",                   "international"),
]

MAX_ARTICLES_PER_FEED = 12
REQUEST_TIMEOUT = 15
USER_AGENT = "Mozilla/5.0 (compatible; AI-Cockpit-News/1.0; +https://github.com/)"


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


def upsert_batch(rows, supabase_url, supabase_key):
    if not rows:
        return 0
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    url = f"{supabase_url}/rest/v1/news_articles?on_conflict=url"

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

    print(f"News sync starting ({len(RSS_FEEDS)} feeds)")
    print(f"  dry_run={dry_run}")

    t0 = time.time()
    all_rows = []
    for source, url, category in RSS_FEEDS:
        all_rows.extend(fetch_feed(source, url, category))
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
