# AI Cockpit — Contexte projet

## Vue d'ensemble

Cockpit IA personnel pour un manager en transformation digitale qui veut :
1. Se tenir à jour sur les évolutions IA (veille quotidienne automatisée)
2. Monter en compétence IA de manière mesurable (radar, challenges, recommandations)
3. Identifier des opportunités business (incubateur, radar d'opportunités)
4. Optimiser sa mission actuelle avec l'IA (RTE Toolbox)

## Utilisateur

- **Rôle actuel** : Release Train Engineer (RTE) du train Vente chez Malakoff Humanis (mutuelle/assurance)
- **Contexte SAFe** : pilote un train avec des équipes CRM, outils d'aide à la vente, portail d'accès
- **Background** : Manager PwC Digital
- **Ambition** : devenir expert IA, potentiellement créer sa boîte — pas encore d'idée précise
- **Profil complet** : stocké dans Supabase table `user_profile` (key/value)
- **Compétences IA** : stockées dans Supabase table `skill_radar` (8 axes avec scores, forces, lacunes)

## Architecture technique

### Stack
- **Site** : GitHub Pages — React 18 + `@babel/standalone` via unpkg (SRI pinnés), no build step. Coquille `index.html` + dossier `cockpit/` (React handoff Dawn/Obsidian/Atlas)
- **Base de données** : Supabase PostgreSQL (free tier, projet `mrmgptqpflzyavdfqwwv`)
- **Pipeline quotidien** : `main.py` via GitHub Actions (cron quotidien 6h UTC)
  - Gemini 2.5 Flash-Lite (gratuit) pour RSS + web search + brief
- **Pipeline hebdomadaire** : `weekly_analysis.py` via GitHub Actions (dimanche 22h UTC)
  - Claude Haiku 4.5 (~0.03$/run) pour wiki, signaux, recommandations, challenges, opportunités, RTE
- **Pipeline TFT** : `tft_pipeline.py` via GitHub Actions (toutes les 2h)
  - API Riot TFT → Supabase (matchs, compos, lobby, rank)
- **Pipeline Strava** : `pipelines/strava_sync.py` via GitHub Actions (quotidien 4h30 UTC)
  - API Strava → Supabase (activités sportives, raw + mappé)
- **Pipeline Withings** : `pipelines/withings_sync.py` via GitHub Actions (quotidien 4h45 UTC)
  - API Withings → Supabase (poids, masse grasse/muscle/eau/os — 1 ligne/jour)
- **Pipeline Last.fm** : `pipelines/lastfm_sync.py` via GitHub Actions (quotidien 5h UTC)
  - API Last.fm → Supabase (scrobbles, stats quotidiennes, tops hebdo, loved tracks)
- **Pipeline Steam** : `pipelines/steam_sync.py` via GitHub Actions (quotidien 5h30 UTC)
  - API Steam → Supabase (bibliothèque, playtime, achievements, stats gaming)
- **Email** : Gmail SMTP notification quotidienne
- **MCP Supabase** : connecteur direct disponible dans Claude Code (apply_migration, execute_sql, etc.) — nécessite OAuth au début de chaque session

### Repo structure
```
main.py                              # Pipeline quotidien Gemini
weekly_analysis.py                   # Pipeline hebdomadaire Claude
tft_pipeline.py                      # Pipeline TFT (Riot API → Supabase)
index.html                           # Coquille React — charge React/Babel + cockpit/*
cockpit/                             # Handoff React maquette (Dawn/Obsidian/Atlas)
cockpit/app.jsx                      # Router + theme switcher + panel keys
cockpit/sidebar.jsx                  # Sidebar collapsible + 6 groupes
cockpit/home.jsx                     # Brief du jour (hero + top 3 + signaux + radar + week)
cockpit/panel-*.jsx                  # 19 panels dédiés
cockpit/styles.css + styles-*.css    # Shell + stylesheets par domaine
cockpit/themes.js                    # THEMES = {dawn, obsidian, atlas}
cockpit/icons.jsx                    # <Icon name=... /> système commun
cockpit/data.js + data-*.js          # Schémas de référence (override à runtime)
cockpit/lib/supabase.js              # Client + REST wrappers + JWT rotation
cockpit/lib/auth.js                  # Google OAuth overlay + waitForAuth()
cockpit/lib/telemetry.js             # track() best-effort → usage_events
cockpit/lib/data-loader.js           # bootTier1 (Home sync) + loadPanel (Tier 2 lazy)
cockpit/lib/bootstrap.js             # Entrypoint : auth → Tier 1 → mount React
sw.js                                # Service worker PWA (cache-first shell, network-only API)
manifest.json                        # PWA manifest (theme rouille Dawn)
requirements.txt                     # feedparser, google-generativeai, openai, requests
sql/tft_migration.sql                # Migration Supabase pour les tables TFT
sql/005_rls_lockdown.sql             # RLS: restriction anon (SELECT only, pas de DELETE)
sql/006_rls_authenticated.sql        # RLS: migration anon → authenticated
jarvis/                              # Module Jarvis (assistant local LM Studio)
jarvis_data/                         # Données perso Jarvis (non versionné)
.github/workflows/daily_digest.yml   # Cron quotidien
.github/workflows/weekly_analysis.yml # Cron hebdomadaire
.github/workflows/tft-sync.yml      # Cron TFT toutes les 2h
.github/workflows/strava-sync.yml   # Cron Strava quotidien 4h30 UTC
scripts/strava_oauth_init.py         # Script one-shot OAuth Strava (local)
pipelines/strava_sync.py             # Pipeline sync Strava → Supabase
pipelines/requirements-strava.txt    # Dépendances isolées pour le pipeline Strava
scripts/withings_oauth_init.py       # Script one-shot OAuth Withings (local)
pipelines/withings_sync.py           # Pipeline sync Withings → Supabase
pipelines/requirements-withings.txt  # Dépendances isolées pour le pipeline Withings
.github/workflows/withings-sync.yml  # Cron Withings quotidien 4h45 UTC
docs/withings-setup.md               # Procédure de setup Withings
pipelines/lastfm_sync.py             # Pipeline sync Last.fm → Supabase
pipelines/requirements-lastfm.txt    # Dépendances isolées pour le pipeline Last.fm
.github/workflows/lastfm-sync.yml   # Cron Last.fm quotidien 5h UTC
docs/lastfm-setup.md                 # Procédure de setup Last.fm
pipelines/steam_sync.py              # Pipeline sync Steam → Supabase
pipelines/requirements-steam.txt     # Dépendances isolées pour le pipeline Steam
.github/workflows/steam-sync.yml    # Cron Steam quotidien 5h30 UTC
docs/steam-setup.md                  # Procédure de setup Steam
docs/strava-setup.md                 # Procédure de setup Strava
CLAUDE.md                            # Ce fichier
```

### GitHub Secrets
```
GEMINI_API_KEY      # Google AI Studio
GMAIL_ADDRESS       # Email expéditeur
GMAIL_APP_PASSWORD  # Mot de passe d'app Gmail
RECIPIENT_EMAIL     # Email destinataire
SUPABASE_URL        # https://mrmgptqpflzyavdfqwwv.supabase.co
SUPABASE_KEY        # Publishable key (sb_publishable_...)
SUPABASE_SERVICE_KEY # Service role key (pour bypass RLS en écriture, utilisé par tft_pipeline)
SUPABASE_USER_ID    # UUID de l'utilisateur Supabase auth
ANTHROPIC_API_KEY   # Claude API
RIOT_API_KEY        # Riot Games Developer API key (https://developer.riotgames.com)
RIOT_PUUID          # PUUID du joueur TFT à tracker
STRAVA_CLIENT_ID    # Strava API app client ID
STRAVA_CLIENT_SECRET # Strava API app client secret
STRAVA_REFRESH_TOKEN # Strava OAuth2 refresh token (obtenu via scripts/strava_oauth_init.py)
WITHINGS_CLIENT_ID     # Withings API app client ID
WITHINGS_CLIENT_SECRET # Withings API app consumer secret
WITHINGS_REFRESH_TOKEN # Withings OAuth2 refresh token (obtenu via scripts/withings_oauth_init.py)
LASTFM_API_KEY      # Last.fm API key (https://www.last.fm/api/account/create)
LASTFM_USERNAME     # Last.fm username
STEAM_API_KEY       # Steam Web API key (https://steamcommunity.com/dev/apikey)
STEAM_ID            # Steam ID 64-bit (17 chiffres)
```

### Base de données Supabase

Tables existantes :
- `articles` — articles RSS quotidiens (source, title, url, summary, section, fetch_date)
- `daily_briefs` — brief HTML quotidien généré par Gemini
- `wiki_concepts` — glossaire IA auto-alimenté (slug, name, category, 3 niveaux de description, mentions)
- `signal_tracking` — termes IA trackés par semaine (term, week_start, mention_count, trend)
- `skill_radar` — 8 axes de compétence (score, strengths, gaps, goals, context, history)
- `learning_recommendations` — recommandations hebdo ciblées sur les lacunes du radar
- `weekly_challenges` — mini-défis gamifiés calibrés sur le profil
- `weekly_opportunities` — use cases et opportunités business détectés dans l'actualité
- `business_ideas` — carnet d'idées incubateur (éditable depuis le front)
- `rte_usecases` — 12 use cases IA pour la mission RTE (Jira, Excel, SAFe, Confluence, Slack)
- `weekly_analysis` — logs des runs Claude (tokens, coûts, résultats)
- `user_profile` — profil personnel key/value (identité, ambitions, intérêts, notes)
- `usage_events` — télémétrie UX cockpit append-only (event_type, payload JSONB, ts). Migration: `jarvis/migrations/005_usage_events.sql`

**Tables TFT :**
- `tft_matches` — une ligne par match joué (placement, level, gold, durée, raw_payload JSONB, champs user_* éditables)
- `tft_match_units` — champions de la compo finale (character_id brut + champion_name nettoyé, tier/étoiles, cost, items)
- `tft_match_traits` — traits de la compo finale (trait_id brut + trait_name nettoyé, style, tier, is_active)
- `tft_match_lobby` — 7 adversaires par match (placement, main_traits, main_carry, dénormalisé)
- `tft_rank_history` — snapshot quotidien du rang ranked (tier, rank, LP, wins, losses)

**Tables Last.fm / Musique :**
- `music_scrobbles_raw` — payloads JSON bruts des pages Last.fm (archive, service_role only)
- `music_scrobbles` — une ligne par écoute (track, artist, album, scrobbled_at, MBIDs)
- `music_stats_daily` — agrégats quotidiens (scrobble_count, unique artists/tracks, top artist/track, listening_minutes, new_artists_count)
- `music_top_weekly` — top 10 artistes/tracks/albums par semaine (category, item_name, play_count, rank)
- `music_loved_tracks` — titres "loved" avec date

**Tables Last.fm enrichissement :**
- `music_artist_tags` — cache tags/genres par artiste (top_tag, tags[], fetched_at, refresh 90j)
- `music_genre_weekly` — répartition genres par semaine (genre, scrobble_count, percentage, rank)
- `music_insights_weekly` — récap IA hebdo généré par Gemini (summary, mood_keywords, discovery_ratio)

**Tables Steam / Gaming :**
- `steam_games_snapshot` — snapshot quotidien bibliothèque (appid, name, playtime_forever, playtime_2weeks, snapshot_date)
- `steam_game_details` — cache enrichissement Store API (genres, categories, developer, header_image, description)
- `steam_achievements` — achievements débloqués (appid, api_name, display_name, unlocked_at)
- `gaming_stats_daily` — stats quotidiennes agrégées (total_playtime_minutes, games_played_count, top_game)

**Tables Strava :**
- `strava_activities_raw` — archive brute des réponses API (id Strava, athlete_id, payload JSONB complet, fetched_at)
- `strava_activities` — données mappées pour le cockpit (sport_type, distance_m, moving_time_s, heartrate, watts, calories, etc.)

**Tables Withings :**
- `withings_measurements` — 1 ligne par jour (measure_date PK, weight_kg, fat_pct, fat_mass_kg, muscle_mass_kg, hydration_kg, bone_mass_kg, measured_at). Latest per-column wins.
- `withings_measurements_raw` — archive brute par groupe de mesures (measure_group_id PK, user_id, payload JSONB)

**RLS (après migration 006)** : toutes les tables requièrent `authenticated` pour SELECT. 4 tables frontend (business_ideas, user_profile, skill_radar, tft_matches) ont aussi INSERT/UPDATE pour `authenticated`. Anon ne peut plus rien lire. Les pipelines backend (main.py, weekly_analysis.py, tft_pipeline.py, Jarvis) utilisent `service_role` key qui bypass RLS.

### Sections du cockpit (sidebar)

| Section | Source de données | Fréquence |
|---|---|---|
| Brief du jour | daily_briefs + activity_briefs | Quotidien (Gemini + Jarvis observer) |
| Ma semaine | articles + localStorage (read, actions, visits) | Temps réel (front-only) |
| Nouveautés IA | articles (section=updates) | Quotidien |
| Claude | articles (section=claude) — Anthropic + Claude Code + SDK Python/TS + Agent SDK + skills | Quotidien |
| LLMs / Agents / Énergie / FinServ / Outils / Business / Régulation / Arxiv | articles (par section) | Quotidien |
| Wiki IA | wiki_concepts | Quotidien (détection) + Hebdo (enrichissement Claude) |
| Signaux faibles | signal_tracking + weekly_analysis.signals_summary | Quotidien (comptage) + Hebdo (analyse Claude) |
| Opportunités | weekly_opportunities | Hebdomadaire (Claude) |
| Radar compétences | skill_radar | Manuel (diagnostic) + Hebdo (challenges) |
| Recommandations | learning_recommendations | Hebdomadaire (Claude) |
| Challenges | weekly_challenges | Hebdomadaire (Claude) |
| Carnet d'idées | business_ideas | Manuel (depuis le front) |
| RTE Toolbox | rte_usecases | Hebdomadaire (enrichissement Claude) |
| Jarvis | jarvis_conversations + server.py (localhost:8765) | Temps réel (chat local/cloud) |
| Mon profil | user_profile | Manuel (depuis le front) |
| Forme | strava_activities + withings_measurements (1 panel scrollable : KPIs 30j, charge hebdo 12 sem, composition + courbes long range, records auto-calculés, journal 20 dernières séances) | Quotidien (Strava 4h30 UTC + Withings 4h45 UTC) |
| Musique | music_scrobbles, music_stats_daily, music_top_weekly, music_loved_tracks + Last.fm API frontend | Quotidien (Last.fm API) |
| Gaming (Vue d'ensemble) | steam_games_snapshot, gaming_stats_daily, steam_achievements, steam_game_details | Quotidien (Steam API) |
| TFT Matches | tft_matches + tft_match_units + tft_match_traits + tft_match_lobby | Toutes les 2h (Riot API) |
| Coûts API | weekly_analysis.tokens_used | Hebdomadaire (auto-loggé) |
| Recherche | articles (full-text ilike) | Temps réel |
| Historique | articles (groupé par fetch_date) | Quotidien |

### Data layer front

Les panels ne voient jamais la fake data quand la vraie est disponible :

- **Tier 1 (bloquant, avant mount React)** — `cockpit/lib/data-loader.js::bootTier1()` fetch en parallèle : `articles` du jour, `daily_briefs`, `skill_radar`, `signal_tracking`, `user_profile`, `articles` 30j récents, `weekly_analysis` 8 sem. Construit `window.COCKPIT_DATA` exactement au shape attendu par `home.jsx` + hydrate `APPRENTISSAGE_DATA.radar`, `PROFILE_DATA`, `SIGNALS_DATA` avant le mount.
- **Tier 2 (lazy, au clic sidebar)** — `loadPanel(id)` fetch le corpus du panel visité, mute le `window.X_DATA` correspondant (WIKI_DATA, CHALLENGES_DATA, OPPORTUNITIES_DATA, IDEAS_DATA, etc.) et résout la promesse.
- **Re-render après hydration** — `cockpit/app.jsx` incrémente `dataVersion` à la résolution de `loadPanel`. Le `panelKey = activePanel + ":" + dataVersion` force React à remount le panel, qui relit le global muté.
- **Mémoïsation** — chaque loader Tier 2 est wrappé dans `once()` → une seule requête par session. Cache invalidé à la déconnexion (reload).

## Sécurité

- **Authentification** : Google OAuth via Supabase Auth. `cockpit/lib/bootstrap.js` attend `cockpitAuth.waitForAuth()` AVANT tout mount React — React n'est jamais rendu sans session valide. Le token JWT est injecté dans les headers REST pour chaque appel Supabase frontend, rotation auto sur `TOKEN_REFRESHED`.
- **RLS** : Migration `sql/006_rls_authenticated.sql` — toutes les tables exigent `authenticated`. Les pipelines backend utilisent `SUPABASE_SERVICE_KEY` (obligatoire, `start_jarvis.bat` refuse de démarrer sans).
- **XSS** : DOMPurify sanitize tout le HTML injecté dynamiquement via `safe()` helper.
- **CSP** : Meta tag Content-Security-Policy restrictif (`frame-src: none`, `object-src: none`, whitelist explicite pour scripts/connect).
- **Backend** : `jarvis/supabase_client.py` utilise toujours `service_role` key (jamais la publishable).

## Télémétrie

Table `usage_events` — append-only, pas de UPDATE/DELETE (enforcé par RLS). Le front envoie les events via `track(eventType, payload)` qui réutilise `postJSON()`. Best-effort : un échec de télémétrie ne casse jamais le cockpit.

**Events instrumentés :**

| event_type | payload | Point d'instrumentation |
|---|---|---|
| `section_opened` | `{section}` | `handleNavigate()` dans `cockpit/app.jsx` |
| `search_performed` | `{query_length, results_count}` | `cockpit/panel-search.jsx` après fetch |
| `link_clicked` | `{url, section}` | Event delegation globale `a[target="_blank"]` dans `app.jsx` |
| `pipeline_triggered` | `{pipeline, mode}` | `cockpit/panel-jarvis.jsx` avant `jarvisSend()` |
| `error_shown` | `{context, message}` | Wrapper `showError()` dans `cockpit/lib/` |
| `profile_field_saved` | `{key}` | `cockpit/panel-profile.jsx` après PATCH |
| `profile_payload_copied` | `{size}` | `cockpit/panel-profile.jsx` export |
| `skill_radar_bumped` | `{axis, delta}` | `cockpit/panel-radar.jsx` après bump manuel |
| `challenge_completed` | `{challenge_id, mode}` | `cockpit/panel-challenges.jsx` post-submit |
| `idea_moved` | `{id, from_status, to_status}` | `cockpit/panel-ideas.jsx` drag&drop |
| `wiki_shared` | `{slug}` | `cockpit/panel-wiki.jsx` partage |
| `jobs_action` | `{action, job_id}` | `cockpit/panel-jobs-radar.jsx` toggle |
| `history_pin_toggled` | `{iso, pinned}` | `cockpit/panel-history.jsx::handleTogglePin()` |
| `review_action` | `{action, id}` | `cockpit/panel-review.jsx::markReadAndAdvance()` |

**Règle** : ajouter un nouvel event_type nécessite de mettre à jour ce tableau AVANT le commit.

## Maintenance des specs Jarvis Lab (`docs/specs/`)

Chaque onglet du cockpit a un spec dédié dans `docs/specs/tab-<slug>.md`. L'index `docs/specs/index.json` liste les 25 onglets avec leur `last_updated` (date ISO). Le panel "Jarvis Lab" consomme ces deux sources en direct pour afficher la doc dans l'app, donc **toute dérive entre code et spec devient visible pour l'utilisateur**.

### Règle cardinale

Toute modification fonctionnelle ou technique d'un onglet (fichier code qui change une fonctionnalité, un comportement, un contrat de données, un élément UI notable) **doit** entraîner la mise à jour du `docs/specs/tab-<slug>.md` correspondant **dans le même commit**, jamais en lot différé.

Couvre : `cockpit/home.jsx`, `cockpit/panel-*.jsx`, `cockpit/styles-*.css`, ainsi que les modifs de `index.html`, des pipelines (`main.py`, `weekly_analysis.py`, `pipelines/*.py`), ou des migrations Supabase qui changent la source de données d'un onglet.

Exemptions (pas d'update doc nécessaire) : refacto interne strictement iso-fonctionnel, fix cosmétique sans changement d'UX, bump de version de dépendance. Dans le doute : mettre à jour.

### Checklist par modification

1. Ouvrir `docs/specs/tab-<slug>.md` correspondant et mettre à jour les sections concernées (Fonctionnalités, Parcours utilisateur, Front — structure UI, Back — sources de données, Limitations connues / TODO).
2. Mettre à jour la section `## Dernière MAJ` en bas du fichier avec la date du jour + un court changelog (1 ligne par modif notable).
3. Bumper `last_updated` dans `docs/specs/index.json` pour l'entrée du tab (format `YYYY-MM-DD`).
4. **Nouvel onglet** : copier `docs/specs/_template.md` vers `tab-<slug>.md`, remplir toutes les sections, ajouter l'entrée dans `index.json` avec `status: "documented"` ou `"stub"`.
5. **Onglet supprimé** : déplacer le `.md` dans `docs/specs/_archive/` (créer le dossier si absent) plutôt que de le supprimer, et passer l'entrée `index.json` à `status: "archived"` (ne pas retirer du tableau — garder la trace).

### Règle éditoriale section Fonctionnalités

La section `## Fonctionnalités` de chaque spec décrit **ce que l'utilisateur voit et fait**, pas comment c'est implémenté. Les détails techniques appartiennent aux sections `Front — structure UI` et `Back — sources de données`.

**Banni dans Fonctionnalités :**
- Chemins de fichier + ligne (`home.jsx:127`, `data-loader.js:1136`)
- Noms de composants JSX (`<SignalCard>`, `<RadarSVG>`)
- Props / variables / globals (`gap=true`, `data.signals`, `COCKPIT_DATA`, `window.X_DATA`)
- Noms de colonnes DB (`brief_html`, `mention_count`, `article_id`)
- Formules / heuristiques (`body.length / 280`, `94 - i*6`)
- Endpoints / SDK (`/rest/v1/articles`, `supabase.from(...)`)

**Format cible** :
```
- **<Nom feature>** : <ce que l'utilisateur voit> + <ce qu'il peut faire> + <besoin couvert>. 1-2 phrases max, vocabulaire produit.
```

Cette règle est **vérifiée automatiquement en CI** par le workflow `lint-specs` (voir section *Garde-fous automatiques* ci-dessous) — toute PR qui introduit du vocabulaire technique dans une section Fonctionnalités est bloquée.

### Règle éditoriale section Parcours utilisateur

La section `## Parcours utilisateur` de chaque spec raconte **ce que l'utilisateur fait pas à pas** — sa séquence d'actions et ce qu'il voit en retour —, pas le code qui tourne en dessous. Mêmes interdits que pour Fonctionnalités.

**Banni dans Parcours utilisateur :**
- Chemins de fichier + ligne (`home.jsx:127`, `data-loader.js:1136`)
- Noms de composants JSX (`<SignalCard>`, `<RadarSVG>`)
- Props / variables / globals (`gap=true`, `data.signals`, `COCKPIT_DATA`, `window.X_DATA`)
- Noms de colonnes DB (`brief_html`, `mention_count`, `article_id`)
- Endpoints / SDK (`/rest/v1/articles`, `supabase.from(...)`)
- Jargon infra (`Tier 1`, `Tier 2`, `bootTier1()`, `loadPanel("x")`, `localStorage.cle-technique`, `PATCH`/`POST`/`RPC`, `useEffect`…)

**Format cible** :
```
1. <Verbe d'action à l'utilisateur> — <ce qu'il voit en retour, vocabulaire produit>.
2. <Étape suivante> — …
```

Cette règle est **vérifiée automatiquement en CI** par le même workflow `lint-specs` que Fonctionnalités — toute PR qui introduit du vocabulaire technique dans une section Parcours utilisateur est bloquée.

### Mapping panel ↔ spec

Les 5 onglets Veille partagent `panel-veille.jsx` : une modif de ce fichier peut impliquer plusieurs specs simultanément.

| Spec | Source |
|---|---|
| tab-brief.md | home.jsx |
| tab-top/week/search.md | panel-top/week/search.jsx |
| tab-updates/sport/gaming-news/anime/news.md | panel-veille.jsx |
| tab-radar/recos/challenges/wiki/signals.md | panel-radar/recos/challenges/wiki/signals.jsx |
| tab-opps/ideas/jobs.md | panel-opportunities/ideas/jobs-radar.jsx |
| tab-jarvis/jarvis-lab/profile.md | panel-jarvis/jarvis-lab/profile.jsx |
| tab-perf/music/gaming.md | panel-forme/musique/gaming.jsx |
| tab-stacks/history.md | panel-stacks/history.jsx |

### Garde-fous automatiques

- **CI `spec-drift-check`** ([.github/workflows/spec-drift-check.yml](.github/workflows/spec-drift-check.yml)) — sur chaque PR, compare les fichiers modifiés : si du code d'onglet a bougé sans qu'aucun `docs/specs/tab-*.md` ne soit touché, émet des annotations GitHub `::warning::` sur les fichiers concernés. **Non-bloquant** au départ (`continue-on-error: true`) — on durcira après avoir mesuré le bruit. Une PR avec le check rouge ne doit pas merger sans justification explicite (refacto cosmétique…).
- **CI `validate-spec`** ([.github/workflows/validate-spec.yml](.github/workflows/validate-spec.yml)) — valide structurellement `jarvis/spec.json` ET la synchro entre `jarvis/spec.json::cockpit_tabs` et `docs/specs/index.json` (bloquant en `--strict`).
- **CI `lint-specs`** ([.github/workflows/lint-specs.yml](.github/workflows/lint-specs.yml)) — **bloquant** : fail toute PR qui introduit du vocabulaire technique dans une section `## Fonctionnalités` OU `## Parcours utilisateur`. Règles couvertes : chemins `.jsx/.py/.css`, composants JSX, globals `data.xxx`/`window.X`/`X_DATA`, colonnes DB `xxx_id/_at/_html` + whitelist spécifique, endpoints `/rest/v1/`, SDK `supabase.x`, props `key=value`, et jargon infra propre au cockpit (`Tier 1/2`, `bootTier`, `loadPanel`, `transformXxx`, `localStorage.xxx`, hooks React `useEffect`/`useState`/…). Règle éditoriale dure : les détails d'implémentation appartiennent à `Front — structure UI` / `Front — fonctions JS` / `Back — sources de données`, pas au récit produit. Script : [scripts/lint_specs_produit.py](scripts/lint_specs_produit.py).
- **Template de commit** ([.gitmessage](.gitmessage)) — pre-rempli avec une ligne `Specs mises à jour: tab-<slug> | aucune | N/A` à renseigner. Active-le localement une fois par clone :

  ```bash
  git config commit.template .gitmessage
  ```

  Ensuite, chaque `git commit` sans `-m` ouvre l'éditeur pré-rempli avec la checklist. Laisse la ligne `Specs mises à jour:` dans le commit final comme trace.

## Maintenance de l'architecture (`docs/architecture/`)

Le dossier `docs/architecture/` est la source de vérité versionnée pour la topologie du projet (couches, pipelines, dépendances, flows par domaine, décisions). Il est consommé en lecture par la section *Architecture* du panel Jarvis Lab (rendu SVG React) et par la CI (`validate-arch` bloquant + `arch-drift-check` warning).

### Règle cardinale

Toute PR qui touche un chemin à impact architectural **doit** mettre à jour le ou les fichiers de `docs/architecture/` **dans le même commit**. `arch-drift-check` détecte les dérives (warning-only au départ, durci après deux semaines).

Chemins à impact archi watchés par la CI :
- `sql/*.sql`, `jarvis/migrations/*.sql` (nouvelles tables, changement RLS)
- `pipelines/*.py`, `main.py`, `weekly_analysis.py`, `tft_pipeline.py` (pipelines backend)
- `.github/workflows/*-sync.yml`, `daily_digest.yml`, `weekly_analysis.yml`, `tft-sync.yml` (crons)
- `cockpit/lib/bootstrap.js`, `data-loader.js`, `supabase.js`, `auth.js` (data layer front)
- `cockpit/panel-*.jsx` (ajout / suppression détecté via `git diff --name-status`)
- `jarvis/server.py`, `jarvis/nightly_learner.py`, `jarvis/indexer.py`, `jarvis/status_generator.py`, `jarvis/observers/*.py` (composants Jarvis locaux)

### Checklist par type de modification

| Type de modif | Fichiers à éditer dans le même commit |
|---|---|
| **Nouveau pipeline** (script + workflow + cron) | `docs/architecture/pipelines.yaml` (entrée pipelines[]) + `docs/architecture/flows/<domaine>.yaml` (ou création) + `docs/architecture/dependencies.yaml` si le pipeline crée de nouvelles tables + `docs/architecture/decisions.md` si choix structurant |
| **Nouveau panel** | `docs/architecture/dependencies.yaml` (entrée panels[] avec file + reads + writes) + `docs/architecture/layers.yaml` uniquement si impact topologique (rare) + `docs/specs/tab-<slug>.md` (cf. section specs) |
| **Suppression d'un panel ou d'un pipeline** | Retirer de `dependencies.yaml` + `pipelines.yaml` ; archiver le flow associé en `status: archived` dans `docs/architecture/flows/<domaine>.yaml` |
| **Nouvelle table Supabase** | `docs/architecture/dependencies.yaml` (entrée tables[] avec owner_pipeline + rls + domain) + mise à jour des panels/flows qui la lisent ou l'écrivent |
| **Changement de RLS** | `docs/architecture/dependencies.yaml::tables[].rls` (enum `authenticated` / `service_role` / `public`) |
| **Nouveau secret / variable d'env** | `docs/architecture/decisions.md` entrée dédiée + mention dans la section *GitHub Secrets* de ce CLAUDE.md |
| **Nouveau service local** (ex : 2e modèle LM Studio, nouvel observer) | `docs/architecture/layers.yaml` (couche middle) + `docs/architecture/decisions.md` |
| **Refacto cosmétique / iso-fonctionnel** | Aucun fichier archi à toucher |

### Grammaire de routage des diagrammes en couches

`layers.yaml` ne spécifie pas les positions (x, y) — le renderer les calcule depuis l'ordre de `boxes[]` dans chaque couche. La discipline de routage est stricte :

- **3 couches** empilées (front / middle / back) séparées par 2 gutters. Labels des couches écrits **à gauche, verticaux** (rotate -90). Jamais de texte horizontal dans les layer-bg (collisions avec les arêtes).
- **Colonnes alignées** : les composants qui se parlent directement (panels / jarvis_api / supabase) sont tous sur la colonne 1 pour que leurs arêtes restent droites.
- **3 types d'arêtes, 3 couloirs** :
  - `cross_layer` → rail vertical à droite (x ≈ 1014, **hors** des layer-bg), accent orange, L-shape par-dessus. Pour les sauts de couche (front → back).
  - `adjacent` → couloir vertical entre deux couches voisines, segment droit + virages à 90° au milieu du gutter.
  - `intra_layer` → flèche horizontale courte entre deux boîtes de la même couche.
- Chaque label d'edge a un `<rect edge-label-bg>` opaque derrière le texte pour ne jamais se superposer au trait.
- Pas de diagonales. Jamais.

Le renderer utilise les CSS variables globales `--brand`, `--tx`, `--tx2`, `--tx3`, `--bd`, `--surface`, `--bg2`, `--bg3` → le diagramme s'adapte automatiquement aux 3 thèmes Dawn / Obsidian / Atlas.

### Garde-fous CI

- **CI `validate-arch`** ([.github/workflows/validate-arch.yml](.github/workflows/validate-arch.yml)) — **bloquant**. Run [scripts/validate_architecture.py](scripts/validate_architecture.py) qui valide les schémas des 4 YAML (layers, pipelines, dependencies, flows/*), vérifie que chaque `workflow_file` + `script` + `panel.file` existe réellement, que les edges de `layers.yaml` pointent vers des boxes déclarées, et que les tables référencées dans `panels.reads/writes` existent dans `tables[]`. Fail = YAML à réparer.
- **CI `arch-drift-check`** ([.github/workflows/arch-drift-check.yml](.github/workflows/arch-drift-check.yml)) — **non-bloquant au départ** (`continue-on-error: true`). Compare les fichiers modifiés de la PR au pattern *chemins à impact archi*. Si un match est trouvé et que `docs/architecture/` n'est pas touché, remonte un `::warning::` par fichier avec un hint contextuel (nouveau panel → dependencies.yaml, nouveau pipeline → pipelines.yaml + flows/…). À durcir en bloquant après deux semaines d'observation.

## Conventions

- Le site est en React 18 + `@babel/standalone` via CDN unpkg — no build step, ouvrable directement en file:// pour itérer
- Les composants vivent dans `cockpit/` (jsx compilés en browser via Babel `type="text/babel"`). Chaque composant s'expose sur `window.X` pour être visible des autres scripts (pas d'imports ES modules — incompatible avec Babel standalone)
- L'entrée est `cockpit/lib/bootstrap.js` → waitForAuth → bootTier1 → `window.__cockpitMount()` monte `<App/>` dans `#root`
- Les panels consomment `window.COCKPIT_DATA.*` (Tier 1, rempli avant mount) et les globals `window.X_DATA` (Tier 2, mutés à la navigation)
- La publishable key Supabase est en dur dans `cockpit/lib/supabase.js` (c'est une clé publique)
- CSP requiert `'unsafe-eval'` pour Babel standalone — c'est le coût du build-less
- Le main.py utilise Gemini Flash-Lite (gratuit, 1000 req/jour)
- Le weekly_analysis.py utilise Claude Haiku 4.5 avec un budget max de 1$/run
- Le CostTracker dans weekly_analysis.py arrête le pipeline si le budget est dépassé
- Le `user_profile` et le `skill_radar` sont injectés comme contexte dans tous les prompts Claude
- Les logs pipelines locaux vivent dans `jarvis_data/*.log` (pas `jarvis/logs/`)

## Weekly Pipeline

Le projet tourne un pipeline hebdomadaire en 3 étapes séquentielles, chacune en tâche planifiée indépendante. Toutes les étapes communiquent via des fichiers sur disque (pas d'orchestrateur central), ce qui garantit la robustesse en cas d'échec partiel.

### Calendrier

| Heure  | Étape | Outil   | Input                                              | Output                                  |
|--------|-------|---------|----------------------------------------------------|-----------------------------------------|
| 05h30  | 1     | Python  | Supabase, git, jarvis_data/logs                    | `jarvis/intel/YYYY-MM-DD-signals.md`    |
| 06h00  | 2     | Cowork  | project_status.yaml, dernier audit                 | `jarvis/intel/YYYY-MM-DD-veille.md`     |
| 07h00  | 3     | Cowork  | signals.md + veille.md + CLAUDE.md + INDEX.md      | `jarvis/upgrades/YYYY-MM-DD-audit.md`   |

### Marges et fail-safe

- 30 min entre étape 1 et 2 (le script Python prend ~30s, marge de sécurité large)
- 1h entre étape 2 et 3 (la veille Cowork peut occasionnellement prendre 5-8 min)
- Chaque tâche Cowork (étapes 2 et 3) DOIT vérifier que ses fichiers d'entrée portent la date d'aujourd'hui. Si elle lit un fichier daté d'un autre jour, elle s'arrête et log une erreur.

### Lancement manuel

```
python jarvis/scripts/extract_signals.py
# puis lancer manuellement les 2 tâches Cowork via l'interface
```

### Règles de détection d'anomalies (extract_signals.py)

Le script applique 8 règles d'anomalies pour transformer les statistiques brutes
en signaux exploitables par l'audit. Une anomalie est levée quand l'observé dévie
significativement de l'attendu, pas sur des seuils absolus arbitraires.

Liste : sous-utilisation cockpit, sections mortes, erreurs récurrentes, engagement
faible, recherche désertée, pipeline cassé, aucun commit, section inconnue détectée.

"RAS" en sortie signifie qu'aucune des 8 règles n'a déclenché. Si tu trouves le
script trop ou pas assez sensible, ajuste les seuils dans `extract_signals.py`
(constantes en haut de fichier).

## Décisions de design

- **Pas de max-width sur le contenu** — le cockpit utilise toute la largeur disponible
- **Gemini pour le volume, Claude pour l'intelligence** — architecture hybride pour minimiser les coûts
- **Opportunités vs Maturité** — on a remplacé la grille statique de maturité par un radar d'opportunités dynamique alimenté par l'actualité
- **Profil qualitatif** — le radar stocke des forces/lacunes textuelles en plus des scores numériques
- **Signaux groupés par tendance** — rising/new en haut (à surveiller), stable au milieu, declining en bas

### TFT Tracker
- **Pas d'augments** — retirés de l'API par Riot, on ne les stocke pas
- **Lobby dénormalisé** — une table plate `tft_match_lobby` avec main_traits/main_carry pré-calculés, pas de sous-tables units/traits pour les adversaires (trop de données, peu de valeur analytique)
- **Noms nettoyés + IDs bruts conservés** — `champion_name` = "Vayne" (strip `TFT{N}_`), `character_id` = "TFT16_Vayne" (brut). Idem pour traits et items. Permet l'affichage propre tout en gardant la traçabilité API
- **raw_payload = participant uniquement** — le JSONB dans `tft_matches` ne contient que le JSON du participant du joueur, pas le lobby complet (économie de stockage, le lobby est dans sa propre table)
- **Service role key pour l'écriture** — tous les pipelines backend utilisent la service_role key pour bypasser RLS (pas de session auth.uid()). Le front utilise un JWT Google OAuth pour la lecture

## Module Jarvis (assistant local)

### Vision

Assistant IA personnel local ("Jarvis") qui :
1. **Connaît la base de connaissances** via RAG sur Supabase pgvector (articles, wiki, opportunités, idées, RTE, profil)
2. **Apprend de lui-même** : extraction nocturne des faits, entités et préférences depuis les conversations
3. **Observe l'activité** : capteur de fenêtre active (Windows) + brief quotidien automatique à 18h. Prochaines étapes : Teams, emails, fichiers
4. **Route intelligemment** entre LLM local (90% des tâches) et API cloud Claude/Gemini (tâches complexes) pour rester sous 3€/mois

### Stack technique Jarvis

- **LM Studio** en serveur local sur `http://localhost:1234/v1` (compatible OpenAI API)
- **LLM unique (chat + extraction JSON)** : Qwen3.5 9B Q4_K_M (~5.5 Go VRAM, slug `qwen/qwen3.5-9b`) — instruct pur, **pas de thinking**. Utilisé par `/chat` (modes Rapide/Deep), `_compact_history`, `daily_brief_generator`, `status_generator`, et `nightly_learner` (extraction faits + entités). Un seul modèle chargé évite les conflits de slot LM Studio entre chat utilisateur et tâches de fond.
- **Embeddings** : Qwen3-Embedding-0.6B Q8_0 (~640 Mo, slug `qwen/qwen3-embedding-0.6b`) — vecteurs 1024-dim pour `memories_vectors` (RAG, indexation, recherche sémantique)
- **Vector store** : Supabase pgvector (1024-dim, table `memories_vectors`)
- **Hardware** : RTX 5070 Laptop **8 Go VRAM dédiée** (+ 15.9 Go Shared via PCIe), 32 Go RAM, Windows. 2 modèles chargés (LLM 9B + embedding 0.6B) pèsent ~6.1 Go — il reste ~1.9 Go pour le KV cache, OK tant que le contexte chat reste sous ~4k tokens. Throughput cible 30-40 tok/s sur le 9B. Si le throughput chute sous 10 tok/s c'est que la VRAM déborde en Shared (inférence 10-50× plus lente) — réduire le context ou décharger temporairement l'embedding model.
- **Note historique** : avant 2026-04-25, la stack utilisait Qwen3 4B Thinking 2507 + Qwen3 4B Instruct 2507 + embedding (3 modèles). La VRAM était saturée et les chats Deep dépassaient régulièrement le timeout cockpit 120s. Switch vers un seul modèle 9B instruct = plus d'overhead thinking, plus de slot contention nightly_learner ↔ chat. `/no_think` dans les system prompts est devenu un no-op inoffensif (le modèle ignore l'instruction).

### Structure du module

```
jarvis/
├── __init__.py
├── config.py              # Config centralisée
├── supabase_client.py     # Client REST Supabase (sb_get, sb_post, sb_rpc)
├── embeddings.py          # Génération de vecteurs via Qwen3-Embedding-0.6B
├── indexer.py             # CLI d'indexation des tables → memories_vectors
├── retriever.py           # Recherche sémantique (search, search_and_format)
├── server.py              # FastAPI server (localhost:8765) — gateway cockpit→LLM+RAG
├── check_index_freshness.py # Vérifie si l'indexation est nécessaire (compare COUNTs)
├── start_jarvis.bat       # Script de démarrage Windows (check LM Studio, index, serve)
├── test_jarvis.py         # Test du LLM local
├── test_rag.py            # Test end-to-end du RAG
├── migrations/
│   ├── 001_enable_pgvector.sql
│   ├── 002_jarvis_status_snapshot.sql
│   ├── 003_structured_memory.sql
│   └── 004_activity_briefs.sql
├── nightly_learner.py         # Extraction nocturne faits+entités (idempotent, scheduler asyncio)
├── observers/
│   ├── __init__.py
│   ├── window_observer.py     # Capteur fenêtre active (ctypes, 30s, JSONL local)
│   ├── outlook_observer.py    # Capteur Outlook COM (réunions, emails, 5min, JSON local)
│   └── daily_brief_generator.py # Génère brief d'activité via LLM → Supabase

jarvis_data/               # Données perso, non versionné (activity_*.jsonl, outlook_*.json, state files)
```

### Phasage

- **Phase 1** : LM Studio + premier test Python *(done)*
- **Phase 2** : RAG Supabase (pgvector + indexation) *(done)*
- **Phase 2.5** : Intégration cockpit web (server.py + onglet Jarvis dans index.html) *(done)*
- **Phase 3** : Mémoire structurée *(done)*
- **Phase 4** : Orchestrateur (routeur LLM local/cloud) *(done)*
- **Phase 5** : Boucle nocturne d'apprentissage *(done)*
- **Phase 6** : Capteurs d'observation *(done)*

### Conventions Jarvis

- Toujours désactiver thinking mode (`/no_think`) sauf pour raisonnement complexe explicite
- LLM local pour : tagging, classification, résumés, RAG, conversation
- Claude API / Gemini pour : analyses stratégiques complexes, tâches au-delà du local
- Logger les coûts API cloud dans la table `weekly_analysis` existante
- Données d'observation perso dans `jarvis_data/` (jamais commit)
- Port 8765 réservé pour le serveur Jarvis (FastAPI)
- Aucune clé Supabase dans index.html pour Jarvis — tout passe par server.py côté Python
- `start_jarvis.bat` est le point d'entrée unique (check LM Studio → check fraîcheur index → tunnel Cloudflare → lance serveur)
- Architecture cockpit : `index.html → POST /chat → server.py → routeur (local LM Studio OU Claude Haiku cloud) → réponse JSON`
- **3 modes chat** : Rapide (local, pas de RAG, 512 tokens), Deep (local + RAG, 2048 tokens), Cloud (Claude Haiku + RAG, 4096 tokens, ~0.01$/requête)
- Le mode Cloud nécessite `ANTHROPIC_API_KEY` en variable d'environnement. Sans la clé, fallback automatique sur le LLM local
- **Cloudflare Tunnel** : `cloudflared tunnel --url http://localhost:8765` expose le serveur sur internet (HTTPS)
- L'URL du tunnel est sauvegardée dans `user_profile.jarvis_tunnel_url` par `start_jarvis.bat`
- `index.html` découvre l'URL automatiquement : essaie localhost d'abord, puis lit le tunnel depuis Supabase
- Accessible depuis GitHub Pages et depuis mobile via le tunnel

### Tables Supabase Jarvis

**Créées (Phase 2) :**
- `memories_vectors` — RAG vectoriel unifié (source_table, source_id, chunk_text, embedding vector(1024), metadata JSONB)
  - Fonction RPC `match_memories(query_embedding, match_threshold, match_count, filter_source_table)` pour recherche sémantique
  - Index IVFFlat cosine, RLS public
  - Tables sources indexées : articles, wiki_concepts, weekly_opportunities, business_ideas, rte_usecases, user_profile

**Créées (Phase 3) :**
- `jarvis_conversations` — messages bruts sauvegardés en temps réel (session_id, role, content, mode, tokens_used). Chaque échange user/assistant est écrit immédiatement via le endpoint /chat.
- `profile_facts` — faits structurés sur l'utilisateur (fact_type, fact_text, confidence, superseded_by). Extraits par `nightly_learner.py`, injectés dans le system prompt de chaque conversation.
- `entities` — personnes, projets, outils, entreprises mentionnés (entity_type, name, description, mentions_count). Extraits par `nightly_learner.py`.
- Migration : `jarvis/migrations/003_structured_memory.sql`
- **`jarvis/nightly_learner.py`** — Script d'extraction nocturne multi-source idempotent. Sources : conversations Jarvis, activité fenêtre (JSONL), Outlook (JSON). Extensible pour Strava, etc. Checkpoint par source dans `jarvis_data/nightly_learner_state.json`. Envoie chaque bloc à `qwen3-4b-2507` (non-thinking) pour extraction JSON (faits + entités), upsert dans les tables, reindex via indexer.py. Déclenché automatiquement à minuit par le scheduler asyncio dans server.py, au démarrage via start_jarvis.bat, ou manuellement via `POST /nightly-learner` ou `python jarvis/nightly_learner.py --days=N`.

**Créées (Phase 6) :**
- `activity_briefs` — briefs d'activité quotidiens (date unique, brief_html, stats JSONB). Seul le résumé y est stocké, pas les données brutes.
- Migration : `jarvis/migrations/004_activity_briefs.sql`
- **`jarvis/observers/window_observer.py`** — Capteur de fenêtre active via `ctypes.windll` (Windows). Capture toutes les 30s, déduplique par changement de titre, stocke en JSONL local (`jarvis_data/activity_YYYY-MM-DD.jsonl`). Catégorise automatiquement (dev/communication/browsing/documents/other). Démarré automatiquement avec le serveur.
- **`jarvis/observers/outlook_observer.py`** — Capteur Outlook via COM automation (`pywin32`). Connecté à l'instance Outlook desktop locale, pas besoin d'Azure AD. Poll toutes les 5 min. Collecte : réunions du jour (sujet, durée, Teams?, participants), emails (reçus/envoyés/non lus). Stocke un snapshot JSON local (`jarvis_data/outlook_YYYY-MM-DD.json`). Les sujets de réunions restent locaux. Nécessite `pywin32` et Outlook desktop ouvert.
- **`jarvis/observers/daily_brief_generator.py`** — Génère un brief HTML à partir de l'activité du jour (window + Outlook fusionnés) : stats par catégorie, réunions, emails, top apps, timeline, résumé narratif via LLM local. Upsert dans `activity_briefs`. Déclenché à 18h par scheduler asyncio ou manuellement via `POST /generate-activity-brief`.
- Les données brutes d'activité restent **locales** dans `jarvis_data/` (privacy-first). Seul le brief résumé va dans Supabase.

### Cockpit — Section Projet Jarvis

La section "Projet Jarvis" dans le cockpit affiche l'avancement du projet en temps quasi-réel :

- **`jarvis/project_status.yaml`** — Source de vérité déclarative des 6 phases. Éditée à la main quand une phase évolue (typiquement ~1x/semaine). Contient les bullets, statuts, critères de réussite et le `next_step`.
- **`jarvis/status_generator.py`** — Script qui charge le YAML, enrichit avec des données live (chunks Supabase, stats Git, coût API), génère un paragraphe en prose via Jarvis local (LM Studio), et upsert le snapshot dans Supabase. Lancé automatiquement par `start_jarvis.bat` en arrière-plan, ou manuellement via `python jarvis/status_generator.py`. Nécessite `SUPABASE_SERVICE_KEY` en env var.
- **`jarvis_status_snapshot`** — Table Supabase à une seule ligne (id=1, contrainte CHECK). Le frontend la lit en anon, le générateur l'écrit en service_role. Migration : `jarvis/migrations/002_jarvis_status_snapshot.sql`.
- **Sections 2 (Veille ciblée) et 3 (Miroir gênant)** — Stubs HTML en place (`display:none`), à implémenter plus tard.

## Bugs connus / Améliorations possibles

- Certains RSS ne publient pas quotidiennement (LLMs, Énergie souvent à 0)
- Le HTML brut dans les summaries est strippé côté JS mais pas toujours côté Python (anciens articles)
- Le diagnostic du radar ne peut être refait qu'en remettant les scores à 0 en base
- Les challenges n'ont pas encore de bouton "Marquer comme complété" côté front
- La carte des concepts (graphe de relations entre concepts wiki) n'est pas encore implémentée
