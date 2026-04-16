#!/usr/bin/env python3
"""
Steam → Supabase sync pipeline.

Phase A: Daily library snapshot (owned games + recent playtime)
Phase B: Compute daily gaming stats (delta vs yesterday)
Phase C: Enrich game details via Store API (genres, description)
Phase D: Achievements (weekly, Monday only or --force)

Usage:
    python pipelines/steam_sync.py              # normal daily sync
    python pipelines/steam_sync.py --dry-run    # no DB writes
    python pipelines/steam_sync.py --force      # force achievements even if not Monday
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

STEAM_API_BASE = "https://api.steampowered.com"
STORE_API_BASE = "https://store.steampowered.com/api"
DELAY_BETWEEN_REQUESTS = 0.2
STORE_DELAY = 0.3  # Store API is more strict
MAX_ENRICH_PER_RUN = 20
MAX_RETRIES = 3


def env_required(name):
    """Read a required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: Missing required environment variable: {name}")
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Steam API helpers
# ---------------------------------------------------------------------------

def steam_get(api_key, interface, method, version=1, params=None):
    """Call Steam Web API with retries."""
    url = f"{STEAM_API_BASE}/{interface}/{method}/v{version}/"
    all_params = {"key": api_key, "format": "json"}
    if params:
        all_params.update(params)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=all_params, timeout=30)
            if resp.status_code == 403:
                # 403 on GetOwnedGames = bad key. 403 on achievements = game doesn't support it
                if 'GetOwnedGames' in method or 'GetRecentlyPlayed' in method:
                    print(f"FATAL: Steam API 403 — invalid API key or private profile")
                    sys.exit(1)
                return {}  # Skip gracefully for per-game endpoints
            if resp.status_code >= 500:
                wait = 2 ** attempt
                print(f"[steam] Server error {resp.status_code}, retrying in {wait}s")
                time.sleep(wait)
                continue
            return resp.json()
        except requests.RequestException as e:
            if attempt == MAX_RETRIES:
                raise
            print(f"[steam] Request failed: {e}, retrying...")
            time.sleep(2 ** attempt)
    return {}


