#!/usr/bin/env python3
"""
Last.fm enrichment pipeline — genres + AI weekly insight.

Phase A: Fetch artist tags from Last.fm, cache in music_artist_tags
Phase B: Compute weekly genre breakdown → music_genre_weekly
Phase C: Generate AI weekly recap via Gemini → music_insights_weekly

Runs Monday only (or --force). Called after lastfm_sync.py.

Usage:
    python pipelines/lastfm_enrich.py           # normal (Monday check)
    python pipelines/lastfm_enrich.py --force    # force run any day
    python pipelines/lastfm_enrich.py --dry-run  # no DB writes
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
DELAY_BETWEEN_REQUESTS = 0.2
MAX_RETRIES = 3
TAG_CACHE_DAYS = 90  # re-fetch tags older than this


def env_required(name):
    """Read a required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: Missing required environment variable: {name}")
        sys.exit(1)
    return value


def env_optional(name):
    """Read an optional environment variable."""
    return os.environ.get(name, "")


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def sb_headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def sb_get(url, key, path, params=None):
    """GET from Supabase REST API."""
    resp = requests.get(f"{url}/rest/v1/{path}", headers=sb_headers(key), params=params or {}, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Supabase GET {path} failed ({resp.status_code}): {resp.text[:200]}")
    return resp.json()


def sb_upsert(url, key, table, rows):
    """Upsert rows into Supabase."""
    if not rows:
        return
    headers = sb_headers(key)
    headers["Prefer"] = "resolution=merge-duplicates"
    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        resp = requests.post(f"{url}/rest/v1/{table}", headers=headers,
                             data=json.dumps(batch, default=str), timeout=30)
        if resp.status_code not in (200, 201):
            # Try ignore-duplicates on conflict
            headers2 = {**headers, "Prefer": "resolution=ignore-duplicates"}
            resp = requests.post(f"{url}/rest/v1/{table}", headers=headers2,
                                 data=json.dumps(batch, default=str), timeout=30)
            if resp.status_code not in (200, 201):
                print(f"[supabase] WARNING: upsert {table} got {resp.status_code}: {resp.text[:200]}")


# ---------------------------------------------------------------------------
# Last.fm API
# ---------------------------------------------------------------------------

def lastfm_get(api_key, method, params=None):
    """Call Last.fm API with retries."""
    base_params = {"method": method, "api_key": api_key, "format": "json"}
    if params:
        base_params.update(params)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(LASTFM_API_BASE, params=base_params, timeout=30)
            if resp.status_code == 429 or resp.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            data = resp.json()
            if "error" in data:
                return None  # Artist not found, etc. — skip gracefully
            return data
        except requests.RequestException:
            if attempt == MAX_RETRIES:
                return None
            time.sleep(2 ** attempt)
    return None


# ---------------------------------------------------------------------------
# Phase A — Artist tags
# ---------------------------------------------------------------------------

def enrich_artist_tags(api_key, supabase_url, service_key, dry_run):
    """Fetch tags for recent artists not yet cached."""
    # Get distinct artists from last 7 days
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    scrobbles = sb_get(supabase_url, service_key, "music_scrobbles",
                       {"select": "artist_name", "scrobbled_at": f"gte.{cutoff}", "limit": "1000"})
    recent_artists = list(set(s["artist_name"] for s in scrobbles))
    print(f"[tags] {len(recent_artists)} distinct artists in last 7 days")

    if not recent_artists:
        return

    # Get existing cache
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(days=TAG_CACHE_DAYS)).isoformat()
    cached = sb_get(supabase_url, service_key, "music_artist_tags",
                    {"select": "artist_name,fetched_at", "limit": "5000"})
    cached_map = {r["artist_name"]: r["fetched_at"] for r in cached}

    # Filter: need fetch if missing or stale
    to_fetch = [a for a in recent_artists
                if a not in cached_map or cached_map[a] < stale_cutoff]

    print(f"[tags] {len(to_fetch)} to fetch, {len(recent_artists) - len(to_fetch)} cached")

    if dry_run:
        print(f"[dry-run] Would fetch tags for: {to_fetch[:10]}...")
        return

    enriched = 0
    for artist in to_fetch:
        data = lastfm_get(api_key, "artist.getTopTags", {"artist": artist})
        if not data:
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue

        tags_data = data.get("toptags", {}).get("tag", [])
        if isinstance(tags_data, dict):
            tags_data = [tags_data]

        tags = [t.get("name", "").lower() for t in tags_data[:5] if t.get("name")]
        top_tag = tags[0] if tags else None

        if tags:
            sb_upsert(supabase_url, service_key, "music_artist_tags", [{
                "artist_name": artist,
                "tags": tags,
                "top_tag": top_tag,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }])
            enriched += 1

        time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"[tags] Enriched {enriched} artists")


