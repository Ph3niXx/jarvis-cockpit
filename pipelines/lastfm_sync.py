#!/usr/bin/env python3
"""
Last.fm → Supabase sync pipeline.

Fetches recent scrobbles, computes daily stats, and stores weekly tops.
First run auto-detects empty DB and backfills 90 days.

Usage:
    python pipelines/lastfm_sync.py              # normal daily sync
    python pipelines/lastfm_sync.py --dry-run    # fetch only, no DB writes
    python pipelines/lastfm_sync.py --days=365   # custom lookback
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from collections import Counter

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LASTFM_API_BASE = "http://ws.audioscrobbler.com/2.0/"
DEFAULT_LOOKBACK_DAYS = 1  # daily run: yesterday's scrobbles
BOOTSTRAP_LOOKBACK_DAYS = 90  # first run: 90 days of history
PAGE_SIZE = 200
DELAY_BETWEEN_REQUESTS = 0.2  # seconds (Last.fm rate limit ~5 req/s)
MAX_RETRIES = 3
AVG_TRACK_DURATION_MIN = 3.5  # for listening time estimation


def env_required(name):
    """Read a required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: Missing required environment variable: {name}")
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Last.fm API helpers
# ---------------------------------------------------------------------------

def lastfm_get(api_key, method, params=None):
    """Call the Last.fm API with retries and error handling."""
    base_params = {
        "method": method,
        "api_key": api_key,
        "format": "json",
    }
    if params:
        base_params.update(params)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(LASTFM_API_BASE, params=base_params, timeout=30)
            if resp.status_code == 429:
                wait = 2 ** attempt
                print(f"[lastfm] Rate limited, waiting {wait}s (attempt {attempt}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            if resp.status_code >= 500:
                wait = 2 ** attempt
                print(f"[lastfm] Server error {resp.status_code}, retrying in {wait}s")
                time.sleep(wait)
                continue
            data = resp.json()
            if "error" in data:
                code = data.get("error")
                msg = data.get("message", "?")
                if code in (6, 10):
                    print(f"FATAL: Last.fm error {code}: {msg}")
                    sys.exit(1)
                raise RuntimeError(f"Last.fm error {code}: {msg}")
            return data
        except requests.RequestException as e:
            if attempt == MAX_RETRIES:
                raise
            print(f"[lastfm] Request failed: {e}, retrying...")
            time.sleep(2 ** attempt)
    raise RuntimeError("Max retries exceeded")


def fetch_recent_tracks(api_key, username, from_ts, to_ts=None, max_pages=None):
    """Fetch scrobbles between two timestamps. Yields (page_data, page_num, total_pages)."""
    page = 1
    while True:
        params = {
            "user": username,
            "limit": PAGE_SIZE,
            "page": page,
            "from": int(from_ts),
            "extended": 0,
        }
        if to_ts:
            params["to"] = int(to_ts)

        data = lastfm_get(api_key, "user.getRecentTracks", params)
        recent = data.get("recenttracks", {})
        attr = recent.get("@attr", {})
        total_pages = int(attr.get("totalPages", 1))
        total = int(attr.get("total", 0))
        tracks = recent.get("track", [])

        if page == 1:
            print(f"[lastfm] {total} scrobbles across {total_pages} pages")

        yield tracks, page, total_pages

        if page >= total_pages:
            break
        if max_pages and page >= max_pages:
            print(f"[lastfm] Stopping at page {page}/{total_pages} (max_pages={max_pages})")
            break
        page += 1
        time.sleep(DELAY_BETWEEN_REQUESTS)


def parse_scrobble(track):
    """Parse a single track from getRecentTracks into a scrobble row."""
    # Skip "now playing" tracks (no timestamp yet)
    if track.get("@attr", {}).get("nowplaying") == "true":
        return None

    date_info = track.get("date", {})
    uts = date_info.get("uts")
    if not uts:
        return None

    return {
        "track_name": track.get("name", ""),
        "artist_name": track.get("artist", {}).get("#text", ""),
        "album_name": track.get("album", {}).get("#text", "") or None,
        "scrobbled_at": datetime.fromtimestamp(int(uts), tz=timezone.utc).isoformat(),
        "track_mbid": track.get("mbid") or None,
        "artist_mbid": track.get("artist", {}).get("mbid") or None,
        "album_mbid": track.get("album", {}).get("mbid") or None,
        "track_url": track.get("url") or None,
        "image_url": _best_image(track.get("image")),
    }


def _best_image(images):
    """Pick the biggest image URL from a Last.fm image array.

    Last.fm returns a list like
        [{"size": "small", "#text": "..."}, {"size": "medium", ...},
         {"size": "large", ...}, {"size": "extralarge", ...}, {"size": "mega", ...}]
    Some entries are empty strings — we fall back to the next size down.
    Returns None if nothing usable is found.
    """
    if not isinstance(images, list):
        return None
    preferred = ["mega", "extralarge", "large", "medium", "small"]
    by_size = {}
    for img in images:
        if not isinstance(img, dict):
            continue
        url = (img.get("#text") or "").strip()
        size = img.get("size") or ""
        if url:
            by_size[size] = url
    for size in preferred:
        if by_size.get(size):
            return by_size[size]
    return None


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def supabase_headers(service_key):
    """Standard Supabase REST headers."""
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def supabase_upsert(url, key, table, rows, on_conflict=None):
    """Upsert rows using ON CONFLICT DO UPDATE.

    `on_conflict` must be a comma-separated list of columns that match a
    UNIQUE index on the table — PostgREST requires the query string to
    select which constraint to conflict on for updates to happen.
    Without it, a duplicate insert returns 409 and the row is skipped,
    which means newly added columns like image_url never get backfilled
    on existing rows. Callers must pass the right conflict key.
    """
    if not rows:
        return 0
    headers = supabase_headers(key)
    headers["Prefer"] = "resolution=merge-duplicates"
    query = f"?on_conflict={on_conflict}" if on_conflict else ""
    total = 0
    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        resp = requests.post(
            f"{url}/rest/v1/{table}{query}",
            headers=headers,
            data=json.dumps(batch, default=str),
            timeout=30,
        )
        if resp.status_code not in (200, 201, 204):
            # Fall back to ignore-duplicates only when no on_conflict was
            # declared — in that mode we can't UPDATE, we can only skip.
            if on_conflict is None and resp.status_code == 409:
                headers_single = {**headers, "Prefer": "resolution=ignore-duplicates"}
                resp = requests.post(
                    f"{url}/rest/v1/{table}",
                    headers=headers_single,
                    data=json.dumps(batch, default=str),
                    timeout=30,
                )
            if resp.status_code not in (200, 201, 204):
                print(f"[supabase] WARNING: upsert to {table} got {resp.status_code}: {resp.text[:200]}")
        total += len(batch)
    return total


def supabase_count(url, key, table):
    """Get row count for a table."""
    headers = supabase_headers(key)
    headers["Prefer"] = "count=exact"
    resp = requests.get(
        f"{url}/rest/v1/{table}?select=id&limit=0",
        headers=headers,
        timeout=15,
    )
    count_header = resp.headers.get("content-range", "")
    # Format: "0-0/42" or "*/0"
    if "/" in count_header:
        return int(count_header.split("/")[1])
    return 0


# ---------------------------------------------------------------------------
# Phase A — Scrobbles
# ---------------------------------------------------------------------------

def sync_scrobbles(api_key, username, supabase_url, service_key, lookback_days, dry_run):
    """Fetch recent scrobbles and store them."""
    # Check if this is a bootstrap (empty DB)
    existing = supabase_count(supabase_url, service_key, "music_scrobbles")
    if existing == 0 and lookback_days <= 1:
        lookback_days = BOOTSTRAP_LOOKBACK_DAYS
        print(f"[lastfm] Bootstrap mode: backfilling {lookback_days} days of history")

    from_ts = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).timestamp()
    to_ts = datetime.now(timezone.utc).timestamp()

    all_scrobbles = []
    raw_pages = []

    for tracks, page, total_pages in fetch_recent_tracks(api_key, username, from_ts, to_ts):
        print(f"[lastfm] Page {page}/{total_pages}: {len(tracks)} tracks")

        raw_pages.append({
            "payload": {"tracks": tracks},
            "page_number": page,
            "total_pages": total_pages,
        })

        for track in tracks:
            scrobble = parse_scrobble(track)
            if scrobble:
                all_scrobbles.append(scrobble)

    print(f"[lastfm] Total parsed: {len(all_scrobbles)} scrobbles")

    if dry_run:
        print(f"[dry-run] Would upsert {len(all_scrobbles)} scrobbles, {len(raw_pages)} raw pages")
        if all_scrobbles:
            top = Counter(s["artist_name"] for s in all_scrobbles).most_common(5)
            print(f"[dry-run] Top artists: {top}")
        return all_scrobbles

    # Store raw
    if raw_pages:
        supabase_upsert(supabase_url, service_key, "music_scrobbles_raw", raw_pages)
        print(f"[supabase] Stored {len(raw_pages)} raw pages")

    # Upsert scrobbles
    if all_scrobbles:
        n = supabase_upsert(
            supabase_url, service_key, "music_scrobbles", all_scrobbles,
            on_conflict="artist_name,track_name,scrobbled_at",
        )
        print(f"[supabase] Upserted {n} scrobbles")

    return all_scrobbles


