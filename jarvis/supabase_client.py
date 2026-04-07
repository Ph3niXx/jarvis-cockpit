"""Jarvis — Supabase REST API client.

Follows the same pattern as weekly_analysis.py sb_get/sb_post helpers.
"""

import requests

from config import SUPABASE_URL, SUPABASE_KEY

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def sb_get(table: str, params: str = "") -> list:
    """GET rows from a Supabase table."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        url += f"?{params}"
    r = requests.get(url, headers=HEADERS)
    return r.json() if r.status_code == 200 else []


def sb_post(table: str, data, upsert: bool = False) -> bool:
    """POST (insert) rows into a Supabase table."""
    headers = {**HEADERS}
    if upsert:
        headers["Prefer"] = "resolution=merge-duplicates"
    else:
        headers["Prefer"] = "resolution=ignore-duplicates"
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, json=data)
    if r.status_code not in (200, 201):
        print(f"  [ERROR] sb_post {table} ({r.status_code}): {r.text[:200]}")
    return r.status_code in (200, 201)


def sb_rpc(function_name: str, params: dict) -> list:
    """Call a Supabase RPC function (e.g. match_memories)."""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{function_name}",
        headers=HEADERS,
        json=params,
    )
    if r.status_code == 200:
        return r.json()
    print(f"  [ERROR] sb_rpc {function_name} ({r.status_code}): {r.text[:200]}")
    return []
