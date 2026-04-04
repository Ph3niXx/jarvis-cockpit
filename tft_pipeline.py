"""
TFT Tracker — Match Ingestion Pipeline
=======================================
Récupère les derniers matchs TFT via l'API Riot,
parse les données et les insère dans Supabase.

Idempotent : peut être relancé sans créer de doublons.
"""

import os
import re
import json
import time
import requests
from datetime import datetime, timezone

# ─── CONFIG ───────────────────────────────────────────────────────────────────

RIOT_API_KEY = os.environ["RIOT_API_KEY"]
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mrmgptqpflzyavdfqwwv.supabase.co")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
RIOT_PUUID = os.environ.get(
    "RIOT_PUUID",
    "wpY3IserPrpkQmhvpeyE3ppL9lren9fPnJCM7JNr--RKSMomL9lrGTsKz4pkiiRBxlH64vhFHSoUvQ",
)
USER_ID = os.environ["USER_ID"]

RIOT_MATCH_REGION = "europe"
RIOT_PLATFORM = "euw1"
MATCH_COUNT = 20
RATE_LIMIT_DELAY = 1.5  # secondes entre chaque appel match detail

RIOT_HEADERS = {"X-Riot-Token": RIOT_API_KEY}

SUPABASE_HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

# Mapping rarity → coût en gold
RARITY_TO_COST = {0: 1, 1: 2, 2: 3, 4: 4, 6: 5, 7: 5, 9: 5}

# Regex pour stripper les préfixes TFT
RE_TFT_PREFIX = re.compile(r"^TFT\d+_")
RE_ITEM_PREFIX = re.compile(r"^TFT\d*_?Item_")


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def clean_name(raw_id):
    """Strip le préfixe TFT{N}_ d'un character_id ou trait_name."""
    return RE_TFT_PREFIX.sub("", raw_id)


def clean_item(raw_item):
    """Strip le préfixe TFT_Item_ ou TFT16_Item_ d'un nom d'item."""
    return RE_ITEM_PREFIX.sub("", raw_item)


def riot_get(url):
    """GET sur l'API Riot avec gestion du rate limit (429)."""
    r = requests.get(url, headers=RIOT_HEADERS)
    if r.status_code == 429:
        retry_after = int(r.headers.get("Retry-After", 10))
        print(f"   ⏳ Rate limited, attente {retry_after}s...")
        time.sleep(retry_after)
        r = requests.get(url, headers=RIOT_HEADERS)
    if r.status_code != 200:
        raise Exception(f"Riot API {r.status_code}: {r.text[:200]}")
    return r.json()


def sb_post(table, data):
    """INSERT dans Supabase avec ON CONFLICT DO NOTHING (via upsert headers)."""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=SUPABASE_HEADERS,
        json=data,
    )
    if r.status_code not in (200, 201):
        # 409 = duplicate → attendu et OK (idempotence)
        if r.status_code == 409:
            return False
        print(f"   [ERROR] sb_post {table} ({r.status_code}): {r.text[:200]}")
        return False
    return True


def sb_get(table, params=""):
    """GET depuis Supabase."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}?{params}",
        headers=SUPABASE_HEADERS,
    )
    return r.json() if r.status_code == 200 else []


# ─── STEP 1 : FETCH MATCH IDS ────────────────────────────────────────────────

def fetch_match_ids():
    """Récupère les N derniers match IDs du joueur."""
    url = (
        f"https://{RIOT_MATCH_REGION}.api.riotgames.com"
        f"/tft/match/v1/matches/by-puuid/{RIOT_PUUID}/ids"
        f"?count={MATCH_COUNT}"
    )
    return riot_get(url)


# ─── STEP 2 : CHECK EXISTING ─────────────────────────────────────────────────

def get_existing_match_ids():
    """Récupère les match_ids déjà en base pour éviter les re-fetch."""
    rows = sb_get(
        "tft_matches",
        f"user_id=eq.{USER_ID}&select=match_id&order=played_at.desc&limit={MATCH_COUNT * 2}",
    )
    return {r["match_id"] for r in rows}


# ─── STEP 3 : FETCH MATCH DETAIL ─────────────────────────────────────────────

def fetch_match_detail(match_id):
    """Récupère le détail complet d'un match."""
    url = (
        f"https://{RIOT_MATCH_REGION}.api.riotgames.com"
        f"/tft/match/v1/matches/{match_id}"
    )
    return riot_get(url)


# ─── STEP 4-5 : PARSE & INSERT MATCH ─────────────────────────────────────────