# ---------------------------------------------------------------------------
# Phase B — Daily stats
# ---------------------------------------------------------------------------

def compute_daily_stats(scrobbles, supabase_url, service_key, dry_run):
    """Compute and store daily aggregated stats."""
    if not scrobbles:
        print("[stats] No scrobbles to compute stats for")
        return

    # Group by date
    by_date = {}
    for s in scrobbles:
        d = s["scrobbled_at"][:10]  # YYYY-MM-DD
        by_date.setdefault(d, []).append(s)

    # Get all known artists before the earliest date (for new_artists detection)
    earliest = min(by_date.keys())
    known_artists = set()
    if not dry_run:
        resp = requests.get(
            f"{supabase_url}/rest/v1/music_scrobbles?select=artist_name&scrobbled_at=lt.{earliest}T00:00:00Z&limit=10000",
            headers=supabase_headers(service_key),
            timeout=30,
        )
        if resp.status_code == 200:
            known_artists = {r["artist_name"] for r in resp.json()}

    stats_rows = []
    seen_artists_cumulative = set(known_artists)

    for date_str in sorted(by_date.keys()):
        day_scrobbles = by_date[date_str]
        artists = Counter(s["artist_name"] for s in day_scrobbles)
        tracks = Counter((s["track_name"], s["artist_name"]) for s in day_scrobbles)
        top_artist = artists.most_common(1)[0] if artists else (None, 0)
        top_track = tracks.most_common(1)[0] if tracks else (None, 0)

        day_artists = set(artists.keys())
        new_artists = day_artists - seen_artists_cumulative
        seen_artists_cumulative |= day_artists

        row = {
            "stat_date": date_str,
            "scrobble_count": len(day_scrobbles),
            "unique_tracks": len(tracks),
            "unique_artists": len(artists),
            "top_artist": top_artist[0],
            "top_artist_count": top_artist[1],
            "top_track": top_track[0][0] if top_track[0] else None,
            "top_track_artist": top_track[0][1] if top_track[0] else None,
            "top_track_count": top_track[1],
            "listening_minutes": int(len(day_scrobbles) * AVG_TRACK_DURATION_MIN),
            "new_artists_count": len(new_artists),
        }
        stats_rows.append(row)

    if dry_run:
        print(f"[dry-run] Would upsert {len(stats_rows)} daily stats")
        for r in stats_rows[:5]:
            print(f"  {r['stat_date']}: {r['scrobble_count']} scrobbles, top={r['top_artist']} ({r['top_artist_count']})")
        return

    supabase_upsert(
        supabase_url, service_key, "music_stats_daily", stats_rows,
        on_conflict="stat_date",
    )
    print(f"[supabase] Upserted {len(stats_rows)} daily stats")


