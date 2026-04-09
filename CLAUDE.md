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
- **Site** : GitHub Pages (HTML/CSS/JS vanilla, un seul `index.html`)
- **Base de données** : Supabase PostgreSQL (free tier, projet `mrmgptqpflzyavdfqwwv`)
- **Pipeline quotidien** : `main.py` via GitHub Actions (cron lun-ven 6h UTC)
  - Gemini 2.5 Flash-Lite (gratuit) pour RSS + web search + brief
- **Pipeline hebdomadaire** : `weekly_analysis.py` via GitHub Actions (dimanche 22h UTC)
  - Claude Haiku 4.5 (~0.03$/run) pour wiki, signaux, recommandations, challenges, opportunités, RTE
- **Pipeline TFT** : `tft_pipeline.py` via GitHub Actions (toutes les 2h)
  - API Riot TFT → Supabase (matchs, compos, lobby, rank)
- **Email** : Gmail SMTP notification quotidienne

### Repo structure
```
main.py                              # Pipeline quotidien Gemini
weekly_analysis.py                   # Pipeline hebdomadaire Claude
tft_pipeline.py                      # Pipeline TFT (Riot API → Supabase)
index.html                           # Site cockpit complet (vanilla JS)
requirements.txt                     # feedparser, google-generativeai, openai, requests
sql/tft_migration.sql                # Migration Supabase pour les tables TFT
jarvis/                              # Module Jarvis (assistant local LM Studio)
jarvis_data/                         # Données perso Jarvis (non versionné)
.github/workflows/daily_digest.yml   # Cron quotidien
.github/workflows/weekly_analysis.yml # Cron hebdomadaire
.github/workflows/tft-sync.yml      # Cron TFT toutes les 2h
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
- `usecase_maturity` — ancienne table de scoring statique (dépréciée, remplacée par weekly_opportunities)

**Tables TFT :**
- `tft_matches` — une ligne par match joué (placement, level, gold, durée, raw_payload JSONB, champs user_* éditables)
- `tft_match_units` — champions de la compo finale (character_id brut + champion_name nettoyé, tier/étoiles, cost, items)
- `tft_match_traits` — traits de la compo finale (trait_id brut + trait_name nettoyé, style, tier, is_active)
- `tft_match_lobby` — 7 adversaires par match (placement, main_traits, main_carry, dénormalisé)
- `tft_rank_history` — snapshot quotidien du rang ranked (tier, rank, LP, wins, losses)

RLS : tables AI cockpit → SELECT + INSERT + UPDATE public via publishable key.
RLS : tables TFT → SELECT/INSERT/UPDATE restreints à `auth.uid()`, écriture via service_role key dans le pipeline.

### Sections du cockpit (sidebar)

| Section | Source de données | Fréquence |
|---|---|---|
| Brief du jour | daily_briefs | Quotidien (Gemini) |
| Nouveautés IA | articles (section=updates) | Quotidien |
| LLMs / Agents / Énergie / FinServ / Outils / Business / Régulation / Arxiv | articles (par section) | Quotidien |
| Wiki IA | wiki_concepts | Quotidien (détection) + Hebdo (enrichissement Claude) |
| Signaux faibles | signal_tracking + weekly_analysis.signals_summary | Quotidien (comptage) + Hebdo (analyse Claude) |
| Opportunités | weekly_opportunities | Hebdomadaire (Claude) |
| Radar compétences | skill_radar | Manuel (diagnostic) + Hebdo (challenges) |
| Recommandations | learning_recommendations | Hebdomadaire (Claude) |
| Challenges | weekly_challenges | Hebdomadaire (Claude) |
| Carnet d'idées | business_ideas | Manuel (depuis le front) |
| RTE Toolbox | rte_usecases | Hebdomadaire (enrichissement Claude) |
| Mon profil | user_profile | Manuel (depuis le front) |
| TFT Matches | tft_matches + tft_match_units + tft_match_traits + tft_match_lobby | Toutes les 2h (Riot API) |
| Coûts API | weekly_analysis.tokens_used | Hebdomadaire (auto-loggé) |
| Recherche | articles (full-text ilike) | Temps réel |
| Historique | articles (groupé par fetch_date) | Quotidien |

## Conventions

- Le `index.html` est un fichier unique vanilla JS — pas de framework, pas de build
- La publishable key Supabase est en dur dans `index.html` (c'est une clé publique)
- Les appels Supabase côté front utilisent l'API REST directe (pas de SDK)
- Le main.py utilise Gemini Flash-Lite (gratuit, 1000 req/jour)
- Le weekly_analysis.py utilise Claude Haiku 4.5 avec un budget max de 1$/run
- Le CostTracker dans weekly_analysis.py arrête le pipeline si le budget est dépassé
- Le `user_profile` et le `skill_radar` sont injectés comme contexte dans tous les prompts Claude

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
- **Service role key pour l'écriture** — le pipeline TFT utilise la service_role key pour bypasser RLS (le pipeline n'a pas de session auth.uid()). La publishable key est utilisée côté front pour la lecture

## Module Jarvis (assistant local)

### Vision

Assistant IA personnel local ("Jarvis") qui :
1. **Connaît la base de connaissances** via RAG sur Supabase pgvector (articles, wiki, opportunités, idées, RTE, profil)
2. **Apprend de lui-même** : extraction nocturne des faits, entités et préférences depuis les conversations
3. **Observe l'activité** (étape future : Teams, emails, fichiers) pour produire des briefs quotidiens
4. **Route intelligemment** entre LLM local (90% des tâches) et API cloud Claude/Gemini (tâches complexes) pour rester sous 3€/mois

### Stack technique Jarvis

- **LM Studio** en serveur local sur `http://localhost:1234/v1` (compatible OpenAI API)
- **LLM principal** : Qwen3.5 9B Q4_K_M (6.55 Go VRAM)
- **Embeddings** : Qwen3-Embedding-0.6B Q8_0 (~640 Mo)
- **Vector store** : Supabase pgvector (1024-dim, table `memories_vectors`)
- **Hardware** : RTX 5070 12 Go VRAM, 32 Go RAM, Windows
- **Mode thinking** de Qwen3.5 désactivé par défaut (utiliser `/no_think`)

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
│   └── 001_enable_pgvector.sql
├── (à venir) orchestrator.py
├── (à venir) nightly_learner.py
└── (à venir) observers/

