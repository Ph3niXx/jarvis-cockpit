"""Jarvis — Supabase REST API client.

Uses service_role key for all operations (bypasses RLS).
Required after 006_rls_authenticated migration — anon can no longer read.
"""

from urllib.parse import quote

import requests

from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

_KEY = SUPABASE_SERVICE_KEY or SUPABASE_KEY  # service_role preferred, anon fallback


def _headers() -> dict:
    return {
        "apikey": _KEY,
        "Authorization": f"Bearer {_KEY}",
        "Content-Type": "application/json",
    }


def sb_get(table: str, params: str = "") -> list:
    """GET rows from a Supabase table."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if params:
        url += f"?{params}"
    r = requests.get(url, headers=_headers(), timeout=10)
    return r.json() if r.status_code == 200 else []


def sb_post(table: str, data, upsert: bool = False, on_conflict: str | None = None) -> bool:
    """POST (insert) rows into a Supabase table.

    on_conflict: comma-separated UNIQUE columns (e.g. "source_table,source_id,chunk_index").
    Required by PostgREST for `Prefer: resolution=merge-duplicates` to work as an upsert
    against a UNIQUE constraint — sans ce param, PostgREST tente un INSERT brut et lève 409.
    """
    headers = {**_headers()}
    if upsert:
        headers["Prefer"] = "resolution=merge-duplicates"
    else:
        headers["Prefer"] = "resolution=ignore-duplicates"
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={quote(on_conflict, safe=',')}"
    r = requests.post(url, headers=headers, json=data, timeout=10)
    if r.status_code not in (200, 201):
        print(f"  [ERROR] sb_post {table} ({r.status_code}): {r.text[:200]}")
    return r.status_code in (200, 201)


def sb_patch(table: str, filter_params: str, data: dict) -> bool:
    """PATCH (update) rows in a Supabase table matching filter."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filter_params}"
    r = requests.patch(url, headers=_headers(), json=data, timeout=10)
    if r.status_code not in (200, 204):
        print(f"  [ERROR] sb_patch {table} ({r.status_code}): {r.text[:200]}")
    return r.status_code in (200, 204)


def sb_rpc(function_name: str, params: dict) -> list:
    """Call a Supabase RPC function (e.g. match_memories)."""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{function_name}",
        headers=_headers(),
        json=params,
        timeout=10,
    )
    if r.status_code == 200:
        return r.json()
    print(f"  [ERROR] sb_rpc {function_name} ({r.status_code}): {r.text[:200]}")
    return []
