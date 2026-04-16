# Last.fm / Music Integration — Setup Guide

## Overview

Last.fm sert de pont entre Apple Music et le cockpit. Le scrobbling capture chaque écoute avec un timestamp exact, qu'on synchronise quotidiennement vers Supabase.

## Prerequisites

1. Un compte Last.fm (https://www.last.fm/join)
2. Un scrobbler connecté à Apple Music :
   - **Windows** : [AMWin-RP](https://github.com/PKBeam/AMWin-RP) (scrobble + Discord Rich Presence)
   - **iPhone** : [QuietScrob](https://apps.apple.com/app/quietscrob/id1448601696) (scrobble en arrière-plan)
   - **Navigateur** : [Web Scrobbler](https://web-scrobbler.com/) (Apple Music web)

## Step 1 — Create a Last.fm API app

1. Va sur https://www.last.fm/api/account/create
2. Remplis le formulaire (nom, description — peu importe)
3. Note ta **API Key** (pas le shared secret, juste la key publique)

## Step 2 — Add GitHub Secrets

Go to **Settings > Secrets and variables > Actions > New repository secret** :

| Secret | Value |
|---|---|
| `LASTFM_API_KEY` | Ta clé API Last.fm |
| `LASTFM_USERNAME` | Ton nom d'utilisateur Last.fm |

`SUPABASE_URL` et `SUPABASE_SERVICE_KEY` sont déjà configurés.

## Step 3 — First run (backfill)

Déclenche manuellement : **Actions > "Last.fm — Scrobble Sync" > Run workflow**

Le premier run détecte automatiquement que la DB est vide et backfill 90 jours d'historique. Ça peut prendre 2-5 minutes selon le volume de scrobbles.

## Step 4 — Verify

```sql
-- Nombre de scrobbles et plage de dates
SELECT count(*), min(scrobbled_at::date), max(scrobbled_at::date) FROM music_scrobbles;

-- Stats quotidiennes
SELECT stat_date, scrobble_count, top_artist, unique_artists 
FROM music_stats_daily ORDER BY stat_date DESC LIMIT 7;

-- Top hebdo
SELECT category, rank, item_name, play_count 
FROM music_top_weekly ORDER BY week_start DESC, category, rank LIMIT 15;
```

## Automatic schedule

Le pipeline tourne quotidiennement à **5:00 UTC** (7h Paris). Il fetch les scrobbles depuis la veille et recompute les stats.

Les tops hebdomadaires sont recalculés le lundi uniquement.

## Custom lookback

```bash
python pipelines/lastfm_sync.py --days=365   # 1 an d'historique
python pipelines/lastfm_sync.py --dry-run     # test sans écriture
```

## Rate limits

Last.fm API : ~5 req/s, pas de quota quotidien strict. Le pipeline sleep 200ms entre chaque page. Un backfill de 90 jours avec 50 scrobbles/jour (~25 pages) prend environ 5 secondes d'API.
