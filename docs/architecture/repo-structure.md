# Arborescence du repo

Vue lisible du repo. Source de vérité fonctionnelle : `docs/architecture/pipelines.yaml`, `dependencies.yaml`, `layers.yaml`. Source de vérité de la sidebar : `cockpit/nav.js`.

## Top-level

| Chemin | Rôle |
|---|---|
| `main.py` | Pipeline quotidien Gemini (RSS + web search + brief, lancé par GH Actions) |
| `weekly_analysis.py` | Pipeline hebdomadaire Claude (wiki, signaux, recos, challenges, opps, RTE) |
| `tft_pipeline.py` | Pipeline TFT (Riot API → Supabase) |
| `index.html` | Coquille React — charge React/Babel + `cockpit/*` |
| `mediatheque.html` | Deuxième page d'entrée — médiathèque seule, PWA installable iOS (pas de sidebar, 2 scripts Babel contre 32 pour `index.html`) |
| `requirements.txt` | feedparser, google-generativeai, openai, requests |
| `manifest.json` | PWA manifest (theme rouille Dawn) |
| `manifest-mediatheque.json` | PWA manifest dédié à `mediatheque.html` (`start_url`, icône, `theme_color` propres) |
| `sw.js` | Service worker PWA (cache-first shell, network-only API) |
| `assets/` | Icônes PWA (`icon-cockpit-180.png`, `icon-mediatheque-180.png` + sources `.svg`) |
| `CLAUDE.md` | Index minimal pour les sessions Claude Code |
| `.gitmessage` | Template de commit avec checklist "Specs mises à jour" |

## `cockpit/` — Handoff React (Dawn / Obsidian / Atlas)

| Fichier | Rôle |
|---|---|
| `app.jsx` | Router + theme switcher + panel keys |
| `sidebar.jsx` | Sidebar collapsible + 6 groupes |
| `home.jsx` | Brief du jour (hero + top 3 + signaux + radar + week) |
| `panel-*.jsx` | 24 panels dédiés (panel-veille mutualisé sur 6 corpus → 32 onglets visibles) |
| `components-mobile.jsx` | `window.PanelSection` + `window.useIsMobile` — repli `<details>` sous 760px, passe-plat exact au-dessus (portage mobile, ADR-46) |
| `styles.css` + `styles-*.css` | Shell + stylesheets par domaine |
| `themes.js` | `THEMES = {dawn, obsidian, atlas}` |
| `icons.jsx` | `<Icon name=... />` système commun |
| `nav.js` | Sidebar — source unique `window.COCKPIT_NAV` (consommée par data.js + data-loader.js) |
| `data.js` + `data-*.js` | Schémas de référence (override à runtime) |

### `cockpit/lib/`

| Fichier | Rôle |
|---|---|
| `supabase.js` | Client + REST wrappers + JWT rotation |
| `mobile-view.js` | Logique pure du portage mobile — palier 760px, libellés du délai de garde du loader (`window.mobileView`, testé par `tests/test_mobile_view.mjs`) |
| `auth.js` | Google OAuth overlay + `waitForAuth()` |
| `telemetry.js` | `track()` best-effort → `usage_events` |
| `data-loader.js` | `bootTier1` (Home sync) + `loadPanel` (Tier 2 lazy) |
| `bootstrap.js` | Entrypoint cockpit : auth → Tier 1 → mount React |
| `boot-mediatheque.js` | Entrypoint PWA `mediatheque.html` : auth → Tier 2 seul → mount React (pas de Tier 1) |

## `pipelines/` — Pipelines de sync API → Supabase

| Fichier | Cron | Cible |
|---|---|---|
| `strava_sync.py` | 4h30 UTC | `strava_activities` (+ raw) |
| `withings_sync.py` | 4h45 UTC | `withings_measurements` (+ raw) |
| `lastfm_sync.py` | 5h00 UTC | `music_*` |
| `steam_sync.py` | 5h30 UTC | `steam_*`, `gaming_stats_daily` |
| `sport_sync.py` | 6h30 UTC | `sport_articles` |
| `gaming_sync.py` | 6h45 UTC | `gaming_articles` |
| `anime_sync.py` | 7h00 UTC | `anime_articles` |
| `news_sync.py` | 7h15 UTC | `news_articles` |
| `requirements-*.txt` | — | Dépendances isolées par pipeline |