def store_get(appid):
    """Call Steam Store API for game details."""
    try:
        resp = requests.get(
            f"{STORE_API_BASE}/appdetails/",
            params={"appids": appid, "l": "french"},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        app_data = data.get(str(appid), {})
        if not app_data.get("success"):
            return None
        return app_data.get("data", {})
    except requests.RequestException:
        return None


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def sb_headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def sb_upsert(url, key, table, rows):
    """Upsert rows into Supabase."""
    if not rows:
        return 0
    headers = sb_headers(key)
    headers["Prefer"] = "resolution=merge-duplicates"
    total = 0
    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        resp = requests.post(f"{url}/rest/v1/{table}", headers=headers,
                             data=json.dumps(batch, default=str), timeout=30)
        if resp.status_code not in (200, 201):
            headers2 = {**headers, "Prefer": "resolution=ignore-duplicates"}
            resp = requests.post(f"{url}/rest/v1/{table}", headers=headers2,
                                 data=json.dumps(batch, default=str), timeout=30)
            if resp.status_code not in (200, 201):
                print(f"[supabase] WARNING: upsert {table} got {resp.status_code}: {resp.text[:200]}")
        total += len(batch)
    return total


def sb_get(url, key, path, params=None):
    """GET from Supabase REST API."""
    resp = requests.get(f"{url}/rest/v1/{path}", headers=sb_headers(key),
                        params=params or {}, timeout=30)
    if resp.status_code != 200:
        return []
    return resp.json()


# ---------------------------------------------------------------------------
# Phase A — Library snapshot
# ---------------------------------------------------------------------------

def sync_library(api_key, steam_id, supabase_url, service_key, dry_run):
    """Fetch owned games and recent playtime, store daily snapshot."""
    # Get all owned games
    data = steam_get(api_key, "IPlayerService", "GetOwnedGames", params={
        "steamid": steam_id,
        "include_appinfo": 1,
        "include_played_free_games": 1,
    })
    games = data.get("response", {}).get("games", [])
    print(f"[steam] Library: {len(games)} games owned")

    if not games:
        print("[steam] WARNING: No games returned — profile might be private")
        return []

    # Get recently played
    recent_data = steam_get(api_key, "IPlayerService", "GetRecentlyPlayedGames", params={
        "steamid": steam_id,
    })
    recent_games = recent_data.get("response", {}).get("games", [])
    recent_map = {g["appid"]: g.get("playtime_2weeks", 0) for g in recent_games}
    print(f"[steam] Recently played: {len(recent_games)} games")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    rows = []
    for g in games:
        appid = g["appid"]
        icon_hash = g.get("img_icon_url", "")
        icon_url = f"https://media.steampowered.com/steamcommunity/public/images/apps/{appid}/{icon_hash}.jpg" if icon_hash else None

        rows.append({
            "appid": appid,
            "name": g.get("name", f"App {appid}"),
            "playtime_forever_minutes": g.get("playtime_forever", 0),
            "playtime_2weeks_minutes": recent_map.get(appid, 0),
            "img_icon_url": icon_url,
            "snapshot_date": today,
        })

    if dry_run:
        print(f"[dry-run] Would upsert {len(rows)} game snapshots")
        top = sorted(rows, key=lambda r: r["playtime_forever_minutes"], reverse=True)[:5]
        for r in top:
            print(f"  {r['name']}: {r['playtime_forever_minutes']}m total, {r['playtime_2weeks_minutes']}m 2weeks")
        return rows

    n = sb_upsert(supabase_url, service_key, "steam_games_snapshot", rows)
    print(f"[supabase] Upserted {n} game snapshots for {today}")
    return rows


# ---------------------------------------------------------------------------
# Phase B — Daily gaming stats
# ---------------------------------------------------------------------------

def compute_daily_stats(supabase_url, service_key, dry_run):
    """Compare today's snapshot with yesterday's to compute play deltas."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    today_snap = sb_get(supabase_url, service_key, "steam_games_snapshot",
                        {"select": "appid,name,playtime_forever_minutes",
                         "snapshot_date": f"eq.{today}", "limit": "5000"})
    yest_snap = sb_get(supabase_url, service_key, "steam_games_snapshot",
                       {"select": "appid,playtime_forever_minutes",
                        "snapshot_date": f"eq.{yesterday}", "limit": "5000"})

    if not yest_snap:
        print("[stats] No yesterday snapshot — stats will be available tomorrow")
        return

    yest_map = {s["appid"]: s["playtime_forever_minutes"] for s in yest_snap}

    deltas = []
    for g in today_snap:
        prev = yest_map.get(g["appid"], g["playtime_forever_minutes"])
        delta = g["playtime_forever_minutes"] - prev
        if delta > 0:
            deltas.append({"name": g["name"], "minutes": delta})

    total_min = sum(d["minutes"] for d in deltas)
    top = max(deltas, key=lambda d: d["minutes"]) if deltas else None

    row = {
        "stat_date": today,
        "total_playtime_minutes": total_min,
        "games_played_count": len(deltas),
        "top_game_name": top["name"] if top else None,
        "top_game_minutes": top["minutes"] if top else None,
    }

    print(f"[stats] Today: {total_min}min across {len(deltas)} games" +
          (f", top: {top['name']} ({top['minutes']}min)" if top else ""))

    if dry_run:
        print(f"[dry-run] Would upsert daily stats: {row}")
        return

    sb_upsert(supabase_url, service_key, "gaming_stats_daily", [row])
    print(f"[supabase] Upserted gaming stats for {today}")


# ---------------------------------------------------------------------------
# Phase C — Game details enrichment
# ---------------------------------------------------------------------------

def enrich_game_details(supabase_url, service_key, dry_run):
    """Fetch store details for games not yet cached."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Games in today's snapshot
    snapshot = sb_get(supabase_url, service_key, "steam_games_snapshot",
                      {"select": "appid,name", "snapshot_date": f"eq.{today}",
                       "playtime_2weeks_minutes": "gt.0", "limit": "100"})

    # Already cached
    cached = sb_get(supabase_url, service_key, "steam_game_details",
                    {"select": "appid", "limit": "5000"})
    cached_ids = {r["appid"] for r in cached}

    to_enrich = [g for g in snapshot if g["appid"] not in cached_ids]
    print(f"[enrich] {len(to_enrich)} games to enrich, {len(cached_ids)} cached")

    if not to_enrich:
        return

    if dry_run:
        print(f"[dry-run] Would enrich: {[g['name'] for g in to_enrich[:MAX_ENRICH_PER_RUN]]}")
        return

    enriched = 0
    for g in to_enrich[:MAX_ENRICH_PER_RUN]:
        details = store_get(g["appid"])
        if not details:
            print(f"[enrich] Skip {g['name']} (no store data)")
            time.sleep(STORE_DELAY)
            continue

        genres = [genre["description"] for genre in details.get("genres", [])]
        categories = [cat["description"] for cat in details.get("categories", [])]
        developers = details.get("developers", [])
        publishers = details.get("publishers", [])
        release = details.get("release_date", {}).get("date", "")

        row = {
            "appid": g["appid"],
            "name": details.get("name", g["name"]),
            "genres": genres or None,
            "categories": categories or None,
            "release_date": release or None,
            "developer": developers[0] if developers else None,
            "publisher": publishers[0] if publishers else None,
            "header_image_url": details.get("header_image"),
            "short_description": details.get("short_description"),
        }
        sb_upsert(supabase_url, service_key, "steam_game_details", [row])
        enriched += 1
        time.sleep(STORE_DELAY)

    print(f"[enrich] Enriched {enriched} games, {len(to_enrich) - enriched} remaining")


# ---------------------------------------------------------------------------
# Phase D — Achievements
# ---------------------------------------------------------------------------

def sync_achievements(api_key, steam_id, supabase_url, service_key, dry_run):
    """Fetch achievements for recently played games."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Recently played games
    snapshot = sb_get(supabase_url, service_key, "steam_games_snapshot",
                      {"select": "appid,name", "snapshot_date": f"eq.{today}",
                       "playtime_2weeks_minutes": "gt.0", "limit": "50"})

    if not snapshot:
        print("[achievements] No recently played games")
        return

    total_new = 0
    for g in snapshot:
        appid = g["appid"]
        data = steam_get(api_key, "ISteamUserStats", "GetPlayerAchievements", params={
            "steamid": steam_id,
            "appid": appid,
        })

        player_stats = data.get("playerstats", {})
        if not player_stats.get("success"):
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue

        achievements = player_stats.get("achievements", [])
        unlocked = [a for a in achievements if a.get("achieved") == 1 and a.get("unlocktime", 0) > 0]

        # Get schema for display names (optional)
        schema_map = {}
        schema_data = steam_get(api_key, "ISteamUserStats", "GetSchemaForGame", version=2, params={
            "appid": appid,
        })
        for ach in schema_data.get("game", {}).get("availableGameStats", {}).get("achievements", []):
            schema_map[ach["name"]] = {
                "displayName": ach.get("displayName", ""),
                "description": ach.get("description", ""),
            }

        rows = []
        for a in unlocked:
            api_name = a.get("apiname", "")
            schema = schema_map.get(api_name, {})
            rows.append({
                "appid": appid,
                "achievement_api_name": api_name,
                "achievement_name": schema.get("displayName") or None,
                "achievement_description": schema.get("description") or None,
                "unlocked_at": datetime.fromtimestamp(a["unlocktime"], tz=timezone.utc).isoformat(),
            })

        if rows:
            if dry_run:
                print(f"[dry-run] {g['name']}: {len(rows)} achievements")
            else:
                sb_upsert(supabase_url, service_key, "steam_achievements", rows)
                total_new += len(rows)

        time.sleep(DELAY_BETWEEN_REQUESTS)

    if not dry_run:
        print(f"[achievements] Synced achievements for {len(snapshot)} games ({total_new} total)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def sync(dry_run=False, force=False):
    """Run the full Steam → Supabase sync."""
    print("=" * 60)
    print(f"  Steam Sync — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  Mode: {'DRY-RUN' if dry_run else 'LIVE'}")
    print("=" * 60)

    api_key = env_required("STEAM_API_KEY")
    steam_id = env_required("STEAM_ID")
    supabase_url = env_required("SUPABASE_URL")
    service_key = env_required("SUPABASE_SERVICE_KEY")

    # Phase A: Library snapshot
    games = sync_library(api_key, steam_id, supabase_url, service_key, dry_run)

    # Phase B: Daily stats
    if not dry_run and games:
        compute_daily_stats(supabase_url, service_key, dry_run)

    # Phase C: Enrich game details
    if not dry_run:
        enrich_game_details(supabase_url, service_key, dry_run)

    # Phase D: Achievements (Monday or --force)
    now = datetime.now(timezone.utc)
    if force or now.weekday() == 0:
        sync_achievements(api_key, steam_id, supabase_url, service_key, dry_run)
    else:
        print(f"[achievements] Skipping (not Monday, use --force to override)")

    print()
    print("=" * 60)
    print(f"  DONE — {len(games)} games in library")
    print("=" * 60)


if __name__ == "__main__":
    dry_run_mode = "--dry-run" in sys.argv
    force_mode = "--force" in sys.argv
    sync(dry_run=dry_run_mode, force=force_mode)