# ---------------------------------------------------------------------------
# Phase B — Weekly genre breakdown
# ---------------------------------------------------------------------------

def compute_genre_weekly(supabase_url, service_key, dry_run):
    """Join scrobbles with artist tags to build genre breakdown."""
    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    week_start = monday.strftime("%Y-%m-%d")

    # Get this week's scrobbles
    scrobbles = sb_get(supabase_url, service_key, "music_scrobbles",
                       {"select": "artist_name", "scrobbled_at": f"gte.{week_start}T00:00:00Z", "limit": "5000"})
    if not scrobbles:
        print("[genres] No scrobbles this week")
        return

    # Get all cached tags
    tags = sb_get(supabase_url, service_key, "music_artist_tags",
                  {"select": "artist_name,top_tag", "limit": "5000"})
    tag_map = {t["artist_name"]: t["top_tag"] for t in tags if t.get("top_tag")}

    # Count genres
    genre_counts = Counter()
    matched = 0
    for s in scrobbles:
        genre = tag_map.get(s["artist_name"])
        if genre:
            genre_counts[genre] += 1
            matched += 1

    total = sum(genre_counts.values()) or 1
    print(f"[genres] {matched}/{len(scrobbles)} scrobbles matched to genres, {len(genre_counts)} distinct genres")

    # Top 10 genres
    rows = []
    for rank, (genre, count) in enumerate(genre_counts.most_common(10), 1):
        rows.append({
            "week_start": week_start,
            "genre": genre,
            "scrobble_count": count,
            "percentage": round(count / total * 100, 2),
            "rank": rank,
        })

    if dry_run:
        print(f"[dry-run] Would upsert {len(rows)} genre rows:")
        for r in rows[:5]:
            print(f"  #{r['rank']} {r['genre']}: {r['percentage']}%")
        return rows

    sb_upsert(supabase_url, service_key, "music_genre_weekly", rows)
    print(f"[supabase] Upserted {len(rows)} genre breakdowns")
    return rows


# ---------------------------------------------------------------------------
# Phase C — AI weekly insight
# ---------------------------------------------------------------------------

