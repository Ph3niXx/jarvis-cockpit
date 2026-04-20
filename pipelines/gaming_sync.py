#!/usr/bin/env python3
"""
Gaming RSS -> Supabase sync pipeline.

Fetches ~9 gaming feeds (FR + EN), auto-categorises each article into
releases / upcoming / esport / industry via source + title regex, and
upserts into gaming_articles.

Usage:
    python pipelines/gaming_sync.py
    python pipelines/gaming_sync.py --dry-run
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
# Feed sources
# ---------------------------------------------------------------------------

# (source_name, url, default_category)
# default_category is used when the title regex doesn't hit any stronger signal.
RSS_FEEDS = [
    # FR — news générales
    ("JeuxVideo.com",     "https://www.jeuxvideo.com/rss/rss.xml",         "releases"),
    ("Gamekult",          "https://www.gamekult.com/feed.xml",             "releases"),
    ("ActuGaming",        "https://www.actugaming.net/feed/",              "releases"),

    # EN — news généralistes
    ("IGN",               "https://feeds.ign.com/ign/games-all",           "releases"),
    ("Eurogamer",         "https://www.eurogamer.net/feed",                "releases"),
    ("PC Gamer",          "https://www.pcgamer.com/rss/",                  "releases"),

    # Industry
    ("GamesIndustry.biz", "https://www.gamesindustry.biz/feed",            "industry"),

    # E-sport
    ("Dexerto",           "https://www.dexerto.com/feed/",                 "esport"),
    ("L'Equipe E-sport",  "https://dwh.lequipe.fr/api/edito/rss?path=/esport", "esport"),
]

MAX_ARTICLES_PER_FEED = 15
REQUEST_TIMEOUT = 15
USER_AGENT = "Mozilla/5.0 (compatible; AI-Cockpit-Gaming/1.0; +https://github.com/)"

# ---------------------------------------------------------------------------
# Category detection
# ---------------------------------------------------------------------------

# Order matters — first match wins. esport + industry beat generic release/upcoming.
CATEGORY_PATTERNS = [
    ("esport", re.compile(
        r"\b(esport|esports|e-sport|tournament|tournoi|championship|"
        r"lcs|lec|lck|lpl|worlds|msi|ti\d*|"
        r"valorant champions|vct|cs major|csgo major|counter[- ]strike major|"
        r"dota 2 international|league of legends world|"
        r"karmine|kcorp|faker|t1|fnatic|g2 esports|cloud9|liquid|"
        r"grand final|grande finale)\b", re.I)),
    ("industry", re.compile(
        r"\b(acquires?|acquisition|acquired|buyout|merger|merges?|"
        r"layoff|layoffs|licencie|fermeture|shut ?down|closes? studio|"
        r"earnings|revenue|quarterly|ipo|funding round|investment|"
        r"ceo|executive|resigns?|stepping down|"
        r"embracer|microsoft gaming|sony interactive|take-two|ubisoft|"
        r"ea games|activision blizzard|square enix|"
        r"racheté|rachat|investissement)\b", re.I)),
    ("upcoming", re.compile(
        r"\b(announced|announcement|reveal(ed)?|coming (soon|to|in)|"
        r"release date|launches? (in|on|next)|delayed|"
        r"preview|hands[- ]on|first look|leaked?|leak|"
        r"annonce|annonc(é|ée|és)|sortie prévue|révélé|"
        r"à venir|prévu pour|présent(é|e|ation)|"
        r"trailer|teaser|direct|showcase|state of play|nintendo direct|"
        r"xbox games showcase|gamescom|e3)\b", re.I)),
    ("releases", re.compile(
        r"\b(released?|launch(ed|es|ing)|available now|out now|"
        r"day one|drops today|review|critique|our verdict|"
        r"sortie|sorti|disponible|test[é]?|note|patch|update|mise à jour)\b",
        re.I)),
]


def detect_category(title, summary, default):
    text = (title or "") + " " + (summary or "")
    for cat, pattern in CATEGORY_PATTERNS:
        if pattern.search(text):
            return cat
    return default


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

def fetch_feed(source, url, default_category):
    print(f"  [{default_category}] {source}...", end=" ", flush=True)
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
        category = detect_category(title, summary, default_category)
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
    url = f"{supabase_url}/rest/v1/gaming_articles?on_conflict=url"

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

    print(f"Gaming sync starting ({len(RSS_FEEDS)} feeds)")
    print(f"  dry_run={dry_run}")

    t0 = time.time()
    all_rows = []
    for source, url, default_cat in RSS_FEEDS:
        rows = fetch_feed(source, url, default_cat)
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
