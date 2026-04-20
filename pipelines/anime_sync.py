#!/usr/bin/env python3
"""
Anime / Cinema / Series RSS + Jikan upcoming -> Supabase.

Fetches:
- ~9 FR+EN news feeds (AlloCiné, Première, Écran Large, Anime News Network,
  MyAnimeList, Deadline, Variety, Hollywood Reporter, IndieWire)
- Jikan API /seasons/upcoming for real upcoming anime (title + studio +
  air date + synopsis + MAL url)

Auto-categorises articles into released / upcoming / industry via
source + title regex. Upserts into anime_articles.

Usage:
    python pipelines/anime_sync.py
    python pipelines/anime_sync.py --dry-run
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

RSS_FEEDS = [
    # FR — cinéma + séries
    ("AlloCiné News",        "https://www.allocine.fr/rss/news.xml",           "released"),
    ("AlloCiné Cinéma",      "https://www.allocine.fr/rss/news-cine.xml",      "released"),
    ("AlloCiné Séries",      "https://www.allocine.fr/rss/news-series.xml",    "released"),
    ("Première",             "https://www.premiere.fr/rss.xml",                "released"),
    ("Écran Large",          "https://www.ecranlarge.com/feed",                "released"),

    # EN — anime
    ("Anime News Network",   "https://www.animenewsnetwork.com/all/rss.xml",   "released"),
    ("MyAnimeList",          "https://myanimelist.net/rss/news.xml",           "released"),

    # EN — industrie + box office
    ("Deadline",             "https://deadline.com/feed/",                      "industry"),
    ("Variety",              "https://variety.com/feed/",                       "industry"),
    ("Hollywood Reporter",   "https://www.hollywoodreporter.com/feed/",         "industry"),
    ("IndieWire",            "https://www.indiewire.com/feed/",                 "industry"),
]

# Jikan API (MyAnimeList, no auth required, 3 req/s limit)
JIKAN_UPCOMING_URL = "https://api.jikan.moe/v4/seasons/upcoming"
JIKAN_UPCOMING_LIMIT = 25  # 25 most anticipated upcoming anime

MAX_ARTICLES_PER_FEED = 12
REQUEST_TIMEOUT = 15
USER_AGENT = "Mozilla/5.0 (compatible; AI-Cockpit-Anime/1.0; +https://github.com/)"


# ---------------------------------------------------------------------------
# Category detection (regex on title+summary)
# ---------------------------------------------------------------------------

CATEGORY_PATTERNS = [
    ("industry", re.compile(
        r"\b(acquires?|acquired|acquisition|merger|merges?|"
        r"layoff|layoffs|licenciements?|box office|box-office|"
        r"earnings|revenue|quarterly|ipo|funding|investment|"
        r"disney|warner bros|paramount|universal|a24|netflix|"
        r"crunchyroll|sony pictures|amazon mgm|apple tv|"
        r"ratings?|viewership|streaming wars|"
        r"ceo|executive|resigns?|stepping down|"
        r"racheté|rachat|fusion|fermeture studio|"
        r"audiences?|parts de marché|chiffre d'affaires)\b", re.I)),
    ("upcoming", re.compile(
        r"\b(announced|announcement|reveal(ed|s)?|coming (soon|to|in)|"
        r"release date|premieres? (on|in)|delayed|pushed back|"
        r"first look|trailer|teaser|premier aperçu|"
        r"annonce|annonc(é|ée|és)|sortie prévue|révélé|"
        r"à venir|prévu pour|attendu en|présent(é|e|ation)|"
        r"cast(ing)?|greenlit|green-lit|renewed for|"
        r"season \d+ (premiere|confirmed|announced|renewed)|"
        r"upcoming|set (to|for) release)\b", re.I)),
    ("released", re.compile(
        r"\b(released?|launches?|premiered?|debut(s|ed)?|"
        r"out (now|today)|available now|streaming (now|today)|"
        r"review|critique|our verdict|our take|recap|"
        r"sortie|sorti|disponible|test[é]?|nouvel épisode|"
        r"episode \d+|finale|ending)\b", re.I)),
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
# RSS fetch
# ---------------------------------------------------------------------------

def fetch_rss(source, url, default_cat):
    print(f"  [{default_cat}] {source}...", end=" ", flush=True)
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
        category = detect_category(title, summary, default_cat)
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
# Jikan API — upcoming anime
# ---------------------------------------------------------------------------

def fetch_jikan_upcoming():
    print(f"  [upcoming] Jikan API /seasons/upcoming...", end=" ", flush=True)
    try:
        resp = requests.get(
            JIKAN_UPCOMING_URL,
            params={"page": 1, "limit": JIKAN_UPCOMING_LIMIT},
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        print(f"FAIL ({exc})")
        return []

    out = []
    for a in payload.get("data", [])[:JIKAN_UPCOMING_LIMIT]:
        mal_url = a.get("url") or ""
        title = (a.get("title_english") or a.get("title") or "").strip()
        if not mal_url or not title:
            continue
        studios = ", ".join(s.get("name", "") for s in (a.get("studios") or []) if s.get("name")) or "Studio inconnu"
        aired_from = (a.get("aired") or {}).get("from")
        air_label = ""
        if aired_from:
            try:
                dt = datetime.fromisoformat(aired_from.replace("Z", "+00:00"))
                air_label = f" — Diffusion prévue : {dt.strftime('%B %Y')}"
            except Exception:
                air_label = f" — Diffusion : {aired_from[:10]}"
        synopsis = (a.get("synopsis") or "").replace("[Written by MAL Rewrite]", "").strip()
        summary_parts = [f"Studio : {studios}{air_label}"]
        if synopsis:
            summary_parts.append(synopsis[:320])
        summary = " · ".join(summary_parts)[:500]
        atype = a.get("type") or "Anime"
        out.append({
            "source": "MyAnimeList",
            "title": f"[{atype}] {title}"[:500],
            "url": mal_url,
            "summary": summary,
            "date_published": aired_from or datetime.now(timezone.utc).isoformat(),
            "category": "upcoming",
            "fetch_date": datetime.now(timezone.utc).date().isoformat(),
        })
    print(f"{len(out)} upcoming anime")
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
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    url = f"{supabase_url}/rest/v1/anime_articles?on_conflict=url"

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

    print(f"Anime sync starting ({len(RSS_FEEDS)} RSS feeds + Jikan upcoming)")
    print(f"  dry_run={dry_run}")

    t0 = time.time()
    all_rows = []
    for source, url, default_cat in RSS_FEEDS:
        all_rows.extend(fetch_rss(source, url, default_cat))
        time.sleep(0.2)

    all_rows.extend(fetch_jikan_upcoming())

    print(f"\nFetched {len(all_rows)} items in {time.time() - t0:.1f}s")
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