# ---------------------------------------------------------------------------
# Phase C — Weekly tops + loved tracks
# ---------------------------------------------------------------------------

def sync_weekly_tops(api_key, username, supabase_url, service_key, dry_run):
    """Fetch weekly charts and loved tracks."""
    now = datetime.now(timezone.utc)
    is_monday = now.weekday() == 0

    # Check if bootstrap needed
    existing = supabase_count(supabase_url, service_key, "music_top_weekly")
    force = existing == 0

    if not is_monday and not force:
        print("[tops] Skipping weekly tops (not Monday and not bootstrap)")
        return

    if force:
        print("[tops] Bootstrap: fetching weekly charts")

    # Weekly charts (current week)
    charts = [
        ("user.getWeeklyArtistChart", "artist", "name", None),
        ("user.getWeeklyTrackChart", "track", "name", "artist"),
        ("user.getWeeklyAlbumChart", "album", "name", "artist"),
    ]

    # Get the current week's start (last Monday)
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    top_rows = []

    for method, category, name_key, secondary_key in charts:
        data = lastfm_get(api_key, method, {"user": username})
        chart_key = f"weekly{category.title()}chart"
        items = data.get(chart_key, {}).get(category, [])
        if isinstance(items, dict):
            items = [items]

        for i, item in enumerate(items[:10]):
            name = item.get(name_key, "")
            secondary = None
            if secondary_key and isinstance(item.get(secondary_key), dict):
                secondary = item[secondary_key].get("#text", "")
            elif secondary_key and isinstance(item.get(secondary_key), str):
                secondary = item[secondary_key]
            play_count = int(item.get("playcount", 0))

            top_rows.append({
                "week_start": week_start,
                "category": category,
                "item_name": name,
                "secondary_name": secondary,
                "play_count": play_count,
                "rank": i + 1,
                "image_url": _best_image(item.get("image")),
            })

        time.sleep(DELAY_BETWEEN_REQUESTS)

    if dry_run:
        print(f"[dry-run] Would upsert {len(top_rows)} weekly top entries")
        for r in top_rows[:5]:
            print(f"  #{r['rank']} {r['category']}: {r['item_name']} ({r['play_count']})")
    else:
        supabase_upsert(
            supabase_url, service_key, "music_top_weekly", top_rows,
            on_conflict="week_start,category,rank",
        )
        print(f"[supabase] Upserted {len(top_rows)} weekly tops")

    # Loved tracks
    data = lastfm_get(api_key, "user.getLovedTracks", {"user": username, "limit": 50})
    loved = data.get("lovedtracks", {}).get("track", [])
    if isinstance(loved, dict):
        loved = [loved]

    loved_rows = []
    for item in loved:
        date_info = item.get("date", {})
        uts = date_info.get("uts")
        if not uts:
            continue
        loved_rows.append({
            "track_name": item.get("name", ""),
            "artist_name": item.get("artist", {}).get("name", ""),
            "track_url": item.get("url") or None,
            "loved_at": datetime.fromtimestamp(int(uts), tz=timezone.utc).isoformat(),
            "image_url": _best_image(item.get("image")),
        })

    if dry_run:
        print(f"[dry-run] Would upsert {len(loved_rows)} loved tracks")
    else:
        supabase_upsert(
            supabase_url, service_key, "music_loved_tracks", loved_rows,
            on_conflict="artist_name,track_name",
        )
        print(f"[supabase] Upserted {len(loved_rows)} loved tracks")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def sync(dry_run=False, lookback_days=DEFAULT_LOOKBACK_DAYS):
    """Run the full Last.fm → Supabase sync."""
    print("=" * 60)
    print(f"  Last.fm Sync — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  Mode: {'DRY-RUN' if dry_run else 'LIVE'}, Lookback: {lookback_days}d")
    print("=" * 60)

    api_key = env_required("LASTFM_API_KEY")
    username = env_required("LASTFM_USERNAME")
    supabase_url = env_required("SUPABASE_URL")
    service_key = env_required("SUPABASE_SERVICE_KEY")

    # Phase A: Scrobbles
    scrobbles = sync_scrobbles(api_key, username, supabase_url, service_key, lookback_days, dry_run)

    # Phase B: Daily stats
    compute_daily_stats(scrobbles, supabase_url, service_key, dry_run)

    # Phase C: Weekly tops + loved
    sync_weekly_tops(api_key, username, supabase_url, service_key, dry_run)

    print()
    print("=" * 60)
    print(f"  DONE — {len(scrobbles)} scrobbles processed")
    print("=" * 60)


if __name__ == "__main__":
    dry_run_mode = "--dry-run" in sys.argv
    lookback = DEFAULT_LOOKBACK_DAYS
    for arg in sys.argv:
        if arg.startswith("--days="):
            lookback = int(arg.split("=")[1])
    sync(dry_run=dry_run_mode, lookback_days=lookback)
