# Architecture Decision Records (léger)

Format court : **Contexte** (pourquoi se pose la question) → **Décision** (ce qu'on fait) → **Conséquences** (coûts / contraintes / choix que ça ferme). Datées, pas numérotées — l'ordre chronologique suffit.

## ADR-01 · 2025-Q4 · Hébergement front sur GitHub Pages

- **Contexte** : besoin d'un cockpit perso déployable sans infra, pas de build CI lourd, accessible depuis mobile.
- **Décision** : GitHub Pages servit en statique, coquille `index.html` + React 18 via `@babel/standalone` sur unpkg. No-build-step.
- **Conséquences** : CSP doit autoriser `unsafe-eval` (Babel standalone) ; pas de tree-shaking ; chaque `.jsx` expose son composant sur `window.X` pour être visible par les autres scripts ; itération possible en `file://` local sans serveur.

## ADR-02 · 2025-Q4 · Supabase comme backend unique

- **Contexte** : stockage structuré des articles, métriques et conversations + auth Google + RLS granulaire, sans ouvrir un serveur perso.
- **Décision** : Supabase free tier, Postgres + pgvector + Auth Google + Realtime. Toute la donnée structurée y vit.
- **Conséquences** : une seule cible de RLS à auditer ; quotas 500 MB / 50k MAU à surveiller (panel Stacks) ; dépendance cloud unique — si Supabase tombe, Jarvis local reste dispo mais le cockpit lit vide.

## ADR-03 · 2026-Q1 · Split Gemini (daily) / Claude (weekly)

- **Contexte** : la veille quotidienne traite ~150 articles / jour (enrichissement, classification, brief) — incompatible avec le budget Claude. Mais les analyses hebdo (signaux, opportunités, challenges, recos) demandent un modèle de bien meilleure qualité.
- **Décision** : Gemini 2.5 Flash-Lite (free tier 1000 req/jour) pour tout le volume daily. Claude Haiku 4.5 (budget ~0,03 $/run, cap 1 $) pour la cognition hebdo.
- **Conséquences** : deux clients, deux clés, deux pipelines à logger distinctement (tables `gemini_api_calls` + `weekly_analysis.tokens_used`). Panel Stacks agrège les deux. Si Gemini tombe, le daily a un fallback `_fallback_brief_html` qui construit un brief minimal depuis les articles RSS.

## ADR-04 · 2026-Q1 · Pipelines backend en `service_role`, front en `authenticated`

- **Contexte** : les pipelines GitHub Actions tournent sans session `auth.uid()` — ils ne peuvent pas être des utilisateurs `authenticated`. Le front lui a une session Google OAuth.
- **Décision** : migration `sql/006_rls_authenticated.sql` — toutes les tables exigent `authenticated` pour SELECT. Les 4 tables éditables côté front (`business_ideas`, `user_profile`, `skill_radar`, `tft_matches`) ont aussi INSERT/UPDATE `authenticated`. Les pipelines utilisent `SUPABASE_SERVICE_KEY` qui bypass RLS.
- **Conséquences** : anon ne peut plus rien lire (fini le partage public du cockpit sans login) ; `start_jarvis.bat` refuse de démarrer sans `SUPABASE_SERVICE_KEY` en env ; chaque nouvelle table ajoutée doit explicitement configurer ses policies (cf. migrations récentes).

## ADR-05 · 2026-Q1 · Data layer front à deux tiers

- **Contexte** : certains panels (Brief, Ma semaine, Radar) doivent s'afficher instantanément au premier écran. Les autres peuvent charger à la demande. Charger 40 tables au boot = latence inacceptable.
- **Décision** : **Tier 1** (bootstrap.js → bootTier1) charge 7 tables en parallèle AVANT le mount React ; **Tier 2** (loadPanel) charge le corpus d'un panel à son premier clic sidebar, mémoïsé via `once()` le reste de la session.
- **Conséquences** : chaque panel déclare explicitement s'il est Tier 1 ou Tier 2 ; cache Tier 2 est invalidé seulement au reload (pas de cache busting sélectif) ; un nouveau panel par défaut est Tier 2 sauf décision contraire.

## ADR-06 · 2026-Q1 · Jarvis local FastAPI + tunnel Cloudflare optionnel

- **Contexte** : on veut un assistant IA perso qui connaît nos faits, avec RAG sur notre corpus Supabase. Un SaaS type ChatGPT ne peut pas (privacy + coût).
- **Décision** : `jarvis/server.py` (FastAPI uvicorn port 8765) appelle LM Studio local (Qwen3.5 9B) ou Claude Haiku selon le mode. Le cockpit appelle `POST /chat` — localhost d'abord, puis tunnel Cloudflare en fallback quand le cockpit tourne sur GitHub Pages (HTTPS interdit le mixed-content vers `http://localhost`).
- **Conséquences** : l'utilisateur doit lancer `start_jarvis.bat` pour que Jarvis réponde ; URL du tunnel est publiée dans `user_profile.jarvis_tunnel_url` ; si tunnel down, fallback heuristique local dégradé (mode Pratique des challenges surtout).

## ADR-07 · 2026-Q2 · Observers privacy-first (données locales uniquement)

- **Contexte** : Jarvis a besoin de comprendre ce que l'utilisateur fait en ce moment (fenêtre active, calendrier, mails) pour répondre pertinemment. Mais on ne veut PAS que ces données partent sur un serveur tiers.
- **Décision** : observers (`window_observer.py`, `outlook_observer.py`) stockent les données brutes dans `jarvis_data/*.jsonl` / `.json` locaux, jamais versionnés. Seul un résumé quotidien agrégé (`activity_briefs`) monte dans Supabase, via `daily_brief_generator.py` à 18h.
- **Conséquences** : les titres de réunions et apps actives restent sur la machine locale ; si on change de machine, tout l'historique d'activité brute est perdu (résumés conservés) ; le `nightly_learner.py` qui extrait les faits depuis ces JSONL doit tourner sur la machine qui les produit.

## ADR-08 · 2026-Q2 · Pipelines perso séparés, pas de monolithe sync.py

- **Contexte** : au début on avait `main.py` qui faisait tout (RSS + stats perso). Devenu ingérable, différents rythmes, différentes APIs, différents formats.
- **Décision** : un `pipelines/<source>_sync.py` par source externe (Strava, Withings, Last.fm, Steam, Sport RSS, Gaming RSS, Anime RSS, News RSS), chacun avec son workflow YAML dédié et son cron propre. `requirements-<source>.txt` isolé pour éviter les conflits de deps.
- **Conséquences** : 10 pipelines au lieu d'un, mais chacun petit et testable indépendamment ; coût : 10 workflows à maintenir ; un bug sur Strava ne casse pas Last.fm.

## ADR-09 · 2026-Q2 · Stockage brut + mappé pour chaque source externe

- **Contexte** : les APIs externes évoluent (Strava change ses schémas, Withings ajoute des champs). Si on ne stocke que la forme mappée, on perd l'info.
- **Décision** : chaque source a DEUX tables — `<source>_raw` (payload JSONB complet, service_role only) et `<source>_<entity>` (colonnes typées lues par le front). Le pipeline upsert les deux.
- **Conséquences** : double stockage donc coût disque + ; mais on peut toujours re-mapper sans refetch depuis l'API (précieux sur les APIs à rate-limit sévère type Strava).

## ADR-10 · 2026-Q2 · pgvector + indexer Jarvis unifié

- **Contexte** : Jarvis a besoin de RAG sur articles + wiki + opportunités + idées + RTE + profil. Utiliser 6 tables distinctes pour l'embedding serait ingérable.
- **Décision** : une table `memories_vectors` unique (source_table + source_id + chunk_text + embedding vector(1024) + metadata JSONB). `jarvis/indexer.py` indexe périodiquement chaque table source. Fonction RPC `match_memories()` pour la recherche sémantique.
- **Conséquences** : un seul index à gérer ; dimension 1024 figée (modèle Qwen3-Embedding-0.6B) — changer de modèle = réindexer tout ; `check_index_freshness.py` compare les COUNTs source vs `memories_vectors` au boot de Jarvis.

## ADR-11 · 2026-Q2 · Télémétrie append-only dans `usage_events`

- **Contexte** : on veut savoir ce que l'utilisateur fait dans le cockpit (sections visitées, actions, erreurs) sans maintenir un SaaS analytics.
- **Décision** : table `usage_events` append-only (INSERT authenticated, pas de UPDATE/DELETE enforcé par RLS). Le front envoie via `track(event_type, payload)` best-effort. Un échec de télémétrie ne casse jamais le cockpit.
- **Conséquences** : données rétrocompatibles par construction (JSONB `payload` extensible) ; panel Historique consomme directement `usage_events` pour les "actions du jour" ; ajouter un nouvel `event_type` demande de mettre à jour le tableau dans CLAUDE.md.

## ADR-12 · 2026-Q2 · Specs produit par onglet + lint bloquant

- **Contexte** : les 25 onglets du cockpit dérivaient vite du code — personne ne savait ce qu'ils étaient censés faire.
- **Décision** : un `docs/specs/tab-<slug>.md` par onglet, source de vérité consommée en direct par Jarvis Lab. Sections `Fonctionnalités` et `Parcours utilisateur` écrites en vocabulaire produit (pas de chemins `.jsx`, pas de `Tier 1`, pas de colonnes DB). Lint bloquant CI (`lint_specs_produit.py`).
- **Conséquences** : toute PR de code à impact sur un onglet doit updater son spec dans le même commit ; drift automatiquement détecté par `spec-drift-check.yml` ; lint CI bloque les régressions de vocabulaire.

## ADR-13 · 2026-Q2 · Architecture en YAML, rendu SVG maison (pas Mermaid)

- **Contexte** : on veut une vue archi dans Jarvis Lab, versionnée, avec des règles de routage strictes (pas de diagonales, trois types d'arêtes dans trois couloirs, labels verticaux à gauche). Mermaid ne sait pas faire proprement, et son thème ignore nos CSS variables Dawn/Obsidian/Atlas.
- **Décision** : `docs/architecture/*.yaml` déclaratif, rendu par un composant React custom qui calcule les positions et les rails de routage. js-yaml côté client pour parser. Lint `validate_architecture.py` + arch-drift-check côté CI.
- **Conséquences** : écrire le renderer maison = 500+ lignes de SVG layout ; mais on contrôle le routage à 100 % et on hérite des 3 thèmes gratos via `var(--acc)` ; ajouter une 5e boîte à une couche redistribue automatiquement les colonnes.

## ADR-14 · 2026-Q2 · Budget dur 3 €/mois, tracking Stacks

- **Contexte** : projet perso, pas question de se retrouver avec une facture 30 € pour avoir oublié de capper un quota.
- **Décision** : budget mensuel hard à 3 € (Claude Haiku weekly + Jarvis cloud occasionnel). `CostTracker` dans `weekly_analysis.py` arrête le pipeline si le budget hebdo dépasse 1 $. Panel Stacks agrège les coûts réels + projection 7j.
- **Conséquences** : les analyses hebdo peuvent s'arrêter avant d'être complètes certains runs ; on est forcé à écrire des prompts compacts ; Gemini free tier reste la cheville ouvrière.

## ADR-15 · 2026-Q2 · Maintenance archi versionnée avec CI arch-drift

- **Contexte** : la doc archi dérive toujours plus vite que le code. On ne veut pas reproduire l'erreur des specs onglets.
- **Décision** : workflow `arch-drift-check.yml` qui liste les chemins à impact archi (pipelines/, main.py, panel-*.jsx, migrations, workflows sync) et warn quand une PR touche l'un sans toucher `docs/architecture/`. Workflow `validate-arch.yml` bloquant sur structure des YAML. CLAUDE.md § Maintenance architecture aligné sur la section specs.
- **Conséquences** : non-bloquant au départ (`continue-on-error: true`) — on durcira après deux semaines de bruit ; la checklist par type de modif (nouveau pipeline / nouveau panel / nouvelle table) est explicite dans le README archi et dans CLAUDE.md.