def parse_and_insert_match(match_data):
    """Parse le match et insère dans tft_matches. Retourne le participant data."""
    info = match_data["info"]
    match_id = match_data["metadata"]["match_id"]

    # Trouver notre participant
    participant = None
    for p in info["participants"]:
        if p["puuid"] == RIOT_PUUID:
            participant = p
            break

    if not participant:
        print(f"   [WARN] Joueur non trouvé dans {match_id}")
        return None, None

    played_at = datetime.fromtimestamp(
        info["game_datetime"] / 1000, tz=timezone.utc
    ).isoformat()

    traits_active = [t for t in participant.get("traits", []) if t.get("tier_current", 0) > 0]

    row = {
        "user_id": USER_ID,
        "match_id": match_id,
        "played_at": played_at,
        "game_length_s": info.get("game_length"),
        "game_version": info.get("game_version"),
        "set_number": info.get("tft_set_number"),
        "set_name": info.get("tft_set_core_name"),
        "queue_id": info.get("queue_id"),
        "game_type": info.get("tft_game_type"),
        "placement": participant["placement"],
        "level": participant.get("level"),
        "gold_left": participant.get("gold_left"),
        "last_round": participant.get("last_round"),
        "players_eliminated": participant.get("players_eliminated"),
        "total_damage": participant.get("total_damage_to_players"),
        "time_eliminated": participant.get("time_eliminated"),
        "player_score": (participant.get("missions") or {}).get("PlayerScore2"),
        "is_win": participant["placement"] <= 4,
        "num_units": len(participant.get("units", [])),
        "num_traits_active": len(traits_active),
        "raw_payload": json.dumps(participant),
    }

    success = sb_post("tft_matches", row)
    if success:
        print(f"   ✅ Match {match_id} — #{participant['placement']} ({'Win' if row['is_win'] else 'Loss'})")
    else:
        print(f"   ⏭️  Match {match_id} déjà en base")

    return participant, info


# ─── STEP 6 : PARSE & INSERT UNITS ───────────────────────────────────────────

def parse_and_insert_units(match_id, participant):
    """Parse les champions de la compo finale et insère dans tft_match_units."""
    units = participant.get("units", [])
    rows = []
    for u in units:
        items_raw = u.get("itemNames", [])
        items_clean = [clean_item(i) for i in items_raw]
        rarity = u.get("rarity", 0)

        rows.append({
            "match_id": match_id,
            "user_id": USER_ID,
            "character_id": u.get("character_id", ""),
            "champion_name": clean_name(u.get("character_id", "")),
            "tier": u.get("tier"),
            "rarity": rarity,
            "cost": RARITY_TO_COST.get(rarity, 1),
            "items": items_clean,
            "num_items": len(items_clean),
        })

    if rows:
        sb_post("tft_match_units", rows)
    return len(rows)


# ─── STEP 7 : PARSE & INSERT TRAITS ──────────────────────────────────────────

def parse_and_insert_traits(match_id, participant):
    """Parse les traits de la compo finale et insère dans tft_match_traits."""
    traits = participant.get("traits", [])
    rows = []
    for t in traits:
        rows.append({
            "match_id": match_id,
            "user_id": USER_ID,
            "trait_id": t.get("name", ""),
            "trait_name": clean_name(t.get("name", "")),
            "num_units": t.get("num_units"),
            "style": t.get("style"),
            "tier_current": t.get("tier_current"),
            "tier_total": t.get("tier_total"),
            "is_active": (t.get("tier_current", 0) > 0),
        })

    if rows:
        sb_post("tft_match_traits", rows)
    return len(rows)


# ─── STEP 8 : PARSE & INSERT LOBBY ───────────────────────────────────────────

def parse_and_insert_lobby(match_id, info):
    """Parse les adversaires et insère dans tft_match_lobby."""
    rows = []
    for p in info["participants"]:
        if p["puuid"] == RIOT_PUUID:
            continue

        # Main traits : actifs avec style >= 2
        main_traits = [
            clean_name(t.get("name", ""))
            for t in p.get("traits", [])
            if t.get("style", 0) >= 2
        ]

        # Main carry : champion avec le plus d'items
        units = p.get("units", [])
        main_carry = ""
        if units:
            carry = max(units, key=lambda u: len(u.get("itemNames", [])))
            main_carry = clean_name(carry.get("character_id", ""))

        rows.append({
            "match_id": match_id,
            "user_id": USER_ID,
            "puuid": p["puuid"],
            "game_name": p.get("riotIdGameName"),
            "tag_line": p.get("riotIdTagline"),
            "placement": p.get("placement"),
            "level": p.get("level"),
            "total_damage": p.get("total_damage_to_players"),
            "players_eliminated": p.get("players_eliminated"),
            "main_traits": main_traits,
            "main_carry": main_carry,
            "num_units": len(units),
        })

    if rows:
        sb_post("tft_match_lobby", rows)
    return len(rows)


