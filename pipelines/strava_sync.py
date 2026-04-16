#!/usr/bin/env python3
"""
Strava → Supabase sync pipeline.

Fetches recent activities from Strava API, stores raw payloads in
strava_activities_raw, and maps structured fields into strava_activities.

Runs daily via GitHub Actions. Idempotent: upserts on activity id.

Usage:
    python pipelines/strava_sync.py              # normal sync
    python pipelines/strava_sync.py --dry-run    # fetch only, no DB writes
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

STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_API_BASE = "https://www.strava.com/api/v3"

# How many days back to fetch (avoids full re-fetch every run)
LOOKBACK_DAYS = 7

# Strava rate limits: 100 req/15min, 1000/day
DELAY_BETWEEN_DETAIL_CALLS = 1.0  # seconds


def env_required(name):
    """Read a required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: Missing required environment variable: {name}")
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Strava API helpers
# ---------------------------------------------------------------------------

def refresh_access_token(client_id, client_secret, refresh_token):
    """Exchange refresh_token for a fresh access_token."""
    resp = requests.post(STRAVA_TOKEN_URL, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        raise ValueError(f"No access_token in refresh response: {data}")
    print(f"[strava] Access token refreshed (expires {data.get('expires_at', '?')})")
    return access_token


def fetch_activity_list(access_token, after_ts):
    """Fetch list of recent activities (lightweight, no detailed fields)."""
    activities = []
    page = 1
    while True:
        resp = requests.get(
            f"{STRAVA_API_BASE}/athlete/activities",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"after": int(after_ts), "per_page": 30, "page": page},
            timeout=30,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        activities.extend(batch)
        if len(batch) < 30:
            break
        page += 1
        time.sleep(DELAY_BETWEEN_DETAIL_CALLS)
    return activities


def fetch_activity_detail(access_token, activity_id):
    """Fetch full activity details by id."""
    resp = requests.get(
        f"{STRAVA_API_BASE}/activities/{activity_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def supabase_upsert(url, service_key, table, rows):
    """Upsert rows into a Supabase table via REST API (on conflict: id)."""
    if not rows:
        return
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    resp = requests.post(
        f"{url}/rest/v1/{table}",
        headers=headers,
        data=json.dumps(rows, default=str),
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Supabase upsert to {table} failed ({resp.status_code}): {resp.text}"
        )


# ---------------------------------------------------------------------------
# Transform activity detail → strava_activities row
# ---------------------------------------------------------------------------

def map_activity(detail):
    """Extract structured fields from a Strava activity detail payload."""
    map_data = detail.get("map") or {}
    return {
        "id": detail["id"],
        "athlete_id": detail.get("athlete", {}).get("id"),
        "name": detail.get("name"),
        "sport_type": detail.get("sport_type"),
        "start_date": detail.get("start_date"),
        "distance_m": detail.get("distance"),
        "moving_time_s": detail.get("moving_time"),
        "elapsed_time_s": detail.get("elapsed_time"),
        "total_elevation_gain": detail.get("total_elevation_gain"),
        "average_speed": detail.get("average_speed"),
        "max_speed": detail.get("max_speed"),
        "average_heartrate": detail.get("average_heartrate"),
        "max_heartrate": detail.get("max_heartrate"),
        "average_watts": detail.get("average_watts"),
        "kilojoules": detail.get("kilojoules"),
        "suffer_score": detail.get("suffer_score"),
        "calories": detail.get("calories"),
        "map_summary_polyline": map_data.get("summary_polyline"),
        "gear_id": detail.get("gear_id"),
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Main sync logic
# ---------------------------------------------------------------------------

def sync(dry_run=False):
    """Run the full Strava → Supabase sync."""
    print("=" * 60)
    print(f"  Strava Sync — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  Mode: {'DRY-RUN (no DB writes)' if dry_run else 'LIVE'}")
    print("=" * 60)

    # Read config
    client_id = env_required("STRAVA_CLIENT_ID")
    client_secret = env_required("STRAVA_CLIENT_SECRET")
    refresh_token = env_required("STRAVA_REFRESH_TOKEN")
    supabase_url = env_required("SUPABASE_URL")
    service_key = env_required("SUPABASE_SERVICE_KEY")

    # Step 1: Refresh access token
    access_token = refresh_access_token(client_id, client_secret, refresh_token)

    # Step 2: Fetch recent activity list
    after_ts = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).timestamp()
    print(f"[strava] Fetching activities from last {LOOKBACK_DAYS} days...")
    activity_list = fetch_activity_list(access_token, after_ts)
    print(f"[strava] Found {len(activity_list)} activities in list")

    if not activity_list:
        print("[strava] No new activities. Done.")
        return

    # Step 3: Fetch details for each activity
    raw_rows = []
    mapped_rows = []
    errors = 0

    for i, summary in enumerate(activity_list, 1):
        activity_id = summary["id"]
        activity_name = summary.get("name", "?")
        print(f"[strava] ({i}/{len(activity_list)}) Fetching detail for #{activity_id}: {activity_name}")

        try:
            detail = fetch_activity_detail(access_token, activity_id)
        except requests.HTTPError as e:
            print(f"[strava] WARNING: Failed to fetch #{activity_id}: {e}")
            errors += 1
            continue

        raw_rows.append({
            "id": activity_id,
            "athlete_id": detail.get("athlete", {}).get("id"),
            "payload": detail,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        })
        mapped_rows.append(map_activity(detail))

        if i < len(activity_list):
            time.sleep(DELAY_BETWEEN_DETAIL_CALLS)

    # Step 4: Upsert to Supabase
    if dry_run:
        print(f"\n[dry-run] Would upsert {len(raw_rows)} rows into strava_activities_raw")
        print(f"[dry-run] Would upsert {len(mapped_rows)} rows into strava_activities")
        for row in mapped_rows:
            print(f"  - {row['start_date'][:10]} | {row['sport_type']:12s} | {row['name']}")
    else:
        print(f"\n[supabase] Upserting {len(raw_rows)} rows into strava_activities_raw...")
        supabase_upsert(supabase_url, service_key, "strava_activities_raw", raw_rows)

        print(f"[supabase] Upserting {len(mapped_rows)} rows into strava_activities...")
        supabase_upsert(supabase_url, service_key, "strava_activities", mapped_rows)

    # Summary
    print()
    print("=" * 60)
    print(f"  DONE — {len(mapped_rows)} synced, {errors} errors")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    dry_run_mode = "--dry-run" in sys.argv
    sync(dry_run=dry_run_mode)
