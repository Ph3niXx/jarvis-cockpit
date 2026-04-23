#!/usr/bin/env python3
"""
TMDB upcoming sync — fetches upcoming movies + TV episodes from the
TMDB API and upserts them into `anime_articles` so the Jarvis cockpit
"Anime / Ciné / Séries" tab renders them in its `<ProdTable>` calendar
alongside MyAnimeList anime upcoming.

Why the same table?  The anime tab's loadPanel case filters by
`category === "upcoming" && date_published`, source-agnostic. Reusing
`anime_articles` avoids a new table + a second loader + a second
transformer.

Row shape emitted (matches Jikan-style rows from anime_sync.py):
    source        = "TMDB"
    category      = "upcoming"
    title         = "[Movie] Title"  or  "[TV] Title"
    summary       = "Producteur: ... · Genres: ... · Pays: ..."
    date_published = ISO release / first_air_date
    url           = "https://www.themoviedb.org/movie/{id}"  or /tv/{id}

Usage:
    TMDB_API_KEY=xxx SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python pipelines/tmdb_sync.py

No TMDB_API_KEY → the script prints a skip message and exits 0.
No Supabase creds → the script exits 1.

NOTE: The GitHub Actions workflow is NOT committed yet. Add
.github/workflows/tmdb-sync.yml with a cron schedule (suggested:
"15 7 * * *") and TMDB_API_KEY in your repo secrets once you've
registered at https://developer.themoviedb.org/.
"""
from __future__ import annotations
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta

try:
    import requests
except ImportError:
    print("FATAL: requests not installed. pip install -r pipelines/requirements-tmdb.txt")
    sys.exit(1)


TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342"

# Pull window — how far ahead we accept releases into the calendar.
UPCOMING_DAYS_AHEAD = 180  # 6 months of visible horizon
REQUEST_TIMEOUT = 15

# TMDB paginates 20 rows/page. We cap at 5 pages per endpoint to stay
# polite and avoid a 1000-row table bloat.
MAX_PAGES = 5


def env_required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: missing env var {name}")
        sys.exit(1)
    return value


def env_optional(name: str) -> str | None:
    return os.environ.get(name) or None


def tmdb_get(endpoint: str, params: dict) -> dict:
    """GET against TMDB with rate-limit respect (40 req / 10s)."""
    url = f"{TMDB_BASE}{endpoint}"
    r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    if r.status_code == 429:
        retry_after = int(r.headers.get("Retry-After", "2"))
        time.sleep(retry_after + 1)
        r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json()


def fetch_upcoming_movies(api_key: str, language: str = "fr-FR") -> list[dict]:
    """Upcoming movies from TMDB — /movie/upcoming paginated."""
    all_rows: list[dict] = []
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=UPCOMING_DAYS_AHEAD)
    for page in range(1, MAX_PAGES + 1):
        data = tmdb_get("/movie/upcoming", {
            "api_key": api_key,
            "language": language,
            "page": page,
            "region": "FR",  # FR release dates; adjust if relevant
        })
        for m in data.get("results", []):
            rd = m.get("release_date")
            if not rd:
                continue
            try:
                rd_dt = datetime.strptime(rd, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            # Skip anything already out, or too far in the future
            if rd_dt.date() < today or rd_dt.date() > horizon:
                continue
            title = m.get("title") or m.get("original_title") or "—"
            genres = ", ".join(str(g) for g in (m.get("genre_ids") or [])[:3]) or ""
            summary = (
                f"Producteur: TMDB · Genres: {genres or 'n/a'} · "
                f"{(m.get('overview') or '')[:200]}"
            )
            all_rows.append({
                "source": "TMDB",
                "category": "upcoming",
                "title": f"[Movie] {title}",
                "summary": summary,
                "date_published": rd_dt.isoformat(),
                "url": f"https://www.themoviedb.org/movie/{m.get('id')}",
            })
        if page >= data.get("total_pages", 0):
            break
    return all_rows


def fetch_on_the_air_tv(api_key: str, language: str = "fr-FR") -> list[dict]:
    """TV shows currently on the air — /tv/on_the_air.

    TMDB doesn't expose "upcoming episodes" directly via a single endpoint,
    so we use on_the_air as a proxy for shows with new episodes imminent.
    """
    all_rows: list[dict] = []
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=UPCOMING_DAYS_AHEAD)
    for page in range(1, MAX_PAGES + 1):
        data = tmdb_get("/tv/on_the_air", {
            "api_key": api_key,
            "language": language,
            "page": page,
        })
        for t in data.get("results", []):
            # Use first_air_date or last_air_date when available
            date_str = t.get("first_air_date") or t.get("last_air_date")
            if not date_str:
                continue
            try:
                rd_dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            # For TV, we accept "currently airing" so the filter is more generous
            if rd_dt.date() < today - timedelta(days=30) or rd_dt.date() > horizon:
                continue
            name = t.get("name") or t.get("original_name") or "—"
            genres = ", ".join(str(g) for g in (t.get("genre_ids") or [])[:3]) or ""
            summary = (
                f"Producteur: TMDB · Genres: {genres or 'n/a'} · "
                f"{(t.get('overview') or '')[:200]}"
            )
            all_rows.append({
                "source": "TMDB",
                "category": "upcoming",
                "title": f"[TV] {name}",
                "summary": summary,
                "date_published": rd_dt.isoformat(),
                "url": f"https://www.themoviedb.org/tv/{t.get('id')}",
            })
        if page >= data.get("total_pages", 0):
            break
    return all_rows


def upsert_to_supabase(rows: list[dict], supabase_url: str, service_key: str) -> int:
    if not rows:
        return 0
    url = f"{supabase_url}/rest/v1/anime_articles?on_conflict=url"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    # Batches of 50 to avoid REST timeouts on cold starts
    saved = 0
    for i in range(0, len(rows), 50):
        batch = rows[i:i + 50]
        r = requests.post(url, headers=headers, data=json.dumps(batch), timeout=REQUEST_TIMEOUT)
        if r.status_code not in (200, 201):
            print(f"  [WARN] batch {i // 50}: HTTP {r.status_code} {r.text[:160]}")
            continue
        saved += len(batch)
    return saved


def main() -> int:
    api_key = env_optional("TMDB_API_KEY")
    if not api_key:
        print("[skip] TMDB_API_KEY not set — pipeline stub only. Register at https://developer.themoviedb.org/ and set the secret to activate.")
        return 0

    supabase_url = env_required("SUPABASE_URL")
    service_key = env_required("SUPABASE_SERVICE_KEY")

    print("TMDB sync starting…")
    movies = fetch_upcoming_movies(api_key)
    print(f"  → {len(movies)} upcoming movies (next {UPCOMING_DAYS_AHEAD} days)")
    tv = fetch_on_the_air_tv(api_key)
    print(f"  → {len(tv)} on-air TV shows")

    all_rows = movies + tv
    saved = upsert_to_supabase(all_rows, supabase_url, service_key)
    print(f"  → {saved}/{len(all_rows)} rows upserted into anime_articles")
    return 0


if __name__ == "__main__":
    sys.exit(main())