Source canonique des crons : [`pipelines.yaml`](pipelines.yaml).

## `scripts/`

| Fichier | Rôle |
|---|---|
| `strava_oauth_init.py` | One-shot OAuth Strava (local, pour obtenir le refresh token) |
| `withings_oauth_init.py` | One-shot OAuth Withings |
| `sync-sw.mjs` | Régénère `STATIC[]` et bumpe `CACHE` dans `sw.js` |
| `validate_architecture.py` | CI `validate-arch` |
| `lint_specs_produit.py` | CI `lint-specs` |

## `sql/` — Migrations Supabase (root)

| Fichier | Rôle |
|---|---|
| `tft_migration.sql` | Migration TFT |
| `005_rls_lockdown.sql` | RLS : restriction anon (SELECT only) |
| `006_rls_authenticated.sql` | RLS : migration anon → authenticated |
| `011_claude_veille.sql` | Table `claude_veille` |
| `012_claude_ecosystem.sql` · `012_history_notes.sql` | Tables `claude_ecosystem`, `history_notes` |
| `013_jobs_inherit_status.sql` | Trigger `jobs_inherit_user_status` |

Migrations Jarvis spécifiques : `jarvis/migrations/`.

## `.github/workflows/` — Crons GitHub Actions

| Fichier | Rôle |
|---|---|
| `daily_digest.yml` | Cron quotidien (`main.py`) |
| `weekly_analysis.yml` | Cron hebdomadaire (`weekly_analysis.py`) |
| `tft-sync.yml` | Cron TFT (toutes les 2h) |
| `strava-sync.yml` · `withings-sync.yml` · `lastfm-sync.yml` · `steam-sync.yml` | Crons API perso |
| `sport-sync.yml` · `gaming-sync.yml` · `anime-sync.yml` · `news-sync.yml` | Crons RSS satellites |
| `validate-arch.yml` · `arch-drift-check.yml` | Garde-fous archi |
| `validate-spec.yml` · `spec-drift-check.yml` · `lint-specs.yml` | Garde-fous specs |
| `sw-sync.yml` | Sync auto du `STATIC[]` dans `sw.js` |
| `tests.yml` | Lance tous les `tests/test_*.mjs` (node) sur push `main` + PR |

## `jarvis/` — Module assistant local

Voir [jarvis/README.md](../../jarvis/README.md) pour la doc complète (vision, stack LM Studio, observers, phases, tables Supabase, Cloudflare tunnel).

`jarvis_data/` (non versionné) — données perso : `activity_*.jsonl`, `outlook_*.json`, state files.

## `docs/` — Documentation versionnée

| Sous-dossier | Contenu |
|---|---|
| `specs/` | 29 specs onglets (`tab-*.md`) + `index.json` + `_template.md` + [`MAINTENANCE.md`](../specs/MAINTENANCE.md) |
| `architecture/` | `layers.yaml`, `pipelines.yaml`, `dependencies.yaml`, `flows/`, `decisions.md`, `repo-structure.md`, `README.md` |
| `audits/` · `veille-claude/` · `prompts/` | Outputs des routines Cowork (veille, audits, prompts) |
| `cowork-routines/` | Procédures des routines automatisées (Cowork desktop + routines Claude Code distantes, ex. Jobs Radar — ADR-19). Dossier non renommé `agent-routines/` (trop de refs). |
| `*-setup.md` | Procédures de setup pour pipelines Strava / Withings / Last.fm / Steam |
| [`secrets.md`](../secrets.md) | Liste des GitHub Secrets |
| [`telemetry.md`](../telemetry.md) | Events `usage_events` instrumentés |
| [`weekly-pipeline.md`](../weekly-pipeline.md) | Pipeline hebdomadaire signals + veille + audit |