def generate_weekly_insight(supabase_url, service_key, genre_rows, dry_run):
    """Generate a musical weekly recap via Gemini."""
    gemini_key = env_optional("GEMINI_API_KEY")
    if not gemini_key:
        print("[insight] GEMINI_API_KEY not set, skipping AI insight")
        return

    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    week_start = monday.strftime("%Y-%m-%d")

    # Check if insight already exists for this week
    existing = sb_get(supabase_url, service_key, "music_insights_weekly",
                      {"select": "week_start", "week_start": f"eq.{week_start}"})
    if existing:
        print(f"[insight] Insight already exists for {week_start}, skipping")
        return

    # Gather stats
    stats = sb_get(supabase_url, service_key, "music_stats_daily",
                   {"select": "scrobble_count,unique_artists,new_artists_count,listening_minutes,top_artist,top_artist_count",
                    "stat_date": f"gte.{week_start}", "order": "stat_date.asc", "limit": "7"})

    if not stats:
        print("[insight] No stats this week, skipping insight")
        return

    total_scrobbles = sum(s["scrobble_count"] for s in stats)
    total_minutes = sum(s["listening_minutes"] or 0 for s in stats)
    total_new = sum(s["new_artists_count"] or 0 for s in stats)
    total_unique = sum(s["unique_artists"] or 0 for s in stats)
    discovery_ratio = round(total_new / max(total_unique, 1) * 100, 1)

    # Top artists this week
    artist_counts = Counter()
    for s in stats:
        if s.get("top_artist"):
            artist_counts[s["top_artist"]] += s.get("top_artist_count", 0)
    top5 = artist_counts.most_common(5)

    # Genre info
    genre_info = ""
    if genre_rows:
        genre_info = "Top genres : " + ", ".join(f"{r['genre']} ({r['percentage']}%)" for r in genre_rows[:5])

    # Streak
    all_stats = sb_get(supabase_url, service_key, "music_stats_daily",
                       {"select": "stat_date,scrobble_count", "order": "stat_date.desc", "limit": "60"})
    streak = 0
    for s in all_stats:
        if s["scrobble_count"] > 0:
            streak += 1
        else:
            break

    prompt = f"""Tu es un critique musical et coach de vie. Voici mes stats d'écoute de la semaine :

- Total : {total_scrobbles} écoutes ({total_minutes // 60}h{total_minutes % 60:02d} estimées)
- Top artistes : {', '.join(f'{a} ({c} plays)' for a, c in top5)}
- {genre_info}
- Découverte : {discovery_ratio}% d'artistes nouveaux ({total_new} sur {total_unique})
- Streak : {streak} jours consécutifs d'écoute

Génère un récap en 3-4 phrases en français :
- Ce que mes écoutes disent de mon mood cette semaine
- Un truc intéressant ou surprenant dans les données
- Une suggestion (nouveau genre, artiste similaire, ou habitude à changer)

Réponds uniquement avec le récap, pas de préambule."""

    if dry_run:
        print(f"[dry-run] Would send to Gemini:\n{prompt[:200]}...")
        return

    # Call Gemini 2.5 Flash-Lite
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={gemini_key}",
            headers={"Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"[insight] Gemini error {resp.status_code}: {resp.text[:200]}")
            return

        data = resp.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not text:
            print("[insight] Gemini returned empty response")
            return

        # Extract mood keywords from response (simple heuristic)
        mood_words = ["énergique", "introspectif", "mélancolique", "festif", "calme",
                      "nostalgique", "intense", "relaxant", "motivant", "sombre"]
        found_moods = [w for w in mood_words if w.lower() in text.lower()]

        row = {
            "week_start": week_start,
            "summary": text.strip(),
            "top_genre": genre_rows[0]["genre"] if genre_rows else None,
            "discovery_ratio": discovery_ratio,
            "mood_keywords": found_moods or None,
            "generated_by": "gemini-2.5-flash-lite",
        }
        sb_upsert(supabase_url, service_key, "music_insights_weekly", [row])
        print(f"[insight] Generated and stored weekly insight ({len(text)} chars)")

    except requests.RequestException as e:
        print(f"[insight] Gemini request failed: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    dry_run = "--dry-run" in sys.argv
    force = "--force" in sys.argv

    now = datetime.now(timezone.utc)
    is_monday = now.weekday() == 0

    if not is_monday and not force:
        print(f"[enrich] Today is {now.strftime('%A')}, enrichment runs on Monday only. Use --force to override.")
        return

    print("=" * 60)
    print(f"  Last.fm Enrichment — {now.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  Mode: {'DRY-RUN' if dry_run else 'LIVE'}")
    print("=" * 60)

    api_key = env_required("LASTFM_API_KEY")
    supabase_url = env_required("SUPABASE_URL")
    service_key = env_required("SUPABASE_SERVICE_KEY")

    # Phase A: Artist tags
    enrich_artist_tags(api_key, supabase_url, service_key, dry_run)

    # Phase B: Genre breakdown
    genre_rows = compute_genre_weekly(supabase_url, service_key, dry_run)

    # Phase C: AI insight
    generate_weekly_insight(supabase_url, service_key, genre_rows or [], dry_run)

    print("\n" + "=" * 60)
    print("  DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()
