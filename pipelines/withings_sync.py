#!/usr/bin/env python3
"""
Withings -> Supabase sync pipeline.

Fetches recent measurements from Withings API, stores raw payloads in
withings_measurements_raw, and upserts one row per day (latest measurement
of the day wins) into withings_measurements.

Runs daily via GitHub Actions. Idempotent.

Measure types synced:
    1  = Weight (kg)
    6  = Fat Ratio (%)
    8  = Fat Mass Weight (kg)
    76 = Muscle Mass (kg)
    77 = Hydration (kg)
    88 = Bone Mass (kg)

Usage:
    python pipelines/withings_sync.py              # incremental (7 days)
    python pipelines/withings_sync.py --backfill   # full history
    python pipelines/withings_sync.py --dry-run    # no DB writes

Withings API docs: https://developer.withings.com/api-reference/
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

WITHINGS_TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2"
WITHINGS_MEASURE_URL = "https://wbsapi.withings.net/measure"

# Default incremental window. Withings rarely produces back-dated data, so
# 7 days gives a safety margin against sync gaps.
INCREMENTAL_DAYS = 7

MEASURE_TYPES = "1,6,8,76,77,88"

# Map Withings type codes to our column names.
TYPE_TO_COLUMN = {
    1: "weight_kg",
    6: "fat_pct",
    8: "fat_mass_kg",
    76: "muscle_mass_kg",
    77: "hydration_kg",
    88: "bone_mass_kg",
}


def env_required(name):
    value = os.environ.get(name)
    if not value:
        print(f"FATAL: Missing required environment variable: {name}")
        sys.exit(1)
    return value


# ---------------------------------------------------------------------------
# Withings API helpers
# ---------------------------------------------------------------------------

def refresh_access_token(client_id, client_secret, refresh_token):
    """Exchange refresh_token for a fresh access_token.

    Returns (access_token, new_refresh_token, user_id). Withings rotates
    refresh tokens on each call — the caller cannot persist this change
    back to GitHub Secrets automatically, but the token stays valid while
    the previous one is still usable (grace period).
    """
    resp = requests.post(WITHINGS_TOKEN_URL, data={
        "action": "requesttoken",
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }, timeout=30)
    resp.raise_for_status()
    result = resp.json()
    status = result.get("status", -1)
    if status != 0:
        raise RuntimeError(
            f"Withings token refresh failed (status={status}): {json.dumps(result)}"
        )
    body = result.get("body", {})
    access_token = body.get("access_token")
    new_refresh_token = body.get("refresh_token", refresh_token)
    user_id = body.get("userid")
    if not access_token:
        raise ValueError(f"No access_token in response: {body}")
    rotated = new_refresh_token != refresh_token
    print(f"[withings] Access token refreshed (user_id={user_id}, rotated={rotated})")
    return access_token, new_refresh_token, user_id


def fetch_measurements(access_token, startdate=None, enddate=None, lastupdate=None):
    """Fetch measurement groups. Either (startdate,enddate) OR lastupdate."""
    params = {
        "action": "getmeas",
        "meastypes": MEASURE_TYPES,
    }
    if lastupdate is not None:
        params["lastupdate"] = lastupdate
    else:
        params["startdate"] = startdate
        params["enddate"] = enddate

    resp = requests.post(
        WITHINGS_MEASURE_URL,
        data=params,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    resp.raise_for_status()
    result = resp.json()
    status = result.get("status", -1)
    if status == 401:
        raise RuntimeError(
            "Withings 401 Unauthorized. The refresh_token may have been revoked. "
            "Re-run: python scripts/withings_oauth_init.py"
        )
    if status != 0:
        raise RuntimeError(
            f"Withings getmeas failed (status={status}): {json.dumps(result)}"
        )
    return result.get("body", {})


# ---------------------------------------------------------------------------
# Data transformation
# ---------------------------------------------------------------------------

def scaled_value(measure):
    """Withings stores values as value * 10^unit. Decode to a float."""
    value = measure.get("value")
    unit = measure.get("unit", 0)
    if value is None:
        return None
    return round(value * (10 ** unit), 3)


def group_to_daily_row(group):
    """Convert one measuregrp to a dict keyed by column name."""
    date_ts = group.get("date")
    if not date_ts:
        return None
    measured_at = datetime.fromtimestamp(date_ts, tz=timezone.utc)
    measure_date = measured_at.date()

    row = {
        "measure_date": measure_date.isoformat(),
        "measured_at": measured_at.isoformat(),
    }
    for m in group.get("measures", []):
        t = m.get("type")
        col = TYPE_TO_COLUMN.get(t)
        if not col:
            continue
        v = scaled_value(m)
        if v is not None:
            row[col] = v
    return row


def merge_daily_rows(rows):
    """Collapse multiple rows per day into one. Last measurement of the
    day wins per column (not an average — cockpit wants the current state).

    rows: list of dicts with measure_date + measured_at + column values
    Returns: dict keyed by measure_date -> merged row.
    """
    by_date = {}
    for r in rows:
        date = r["measure_date"]
        existing = by_date.get(date)
        if not existing:
            by_date[date] = dict(r)
            continue
        # Keep the row with the latest measured_at as the base
        if r["measured_at"] > existing["measured_at"]:
            # Swap: new row becomes base, existing fills gaps
            merged = dict(r)
            for k, v in existing.items():
                if k not in merged or merged[k] is None:
                    merged[k] = v
            by_date[date] = merged
        else:
            # existing is newer — fill gaps from r
            for k, v in r.items():
                if existing.get(k) is None and v is not None:
                    existing[k] = v
    return by_date


# ---------------------------------------------------------------------------
# Supabase writes
# ---------------------------------------------------------------------------

def supabase_upsert(url, key, table, rows, on_conflict):
    if not rows:
        return 0
    endpoint = f"{url}/rest/v1/{table}?on_conflict={on_conflict}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = requests.post(endpoint, headers=headers, json=rows, timeout=60)
    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(f"Supabase upsert {table} failed: {resp.status_code} {resp.text}")
    return len(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Sync Withings measurements to Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="Fetch only, no DB writes.")
    parser.add_argument("--backfill", action="store_true", help="Fetch full history (no lastupdate filter).")
    args = parser.parse_args()

    client_id = env_required("WITHINGS_CLIENT_ID")
    client_secret = env_required("WITHINGS_CLIENT_SECRET")
    refresh_token = env_required("WITHINGS_REFRESH_TOKEN")
    supabase_url = env_required("SUPABASE_URL")
    supabase_key = env_required("SUPABASE_SERVICE_KEY")

    access_token, _new_refresh, user_id = refresh_access_token(
        client_id, client_secret, refresh_token
    )

    if args.backfill:
        # Full history — use startdate=0 to fetch everything.
        print("[withings] Backfill mode — fetching full history.")
        startdate = 0
        enddate = int(datetime.now(tz=timezone.utc).timestamp())
        body = fetch_measurements(access_token, startdate=startdate, enddate=enddate)
    else:
        # Incremental — last N days, using lastupdate for efficiency.
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=INCREMENTAL_DAYS)
        lastupdate = int(cutoff.timestamp())
        print(f"[withings] Incremental sync since {cutoff.isoformat()}")
        body = fetch_measurements(access_token, lastupdate=lastupdate)

    groups = body.get("measuregrps", [])
    print(f"[withings] Fetched {len(groups)} measurement groups.")

    # Build daily rows
    daily_rows = []
    raw_rows = []
    for g in groups:
        row = group_to_daily_row(g)
        if not row:
            continue
        daily_rows.append(row)
        grp_id = g.get("grpid")
        if grp_id is not None:
            raw_rows.append({
                "measure_group_id": grp_id,
                "user_id": str(user_id),
                "measured_at": row["measured_at"],
                "payload": g,
            })

    merged = merge_daily_rows(daily_rows)
    upserts = list(merged.values())
    upserts.sort(key=lambda r: r["measure_date"])

    print(f"[withings] Merged into {len(upserts)} daily rows.")
    if upserts:
        latest = upserts[-1]
        print(f"[withings] Latest day: {latest['measure_date']} "
              f"weight={latest.get('weight_kg')} fat%={latest.get('fat_pct')} "
              f"muscle={latest.get('muscle_mass_kg')}")

    if args.dry_run:
        print("[withings] Dry run — skipping Supabase writes.")
        return

    n_raw = supabase_upsert(
        supabase_url, supabase_key,
        "withings_measurements_raw", raw_rows, "measure_group_id",
    )
    n_day = supabase_upsert(
        supabase_url, supabase_key,
        "withings_measurements", upserts, "measure_date",
    )
    print(f"[withings] Upserted {n_raw} raw groups, {n_day} daily rows.")


if __name__ == "__main__":
    main()
