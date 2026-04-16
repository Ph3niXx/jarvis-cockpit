# Steam Integration — Setup Guide

## Prerequisites

1. Un compte Steam avec un profil **public** (Settings > Privacy > Game details: Public)
2. Une Steam Web API Key

## Step 1 — Get your API key

1. Va sur https://steamcommunity.com/dev/apikey
2. Enregistre un nom de domaine (n'importe lequel, ex: `localhost`)
3. Note ta **Key**

## Step 2 — Find your Steam ID (64-bit)

1. Va sur https://steamid.io/
2. Entre ton profil Steam URL ou vanity name
3. Note le **steamID64** (nombre de 17 chiffres, ex: `76561198012345678`)

## Step 3 — Ensure profile is public

1. Steam > Settings > Privacy Settings
2. **Game details** doit être sur **Public**
3. Sans ça, l'API retourne une liste vide

## Step 4 — Add GitHub Secrets

Go to **Settings > Secrets and variables > Actions** :

| Secret | Value |
|---|---|
| `STEAM_API_KEY` | Ta clé API Steam |
| `STEAM_ID` | Ton Steam ID 64-bit |

`SUPABASE_URL` et `SUPABASE_SERVICE_KEY` sont déjà configurés.

## Step 5 — First run

Déclenche manuellement : **Actions > "Steam — Gaming Sync" > Run workflow**

Le premier run snapshot toute ta bibliothèque. Les stats quotidiennes seront disponibles dès le 2ème run (delta vs la veille).

## Step 6 — Verify

```sql
-- Snapshot bibliothèque
SELECT count(*) as games, max(snapshot_date) as latest FROM steam_games_snapshot;

-- Top jeux par temps de jeu
SELECT name, playtime_forever_minutes / 60 as hours
FROM steam_games_snapshot
WHERE snapshot_date = CURRENT_DATE
ORDER BY playtime_forever_minutes DESC LIMIT 10;

-- Stats quotidiennes
SELECT * FROM gaming_stats_daily ORDER BY stat_date DESC LIMIT 7;

-- Achievements récents
SELECT a.achievement_name, d.name as game, a.unlocked_at
FROM steam_achievements a
JOIN steam_game_details d ON a.appid = d.appid
ORDER BY a.unlocked_at DESC LIMIT 10;
```

## Schedule

- **Quotidien 5:30 UTC** : snapshot bibliothèque + stats + enrichissement
- **Lundi** : achievements en plus (ou `--force` pour forcer)

## Rate limits

- Steam Web API : 100k req/jour (aucun risque de dépassement)
- Store API : ~200 req/5min (le pipeline se limite à 20 enrichissements par run avec 300ms de délai)
