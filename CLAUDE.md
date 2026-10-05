# AI Cockpit — CLAUDE.md

> **Maintenance de ce fichier** — 200 lignes max. Contient uniquement des **règles** et des **pointeurs**, jamais d'inventaires (tables, pipelines, secrets, events) qui vivent dans `docs/`. Avant d'ajouter une section : "est-ce que ça pourrait vivre dans un fichier de `docs/` ?" Si oui, déplace-le et garde ici une ligne `Sujet → docs/x.md`. CI `lint-claude-md` ([scripts/lint_claude_md.py](scripts/lint_claude_md.py), [workflow](.github/workflows/lint-claude-md.yml)) — **bloquante** depuis le 2026-08-31. Slim down initial : 611 → 100 lignes (2026-05-18).

## Vue d'ensemble

Cockpit IA personnel pour un manager en transformation digitale :
1. Veille IA quotidienne automatisée + 4 corpus RSS satellites perso (sport, gaming, anime, actualités)
2. Montée en compétence IA mesurable (radar, challenges, recos, wiki, signaux faibles)
3. Opportunités business (carnet d'idées, opps, Jobs Radar LinkedIn)
4. Vie perso (Strava/Withings, Last.fm, Steam/TFT)
5. Assistant IA local Jarvis (chat + RAG + observers + nightly learner)

## Utilisateur

- **Rôle** : Release Train Engineer (RTE) du train Vente chez Malakoff Humanis (mutuelle/assurance), contexte SAFe (équipes CRM, outils d'aide à la vente, portail d'accès)
- **Background** : Manager PwC Digital
- **Ambition** : devenir expert IA, potentiellement créer sa boîte — pas encore d'idée précise
- **Profil complet** : Supabase `user_profile` (key/value)
- **Compétences IA** : Supabase `skill_radar` (8 axes scores + forces + lacunes)

## Stack en une phrase

Front React 18 + Babel standalone via CDN (no build step), GitHub Pages → Supabase Postgres (RLS `authenticated`) + Gemini Flash-Lite (volume, gratuit) + Claude Haiku (intelligence, hebdo) + Jarvis local (LM Studio sur RTX 5070 8 Go VRAM). 32 onglets côté cockpit. Arborescence détaillée : [docs/architecture/repo-structure.md](docs/architecture/repo-structure.md). Topologie déclarative : [docs/architecture/layers.yaml](docs/architecture/layers.yaml). Sidebar canonique : [cockpit/nav.js](cockpit/nav.js).

## Commandes

Vérifiées le 2026-08-31 : les 5 linters passent, les 29 tests passent.

- **Les 5 linters bloquants**, avant tout push :
  `PYTHONUTF8=1 sh -c 'for s in lint_claude_md lint_known_sections lint_specs_produit validate_architecture validate_spec; do python scripts/$s.py || exit 1; done'`
  `PYTHONUTF8=1` n'est pas décoratif : sans lui, un `UnicodeEncodeError` cp1252 sur un emoji tue le script **avant** qu'il n'imprime son verdict — ça a masqué un vrai échec le 2026-08-20.
- **Tests** (29 fichiers, CI `tests` bloquante). Pas de pytest, pas de runner : chaque fichier est un script qui sort en 1 si un check échoue.
  `for f in tests/test_*.mjs; do node "$f" || break; done` puis `for f in tests/test_*.py; do PYTHONUTF8=1 python "$f" || break; done`
- **Service worker** : `node scripts/sync-sw.mjs` (voir règle cardinale plus bas).

## Périmètre de travail

- Fais ce qui est demandé, pas le voisinage. Un problème adjacent se signale en une ligne, il ne se corrige pas dans le même commit.
- Une instruction porte sur ce qu'elle nomme : ne l'étends pas aux autres onglets, pipelines ou specs sans le dire explicitement.
- **Ce dépôt est public** — tout push y est une publication. Le `.gitignore` bloque les exports bureautiques depuis qu'une branche en a publié deux le 2026-04-28.

## Règles cardinales (toujours dans le même commit que le code)

### Maintenance specs Jarvis Lab
Toute modif fonctionnelle d'un onglet → MAJ `docs/specs/tab-<slug>.md` + bump `last_updated` dans `docs/specs/index.json`. Exemptions : refacto iso-fonctionnel, fix cosmétique, bump deps.
Détails (mapping panel↔spec, règles éditoriales Fonctionnalités/Parcours, garde-fous CI `lint-specs` bloquant) : [docs/specs/MAINTENANCE.md](docs/specs/MAINTENANCE.md).

### Maintenance archi
Toute PR touchant pipeline/panel/migration SQL/cron/composant Jarvis → MAJ correspondante dans `docs/architecture/` (`pipelines.yaml`, `dependencies.yaml`, `layers.yaml`, `flows/`, `decisions.md`).
Checklist par type de modif + garde-fous CI (`validate-arch` bloquant, `arch-drift-check` warning) : [docs/architecture/README.md](docs/architecture/README.md).

### Ajout d'un onglet
La checklist des 7 emplacements fait foi en tête de [cockpit/nav.js](cockpit/nav.js) — la lire avant de commencer, pas après. L'étape 7 (`KNOWN_SECTIONS` dans `jarvis/scripts/extract_signals.py`) est celle qu'on oublie et elle rend la CI rouge.

### Service worker
Après modif `index.html`, `mediatheque.html`, `cockpit/**`, `manifest*.json` ou `assets/**` → `node scripts/sync-sw.mjs` (ou auto via [.github/workflows/sw-sync.yml](.github/workflows/sw-sync.yml)). Ne jamais éditer `STATIC[]` ou `CACHE` à la main.

### Télémétrie
Tout nouvel `event_type` → entrée dans [docs/telemetry.md](docs/telemetry.md) AVANT le commit + appel `track('type', payload)` dans le code. Schéma `usage_events` ouvert (JSONB), pas de migration.

### Secrets
Tout nouveau secret GitHub Actions → entrée dans [docs/secrets.md](docs/secrets.md) + entrée ADR dans [docs/architecture/decisions.md](docs/architecture/decisions.md) si décision structurante.

## Sécurité

- **Auth obligatoire avant mount** : `cockpit/lib/bootstrap.js` (cockpit) et son équivalent `cockpit/lib/boot-mediatheque.js` (PWA `mediatheque.html`) attendent chacun `cockpitAuth.waitForAuth()` AVANT tout mount React. JWT injecté dans les headers REST, rotation auto sur `TOKEN_REFRESHED`.
- **RLS `authenticated`** : toutes les tables exigent un utilisateur connecté pour SELECT (migration `sql/006_rls_authenticated.sql`). Plus d'exception depuis `sql/036` : `jobs` / `job_scans` sont aussi fermées à anon (la routine Jobs Radar écrit via MCP, hors RLS — ADR-53). Les inscriptions Supabase sont fermées : `authenticated` = le propriétaire seul.
- **Pipelines backend = `SUPABASE_SERVICE_KEY` uniquement** (bypass RLS). Jarvis refuse de démarrer sans.
- **XSS** : DOMPurify via helper `safe()`. **CSP** : meta tag restrictif (`frame-src: none`, `'unsafe-eval'` requis pour Babel standalone).

## Data layer front

- **Tier 1 (bloquant, avant mount)** — `cockpit/lib/data-loader.js::bootTier1()` fetch en parallèle : `articles` jour, `daily_briefs`, `skill_radar`, `signal_tracking`, `user_profile`, `articles` 30j, `weekly_analysis` 8 sem. Construit `window.COCKPIT_DATA` + hydrate `APPRENTISSAGE_DATA.radar`, `PROFILE_DATA`, `SIGNALS_DATA`. Ne concerne que l'entrée cockpit (`bootstrap.js`) : `boot-mediatheque.js` (page `mediatheque.html`) saute Tier 1 et monte directement sur Tier 2 seul.
- **Tier 2 (lazy, au clic sidebar)** — `loadPanel(id)` fetch le corpus, mute `window.X_DATA`, résout la promesse. Re-render forcé via `dataVersion` dans `app.jsx` (`panelKey = activePanel + ":" + dataVersion`). Mémoïsé via `once()`.

## Conventions code

- React 18 + `@babel/standalone` via unpkg, no build step, ouvrable en `file://` pour itérer. Composants exposés sur `window.X` (pas d'imports ES modules — incompatible Babel standalone). Entrée : `cockpit/lib/bootstrap.js` → waitForAuth → bootTier1 → `window.__cockpitMount()` (deuxième entrée PWA `mediatheque.html` : `cockpit/lib/boot-mediatheque.js`, sans Tier 1).
- Panels consomment `window.COCKPIT_DATA.*` (Tier 1) et `window.X_DATA` (Tier 2).
- Publishable Supabase key en dur dans `cockpit/lib/supabase.js` (c'est une clé publique).
- Pas de `max-width` sur le contenu — le cockpit utilise toute la largeur dispo.
- Gemini = volume (`main.py` Flash-Lite gratuit, 1000 req/jour). Claude = intelligence (`weekly_analysis.py` Haiku 4.5, budget 1$/run, `CostTracker` arrête si dépassé).
- `user_profile` et `skill_radar` injectés comme contexte dans tous les prompts Claude.
- Logs pipelines locaux : `jarvis_data/*.log` (pas `jarvis/logs/`).

## Décisions de design

- **Opportunités vs Maturité** — la grille de maturité statique a été remplacée par un radar d'opportunités dynamique alimenté par l'actualité
- **Profil qualitatif** — le radar stocke des forces/lacunes textuelles en plus des scores
- **Signaux groupés par tendance** — rising/new en haut, stable au milieu, declining en bas
- **TFT Tracker** — pas d'augments (retirés de l'API Riot) ; lobby dénormalisé (plate, pré-calculé) ; noms nettoyés + IDs bruts conservés ; `raw_payload` = participant uniquement, pas le lobby
- **Service role pour l'écriture backend** — pipelines bypass RLS via service_role key, front utilise JWT Google OAuth pour la lecture
- ADR complet : [docs/architecture/decisions.md](docs/architecture/decisions.md)

## Bugs connus / Améliorations possibles

- Une section RSS à 0 n'est pas un rythme de publication : le 2026-08-21, 17 des 43 flux étaient morts (404/403/XML cassé), tous remplacés depuis. Avant de conclure « ils ne publient pas », lire les lignes `[DEAD]` du dernier run.
- Un seuil calibré en local est faux sur le runner (IP datacenter bloquée par certains CDN) — ADR-44
- Le HTML brut dans les summaries est strippé côté JS mais pas toujours côté Python (anciens articles)
- Le diagnostic du radar ne peut être refait qu'en remettant les scores à 0 en base
- La carte des concepts (graphe de relations entre concepts wiki) n'est pas encore implémentée

## Pointeurs vers la doc longue

| Sujet | Fichier |
|---|---|
| Arborescence repo + rôle des fichiers | [docs/architecture/repo-structure.md](docs/architecture/repo-structure.md) |
| Topologie front/middle/back (source diagramme) | [docs/architecture/layers.yaml](docs/architecture/layers.yaml) |
| Pipelines + crons GitHub Actions | [docs/architecture/pipelines.yaml](docs/architecture/pipelines.yaml) |
| Tables Supabase + matrice panel↔table + RLS | [docs/architecture/dependencies.yaml](docs/architecture/dependencies.yaml) |
| Flows par domaine (veille-ia, jarvis-rag, perso-strava…) | [docs/architecture/flows/](docs/architecture/flows/) |
| ADR (décisions versionnées) + grammaire routage diagrammes | [docs/architecture/decisions.md](docs/architecture/decisions.md), [docs/architecture/README.md](docs/architecture/README.md) |
| GitHub Secrets (liste + usage) | [docs/secrets.md](docs/secrets.md) |
| Telemetry events (`usage_events` instrumentés) | [docs/telemetry.md](docs/telemetry.md) |
| Module Jarvis (vision, stack, observers, tables, phases, troubleshooting) | [jarvis/README.md](jarvis/README.md) |
| Weekly pipeline (signals/veille/audit, calendrier, fail-safe) | [docs/weekly-pipeline.md](docs/weekly-pipeline.md) |
| Specs onglets (31 fichiers + index + template) | [docs/specs/](docs/specs/) |
| Règles éditoriales specs + maintenance | [docs/specs/MAINTENANCE.md](docs/specs/MAINTENANCE.md) |
| Sidebar — source canonique nav (6 groupes, 32 onglets) | [cockpit/nav.js](cockpit/nav.js) |
| Setup pipelines API perso | [docs/strava-setup.md](docs/strava-setup.md) · [docs/withings-setup.md](docs/withings-setup.md) · [docs/lastfm-setup.md](docs/lastfm-setup.md) · [docs/steam-setup.md](docs/steam-setup.md) |