# ─── STEP 9 : RANK SNAPSHOT ──────────────────────────────────────────────────

def fetch_and_insert_rank():
    """Fetch le rang actuel et insère un snapshot si pas déjà fait aujourd'hui."""
    url = (
        f"https://{RIOT_PLATFORM}.api.riotgames.com"
        f"/tft/league/v1/entries/by-puuid/{RIOT_PUUID}"
    )
    entries = riot_get(url)

    # Chercher l'entrée ranked TFT
    ranked = None
    for e in entries:
        if e.get("queueType") == "RANKED_TFT":
            ranked = e
            break

    if not ranked:
        print("   ⚠️  Pas de données ranked trouvées")
        return

    # Vérifier si un snapshot existe déjà aujourd'hui
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = sb_get(
        "tft_rank_history",
        f"user_id=eq.{USER_ID}&captured_at=gte.{today}T00:00:00Z&captured_at=lt.{today}T23:59:59Z&limit=1",
    )
    if existing:
        print(f"   ⏭️  Rank snapshot déjà enregistré aujourd'hui ({ranked.get('tier')} {ranked.get('rank')} {ranked.get('leaguePoints')} LP)")
        return

    row = {
        "user_id": USER_ID,
        "tier": ranked.get("tier"),
        "rank": ranked.get("rank"),
        "lp": ranked.get("leaguePoints"),
        "wins": ranked.get("wins"),
        "losses": ranked.get("losses"),
    }

    success = sb_post("tft_rank_history", row)
    if success:
        print(f"   ✅ Rank: {row['tier']} {row['rank']} — {row['lp']} LP ({row['wins']}W / {row['losses']}L)")
    else:
        print(f"   ❌ Échec insertion rank")


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("🎮 TFT TRACKER — Match Ingestion Pipeline")
    print(f"   PUUID: {RIOT_PUUID[:20]}...")
    print(f"   Region: {RIOT_MATCH_REGION} / {RIOT_PLATFORM}")
    print("=" * 60)

    # Step 1 : Fetch match IDs
    print(f"\n📋 Fetch des {MATCH_COUNT} derniers match IDs...")
    match_ids = fetch_match_ids()
    print(f"   → {len(match_ids)} matchs trouvés")

    # Step 2 : Filtrer les matchs déjà en base
    print("\n🔍 Vérification des matchs existants...")
    existing_ids = get_existing_match_ids()
    new_ids = [mid for mid in match_ids if mid not in existing_ids]
    print(f"   → {len(new_ids)} nouveaux matchs à importer ({len(existing_ids)} déjà en base)")

    if not new_ids:
        print("\n✅ Aucun nouveau match à importer.")
    else:
        # Steps 3-8 : Process chaque nouveau match
        print(f"\n⬇️  Import de {len(new_ids)} matchs...")
        total_units = 0
        total_traits = 0
        total_lobby = 0

        for i, match_id in enumerate(new_ids, 1):
            print(f"\n   [{i}/{len(new_ids)}] {match_id}")
            try:
                match_data = fetch_match_detail(match_id)
                participant, info = parse_and_insert_match(match_data)

                if participant and info:
                    n_units = parse_and_insert_units(match_id, participant)
                    n_traits = parse_and_insert_traits(match_id, participant)
                    n_lobby = parse_and_insert_lobby(match_id, info)
                    total_units += n_units
                    total_traits += n_traits
                    total_lobby += n_lobby
                    print(f"      → {n_units} units, {n_traits} traits, {n_lobby} adversaires")

            except Exception as e:
                print(f"   ❌ Erreur: {e}")

            # Rate limit : attendre entre chaque appel
            if i < len(new_ids):
                time.sleep(RATE_LIMIT_DELAY)

        print(f"\n📊 Bilan import:")
        print(f"   Matchs: {len(new_ids)}")
        print(f"   Units: {total_units}")
        print(f"   Traits: {total_traits}")
        print(f"   Lobby: {total_lobby}")

    # Step 9 : Rank snapshot
    print("\n🏆 Rank snapshot...")
    try:
        fetch_and_insert_rank()
    except Exception as e:
        print(f"   ❌ Erreur rank: {e}")

    print("\n" + "=" * 60)
    print("✅ Pipeline terminé")
    print("=" * 60)


if __name__ == "__main__":
    main()
