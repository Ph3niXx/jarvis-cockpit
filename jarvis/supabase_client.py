"""Jarvis — Supabase REST API client.

Uses publishable key for reads, service_role key for writes.
Service_role bypasses RLS — required after the 005_rls_lockdown migration.
"""

import requests

from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

_READ_KEY = SUPABASE_KEY
_WRITE_KEY = SUPABASE_SERVICE_KEY or SUPABASE_KEY  # fallback to anon if no service key


def _headers(write: bool = False) -> dict:
    key = _WRITE_KEY if write else _READ_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def sb_get(table: str, params: str = "") -> list:
    """GET rows from a Supabase table (uses anon key)."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        url += f"?{params}"
    r = requests.get(url, headers=_headers(), timeout=10)
    return r.json() if r.status_code == 200 else []


def sb_post(table: str, data, upsert: bool = False) -> bool:
    """POST (insert) rows into a Supabase table (uses service_role key)."""
    headers = {**_headers(write=True)}
    if upsert:
        headers["Prefer"] = "resolution=merge-duplicates"
    else:
        headers["Prefer"] = "resolution=ignore-duplicates"
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, json=data, timeout=10)
    if r.status_code not in (200, 201):
        print(f"  [ERROR] sb_post {table} ({r.status_code}): {r.text[:200]}")
    return r.status_code in (200, 201)


def sb_rpc(function_name: str, params: dict) -> list:
    """Call a Supabase RPC function (e.g. match_memories)."""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{function_name}",
        headers=_headers(write=True),
        json=params,
        timeout=10,
    )
    if r.status_code == 200:
        return r.json()
    print(f"  [ERROR] sb_rpc {function_name} ({r.status_code}): {r.text[:200]}")
    return []
