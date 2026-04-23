# Withings Integration — Setup Guide

## Prerequisites

1. A Withings account with at least one measurement synced (weight, composition…)
2. A Withings Developer app (create at https://developer.withings.com/dashboard/)
   - Callback URL: `http://localhost:8000/callback`
   - Note your **Client ID** and **Consumer Secret** (= Client Secret)

## Step 1 — Get your refresh token (one-time)

Run the OAuth script locally:

```bash
cd -ai-daily-digest
python scripts/withings_oauth_init.py
```

The script:
- Reads your Client ID and Client Secret from `Config.txt` (if present) or prompts for them
- Opens your browser on the Withings consent screen
- Captures the callback code and exchanges it for a refresh token
- Prints your `WITHINGS_REFRESH_TOKEN` and `WITHINGS_USER_ID`

If you want to automate, create `Config.txt` at the repo root:
```
WITHINGS_CLIENT_ID=your_id
WITHINGS_CLIENT_SECRET=your_secret
```

## Step 2 — Add GitHub Secrets

Repo settings → Secrets and variables → Actions → New repository secret.

Add these 3 secrets:

| Secret | Value |
|---|---|
| `WITHINGS_CLIENT_ID` | Your Withings app Client ID |
| `WITHINGS_CLIENT_SECRET` | Your Withings app Consumer Secret |
| `WITHINGS_REFRESH_TOKEN` | The token printed in Step 1 |

The workflow also uses the existing `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`.

## Step 3 — Initial backfill

Trigger a full history sync:

1. Actions tab → **"Withings — Measurements Sync"**
2. Run workflow → Set `backfill` to `true` → Run workflow
3. Wait ~30 seconds

## Step 4 — Verify

```sql
SELECT measure_date, weight_kg, fat_pct, muscle_mass_kg, hydration_kg
FROM withings_measurements ORDER BY measure_date DESC LIMIT 10;
```

The cockpit's Forme panel will automatically show the Composition section
and the trend charts once at least one row is present.

## Automatic schedule

The workflow runs daily at **4:45 UTC** (6:45 Paris), between the Strava
(4:30) and Last.fm (5:00) syncs. It pulls the last 7 days incrementally.

## Measure types synced

| Withings type | Column | Unit |
|---|---|---|
| 1 | `weight_kg` | kg |
| 6 | `fat_pct` | % |
| 8 | `fat_mass_kg` | kg |
| 76 | `muscle_mass_kg` | kg |
| 77 | `hydration_kg` | kg |
| 88 | `bone_mass_kg` | kg |

Multiple pesées the same day are collapsed to one row — the column-level
latest value wins (not an average).

## Dry-run mode

```bash
export WITHINGS_CLIENT_ID=...
export WITHINGS_CLIENT_SECRET=...
export WITHINGS_REFRESH_TOKEN=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_KEY=...

python pipelines/withings_sync.py --dry-run
```

## Token refresh

Withings rotates the refresh token on every call. The pipeline handles
this for the current run, but **the new token is NOT automatically written
back to GitHub Secrets** — Withings keeps the previous token valid for a
grace period (usually days), and the script uses the latest one it got.

If you see 401 errors for several consecutive runs, re-run
`python scripts/withings_oauth_init.py` to regenerate a fresh token and
update the `WITHINGS_REFRESH_TOKEN` secret.

## Rate limits

Withings allows 120 requests per minute per IP. One cron run = 2 requests
(1 token refresh + 1 getmeas). Comfortable margin.