jarvis_data/               # Données perso, non versionné
```

### Phasage

- **Phase 1** : LM Studio + premier test Python *(done)*
- **Phase 2** : RAG Supabase (pgvector + indexation) *(done)*
- **Phase 2.5** : Intégration cockpit web (server.py + onglet Jarvis dans index.html) *(done)*
- **Phase 3** : Mémoire structurée
- **Phase 4** : Orchestrateur (routeur LLM local/cloud)
- **Phase 5** : Boucle nocturne d'apprentissage
- **Phase 6** : Capteurs d'observation

### Conventions Jarvis

- Toujours désactiver thinking mode (`/no_think`) sauf pour raisonnement complexe explicite
- LLM local pour : tagging, classification, résumés, RAG, conversation
- Claude API / Gemini pour : analyses stratégiques complexes, tâches au-delà du local
- Logger les coûts API cloud dans la table `weekly_analysis` existante
- Données d'observation perso dans `jarvis_data/` (jamais commit)
- Port 8765 réservé pour le serveur Jarvis (FastAPI)
- Aucune clé Supabase dans index.html pour Jarvis — tout passe par server.py côté Python
- `start_jarvis.bat` est le point d'entrée unique (check LM Studio → check fraîcheur index → tunnel Cloudflare → lance serveur)
- Architecture cockpit : `index.html → POST /chat → server.py → retriever + LM Studio → réponse JSON`
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
- **`jarvis/nightly_learner.py`** — Script d'extraction nocturne : lit les conversations du jour, envoie chaque session à Qwen3.5 pour extraction JSON (faits + entités), upsert dans les tables, reindex via indexer.py. À lancer manuellement ou via Task Scheduler Windows.

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
