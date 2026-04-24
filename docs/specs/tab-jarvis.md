# Jarvis

> Conversation unique (pas de threads) avec un assistant LLM local+cloud routé par le serveur `jarvis/server.py` (localhost:8765 OU tunnel Cloudflare), split 2/3 chat ↔ 1/3 mémoire structurée éditable.

## Scope
mixte

## Finalité fonctionnelle
L'onglet Jarvis est **la gateway front du module Jarvis backend** (assistant IA perso, voir [CLAUDE.md](CLAUDE.md)). Il affiche une conversation chronologique persistée dans `jarvis_conversations` (lue au mount, appendée à chaque tour), ouvre un composer qui envoie la question à `POST /chat` (routé par `server.py` entre Qwen local / Claude Haiku cloud selon le `mode` choisi par l'utilisateur), puis rend la réponse avec citations RAG cliquables qui renvoient vers les autres panels (signals/updates/wiki/ideas/opps/brief). La colonne de droite affiche la mémoire structurée (`profile_facts`, 87 faits actifs au 2026-04-24) que le `nightly_learner.py` alimente la nuit ; l'utilisateur peut épingler (local) ou oublier (soft-delete via `superseded_by`) chaque fait. 3 modes de chat (Rapide LLM local sans RAG, Deep LLM local + RAG, Cloud Claude Haiku + RAG ~0,01 $/requête) + override Thinking (auto/on/off) exposé dans un volet Settings.

## Parcours utilisateur
1. Clic sidebar "Jarvis" → Tier 2 `loadPanel("jarvis")` fetch en parallèle les 200 derniers messages (`jarvis_conversations`) et 200 faits actifs (`profile_facts` où `superseded_by is null`). `transformJarvisMessages` reverse chrono + injecte des séparateurs "stamp" par jour ("Aujourd'hui", "Hier", "Il y a Nj", date complète au-delà d'une semaine).
2. Header : eyebrow "En ligne · {last_active}", titre "Jarvis · ta conversation continue", badge mode cliquable (ouvre Settings), total messages, heures ensemble, date first_conversation, compteur coût du jour (`cost_today_eur / cost_budget_eur`).
3. 2 boutons d'action : search (filtre client sur le texte des messages) + settings (3 modes + 3 thinking + UUID session courte + bouton "Nouvelle session" qui clear `localStorage.jarvis-session-id`).
4. Feed scrollable avec auto-scroll en bas sur nouveau message. Chaque message jarvis affiche les citations RAG sous forme de chips "article/wiki/opp/idea/signal/brief · {preview 80 chars}" → clic navigate vers le panel correspondant. Boutons Copier / Régénérer sur la dernière réponse.
5. **Composer sticky** en bas : textarea auto-resize (max 240px), 5 quick prompts au-dessus (statiques dans `data-jarvis.js`), 3 boutons mode inline, boutons paperclip/mic **non câblés** (cosmetic), bouton send actif si text non-vide. `Enter` envoie, `Shift+Enter` nouvelle ligne.
6. À l'envoi : push message user optimiste → `tryModes(candidates, text, [mode])` tente chaque gateway dans l'ordre (localhost puis tunnel sur HTTP, inversé sur HTTPS). Timeout 45s (cloud) / 120s (local). Si succès → push message jarvis avec cites. Si échec → message d'erreur formaté avec la liste des tentatives + hint contextuel ("Lance start_jarvis.bat" OU "jarvis_tunnel_url non défini" OU "tunnel ne répond pas"). **Note** : le front ne persiste PAS les messages — c'est `server.py::_persist_exchange` qui écrit côté backend.
7. Pendant le thinking : bubble "Jarvis réfléchit…" + ticker secondes + rappel mode+timeout.
8. **Colonne mémoire** (à droite) : header "Ce que je sais de toi" + N faits, 2 filtres fixes (Tout, ★ Épinglés) + 1 filtre par catégorie (6 catégories fixes dérivées de `fact_type` : profil/préférences/intérêts/positions/projets/contraintes). Chaque item est cliquable → expand avec 2 boutons : Épingler (local, `localStorage.jarvis-fact-pinned`) et Oublier (`PATCH profile_facts?id=eq.{id} superseded_by=id` — soft-delete auto-référentiel). Footer : date du dernier fait appris + bouton "Exporter tout" (JSON téléchargé).
9. Si un autre panel a stashé un prompt dans `localStorage.jarvis-prefill-input` (via "Demander à Jarvis" depuis opps/search/signals/wiki), le composer s'initialise avec ce texte et la clé est supprimée.

## Fonctionnalités
- **Chat conversation continue** : un seul flow, pas de threads. Tous les messages d'une même session (UUID client) sont stockés chronologiquement dans `jarvis_conversations`. Le chat reprend là où il s'est arrêté au reload (persisté en base + rechargé au mount).
- **3 modes LLM** configurables à chaud via header-badge OU composer-pills OU settings :
  - `quick` : LLM local (`http://localhost:1234/v1`), pas de RAG, `max_tokens` ~512 (configurable côté serveur), system prompt minimal.
  - `deep` : LLM local + RAG (`memories_vectors` via `match_memories` RPC, k=5 threshold=0.3) + contexte profile_facts + activity_context (fenêtres actives/Outlook du jour).
  - `cloud` : Claude Haiku (API Anthropic) + RAG. Fallback auto vers `deep` si `ANTHROPIC_API_KEY` absent.
- **Override thinking** : `auto` (dépend du mode, `/no_think` injecté côté serveur), `on`, `off`. Persisté dans `localStorage.jarvis-thinking-override`, transmis comme param `thinking` au `/chat`.
- **Gateway auto-discovery** : `jarvisGatewayCandidates()` construit la liste [localhost:8765, tunnel_url] en fonction du protocole (HTTPS interdit le mixed-content pour localhost → tunnel prioritaire). Le tunnel est lu dans `window.PROFILE_DATA._values.jarvis_tunnel_url` (rempli par `start_tunnel.py::upsert sb_post user_profile`).
- **Citations cliquables** : chaque élément RAG renvoyé dans `data.sources` est projeté en chip typée avec mapping `source_table → panel id` : `articles→updates`, `wiki_concepts→wiki`, `weekly_opportunities→opps`, `business_ideas→ideas`, `rte_usecases→updates (fallback)`, `user_profile→brief (via "profile" fallback, cf. limitations)`.
- **Mémoire structurée éditable** : 87 faits actifs. Catégorisés par `fact_type` (context/profile/skill→profil, preference→préférences, opinion/position→positions, goal/project→projets, constraint→contraintes, interest→intérêts). Force visuelle 3 dots (weak < 0.6 ≤ medium < 0.85 ≤ strong).
- **Épinglage persisté** : `PATCH profile_facts?id=eq.{id}` avec `{pinned: bool}`. Optimistic update avec rollback si la requête échoue. Partagé entre devices (colonne DB depuis migration 012).
- **Soft-delete** : "Oublier" fait `PATCH profile_facts?id=eq.{id}` avec `superseded_by: {id}` (le fait pointe sur lui-même) → le nightly_learner ignore + le fact disparait du `loadPanel("jarvis")` suivant (filtre `superseded_by=is.null`).
- **Export JSON** : snapshot local téléchargé sous `jarvis-memory-YYYY-MM-DD.json` avec category/label/value/source/learned/pinned.
- **Recherche client** : filtre in-memory sur `messages[].text.toLowerCase().includes(q)`, conserve les "stamps" pour l'aide à la lecture.
- **Régénérer** : bouton "Régénérer" sur la dernière réponse jarvis — remet le dernier message user dans l'input et fait un setTimeout 0 → `handleSend()`.
- **Session UUID stable** : `localStorage.jarvis-session-id` regex-validé `[0-9a-f-]{36}`, sinon régénéré via `crypto.randomUUID()` (polyfill fallback Math.random). Évite l'erreur Postgres 22P02 sur `session_id` column uuid.
- **Telemetry** : `pipeline_triggered` (pipeline=jarvis, mode=quick/deep/cloud), `error_shown` (context="jarvis:gateway"), `jarvis_fact_pinned` (id, pinned), `jarvis_fact_forgotten` (id).

## Front — structure UI
Fichier : [cockpit/panel-jarvis.jsx](cockpit/panel-jarvis.jsx) — 843 lignes, monté par [app.jsx:406](cockpit/app.jsx:406).

Structure DOM :
- `.jv-wrap[data-screen-label="Jarvis"]` (grid 2 colonnes 2fr/1fr via [styles-jarvis.css](cockpit/styles-jarvis.css))
  - `.jv-chat`
    - `.jv-header > .jv-header-main + .jv-header-actions`
    - `.jv-searchbar` (conditionnel)
    - `.jv-settings` (conditionnel — 3 rows : Mode, Thinking, Session meta + reset)
    - `.jv-scroll > .jv-feed > (.jv-empty | .jv-stamp | .jv-msg × N | .jv-msg--jarvis loader)`
    - `.jv-composer-wrap > .jv-composer-inner`
      - `.jv-prompts` (5 quick prompts + 3 mode pills)
      - `.jv-composer > textarea + .jv-composer-actions (paperclip, mic, send)`
      - `.jv-composer-foot`
  - `.jv-memory` (colonne droite)
    - `.jv-mem-header`
    - `.jv-mem-filters` (pills)
    - `.jv-mem-scroll > (.jv-mem-group + .jv-mem-item × N) × catégorie`
    - `.jv-mem-foot` (dernière MAJ + Exporter)

Route id = `"jarvis"`. **Panel Tier 2**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelJarvis({ data, onNavigate })` | Composant racine — state messages/memory/input/mode/sending/settings | [panel-jarvis.jsx:315](cockpit/panel-jarvis.jsx:315) |
| `JvIcon({ name, size })` | Set d'icônes inline SVG (10 icônes) | [panel-jarvis.jsx:17](cockpit/panel-jarvis.jsx:17) |
| `formatText(text)` / `inlineFormat(s)` | Markdown-lite : paragraphes, listes ordonnées/bullet, `**bold**` / `*italic*` / `` `code` `` / `<br/>` (dangerouslySetInnerHTML — pas de DOMPurify côté front, seul le texte du backend est injecté) | [panel-jarvis.jsx:37, 60](cockpit/panel-jarvis.jsx:37) |
| `JvTicker()` | Compteur secondes temps-réel pendant `sending` | [panel-jarvis.jsx:69](cockpit/panel-jarvis.jsx:69) |
| `JvCite({ cite, onNavigate })` | Chip citation cliquable avec mapping `kind → panel_id` | [panel-jarvis.jsx:81](cockpit/panel-jarvis.jsx:81) |
| `JvMessage({ m, onNavigate, onCopy, onRegenerate, canRegenerate })` | Bulle user/jarvis/stamp avec avatar + cites + meta (mode, Copier, Régénérer) | [panel-jarvis.jsx:107](cockpit/panel-jarvis.jsx:107) |
| `JvMemItem({ item, ... })` | Fact card expandable (Épingler / Oublier) | [panel-jarvis.jsx:155](cockpit/panel-jarvis.jsx:155) |
| `JvMemory({ memory, ... })` | Colonne mémoire — filtres + catégories + export JSON | [panel-jarvis.jsx:195](cockpit/panel-jarvis.jsx:195) |
| `jarvisGatewayCandidates()` (inline) | Construit [localhost, tunnel] selon protocole HTTPS/HTTP + lecture `PROFILE_DATA._values.jarvis_tunnel_url` | [panel-jarvis.jsx:371](cockpit/panel-jarvis.jsx:371) |
| `getJarvisSessionId()` (inline) | UUID client stable via `crypto.randomUUID()` ou polyfill Math.random ; stored `jarvis-session-id` | [panel-jarvis.jsx:394](cockpit/panel-jarvis.jsx:394) |
| `buildHistoryPayload(prior)` (inline) | Extrait 8 derniers user/jarvis avec alternance stricte → `[{role, content}]` | [panel-jarvis.jsx:416](cockpit/panel-jarvis.jsx:416) |
| `callJarvis(base, text, chatMode, history)` (inline) | `POST /chat` avec AbortController timeout (45s cloud / 120s local) + history multi-turn | [panel-jarvis.jsx:428](cockpit/panel-jarvis.jsx:428) |
| `tryModes(candidates, text, modes, history)` (inline) | Walk (gateway × mode) séquentiel, stop au premier succès, accumule les failures | [panel-jarvis.jsx:460](cockpit/panel-jarvis.jsx:460) |
| `handleSend()` (inline) | Build history → push user msg → tryModes → push jarvis msg (avec cites) OU erreur formaté | [panel-jarvis.jsx:477](cockpit/panel-jarvis.jsx:477) |
| `handleCopy(text)` (inline) | Clipboard API ou fallback `textarea + execCommand` | [panel-jarvis.jsx:542](cockpit/panel-jarvis.jsx:542) |
| `handleRegenerate()` (inline) | Recherche dernier message user, le remet dans input, setTimeout 0 → handleSend | [panel-jarvis.jsx:555](cockpit/panel-jarvis.jsx:555) |
| `handlePin(item)` (inline) | `PATCH profile_facts?id=eq.{id} pinned=bool` optimistic + rollback si échec | [panel-jarvis.jsx:569](cockpit/panel-jarvis.jsx:569) |
| `handleForget(item)` (inline) | Optimistic remove + `PATCH profile_facts?id=eq.{id} superseded_by={id}` + rollback si échec | [panel-jarvis.jsx:604](cockpit/panel-jarvis.jsx:604) |
| `exportMemory()` (inline dans JvMemory) | Blob JSON + download `jarvis-memory-YYYY-MM-DD.json` | [panel-jarvis.jsx:232](cockpit/panel-jarvis.jsx:232) |
| `T2.jarvis_messages()` | `GET jarvis_conversations?order=created_at.desc&limit=200` mémoïsé | [data-loader.js:1335](cockpit/lib/data-loader.js:1335) |
| `T2.jarvis_facts()` | `GET profile_facts?superseded_by=is.null&order=created_at.desc&limit=200` mémoïsé | [data-loader.js:1336](cockpit/lib/data-loader.js:1336) |
| `transformJarvisMessages(rows)` | Reverse chrono + inject `{kind:"stamp",label}` par jour (Aujourd'hui/Hier/Il y a Nj/date complète) | [data-loader.js:2911](cockpit/lib/data-loader.js:2911) |
| `transformJarvisFacts(rows)` | Map fact_type → catégorie + troncation value 240 chars + strength (weak/medium/strong via confidence) + pinned lu du localStorage | [data-loader.js:2953](cockpit/lib/data-loader.js:2953) |
| `loadPanel("jarvis")` case | Parallel T2 fetch → transform → mute `JARVIS_DATA.messages/meta/stats/memory` | [data-loader.js:4128-4164](cockpit/lib/data-loader.js:4128) |

## Back — sources de données

| Table | Colonnes (schéma live) | Usage |
|-------|------------------------|-------|
| `jarvis_conversations` | `id uuid PK, session_id uuid, role text, content text, mode text, tokens_used int, created_at timestamptz` | **Lu** (T2, 200 derniers desc). **Écrit par le backend uniquement** (`server.py::_save_conversation` via `sb_post`). Le front ne POST jamais direct. |
| `profile_facts` | `id uuid PK, fact_type text, fact_text text, source text, confidence float8, session_id uuid, created_at timestamptz, superseded_by uuid` | **Lu** (T2, `superseded_by is null` 200 derniers). **Écrit** par `nightly_learner.py` (insert). **UPDATE par le front** uniquement pour soft-delete (`superseded_by = id`). |
| `memories_vectors` | Voir CLAUDE.md | **Pas lu par le front**. Utilisé côté backend `server.py::_build_context` → RPC `match_memories` pour les modes deep/cloud. Les citations sont retournées dans la réponse `/chat`. |
| `user_profile` | key/value | **Lu côté front** indirectement pour récupérer `jarvis_tunnel_url`. |

Volumétrie (2026-04-24) : 94 conversations, 87 facts actifs (88 au total, 1 soft-deleted).

**RLS** : `jarvis_conversations` : 1 policy `auth_select (r)` pour `authenticated` (lecture seulement côté front, écriture via service_role backend). `profile_facts` : 2 policies — `auth_select (r)` + `auth_update_superseded (w)` pour `authenticated` (le front peut faire le soft-delete). Pas de policies INSERT/DELETE côté authenticated → cohérent avec l'architecture (front lit + annote, backend écrit via service_role).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) : aucun write dans `jarvis_conversations` ni `profile_facts`. Indirect seulement via `articles` qui sont indexés dans `memories_vectors` par `jarvis/indexer.py`.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : aucun write direct. `weekly_analysis` est utilisé par `data-loader.js::bootTier1` pour calculer le `cost_today_eur` côté cockpit (mais pour l'onglet Jarvis, c'est recalculé à partir des tokens cloud).
- **Jarvis backend** — **pipeline principal** :
  - [jarvis/server.py:473-476](jarvis/server.py:473) `_persist_exchange` → `sb_post jarvis_conversations` (x2 : user + assistant) à chaque tour via service_role.
  - [jarvis/nightly_learner.py](jarvis/nightly_learner.py) lu les nouvelles conversations depuis un checkpoint, passe chaque bloc à Qwen3 4B Instruct pour extraction JSON (faits + entités), `sb_post profile_facts` + `sb_post entities` (upsert), puis reindex via `indexer.py`. Déclenché à minuit par le scheduler asyncio dans `server.py:575`, au démarrage via `start_jarvis.bat`, ou manuel via `POST /nightly-learner`.
  - [jarvis/indexer.py](jarvis/indexer.py) indexe périodiquement `articles`, `wiki_concepts`, `weekly_opportunities`, `business_ideas`, `rte_usecases`, `user_profile`, `profile_facts`, `entities` dans `memories_vectors`. Check freshness via `check_index_freshness.py` au boot.
- **Observers** (voir CLAUDE.md phase 6) :
  - `window_observer.py` — fenêtre active Windows, 30s, JSONL local.
  - `outlook_observer.py` — calendrier + mails Outlook COM, 5min, JSON local.
  - `daily_brief_generator.py` — 18h, résume l'activité du jour en brief HTML → `activity_briefs`.
  - Ces données sont utilisées par `_get_activity_context(question)` dans `/chat` pour donner à Jarvis le contexte de ce que l'utilisateur fait en ce moment.

## Appels externes
- **`POST /chat` (Jarvis backend)** : body `{question, mode, session_id, history, thinking}`. Timeout 45s (cloud) / 120s (local). Retour : `{answer, sources[], tokens_used, latency_ms, backend, compacted, compacted_count}`.
- **Supabase REST** :
  - `GET jarvis_conversations?order=created_at.desc&limit=200` (T2)
  - `GET profile_facts?superseded_by=is.null&order=created_at.desc&limit=200` (T2)
  - `PATCH profile_facts?id=eq.{id}` avec `{superseded_by: id}` (handleForget)
- **Gateway candidates** :
  - `http://localhost:8765` (HTTP page uniquement, sinon mixed-content)
  - `${jarvis_tunnel_url}` depuis `user_profile` (HTTPS trycloudflare)
- **localStorage** :
  - `jarvis-session-id` (UUID stable cross-sessions)
  - `jarvis-mode` ("quick"/"deep"/"cloud")
  - `jarvis-thinking-override` ("auto"/"on"/"off")
  - `jarvis-prefill-input` (single-use, stashé par opps/search/signals/wiki)
- **Clipboard API** : `navigator.clipboard.writeText` + fallback `execCommand` (pour contexts non-secure / file://).
- **Blob URL** : export JSON mémoire.
- **Telemetry** : 3 events (voir fonctionnalités).

## Dépendances
- **Onglets in** : sidebar ; `opps` (prefill "plan d'action"), `search` (prefill query), `signals` (prefill "explique ce signal"), `wiki` (prefill depuis détail OU create flow). Navigate programmatique depuis `ideas` (bouton "Demander à Jarvis" dans le modal — sans prefill, ouvre juste l'onglet).
- **Onglets out** : citations RAG → `updates` (articles), `wiki` (wiki_concepts), `opps` (weekly_opportunities), `ideas` (business_ideas), `signals`, `brief`.
- **Globals lus** : `window.JARVIS_DATA` (messages, memory, meta, stats, quick_prompts), `window.PROFILE_DATA._values.jarvis_tunnel_url`, `window.sb`, `window.SUPABASE_URL`, `window.track`.
- **Composants externes** : aucun composant partagé — tout est local à panel-jarvis.jsx (avatar lettre, JvIcon local avec 10 icônes inline, pas de marked.js ni DOMPurify).
- **Backend obligatoire** : `jarvis/server.py` (FastAPI uvicorn port 8765). Lancé par `start_jarvis.bat` (check LM Studio → check freshness → optionnel `start_tunnel.py` → `uvicorn server:app`).
- **Variables d'env / secrets** (côté backend, via `jarvis/config.py`) :
  - `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` (obligatoire depuis migration 006)
  - `ANTHROPIC_API_KEY` (optionnel — désactive le mode cloud si absent, fallback auto sur `deep` local)
  - LM Studio doit être lancé sur `http://localhost:1234/v1` avec Qwen3.5 9B chargé

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant le fetch parallèle messages + facts ([app.jsx:391](cockpit/app.jsx:391)).
- **DB vide (messages)** : affiche `.jv-empty` avec CTA "Lance start_jarvis.bat et écris un message".
- **DB vide (facts)** : footer affiche "Pas encore de mémoire structurée" (la liste au-dessus est vide).
- **Serveur offline** : message d'erreur formaté avec markdown gras + liste des tentatives `localhost:8765 [deep] → timeout 120s` etc. + hint contextuel (HTTPS+tunnel manquant / HTTPS+tunnel dead / HTTP+localhost dead).
- **HTTPS+mixed-content** : localhost est quand même essayé en dernier sur HTTPS → échec attendu, mais le message d'erreur sera clair ("localhost:8765 [deep] → TypeError: Failed to fetch").
- **Timeout 45s cloud / 120s local** : AbortController → throw `timeout Xs`, capturé par tryModes → ajouté aux failures.
- **Session_id invalide** : regex `[0-9a-f-]{36}` échoue → régénération via `crypto.randomUUID()` puis persisté. Si `crypto` absent, fallback Math.random (RFC4122 compatible).
- **Prefill depuis autre panel** : consommé au mount, la clé `jarvis-prefill-input` est supprimée après lecture (pas de stash persistent).
- **ANTHROPIC_API_KEY absente** en mode cloud : backend fallback sur `_call_local_llm(messages, "deep")`. Le front voit `backend: "local"` dans la réponse et l'affiche dans le meta ("Jarvis · local" au lieu de "Jarvis · claude").
- **LM Studio offline** : backend retourne 503 → `tryModes` loggue la failure, passe au gateway suivant.
- **`jarvis_tunnel_url` dans `user_profile`** : lu via `window.PROFILE_DATA._values` — nécessite que Tier 1 ait fini (ce qui est garanti par bootstrap.js avant mount). Si l'utilisateur n'a jamais lancé `start_tunnel.py`, la clé est absente → seul localhost est tenté.
- **Régénérer avec aucun message user précédent** : early-return silencieux, rien ne se passe.
- **Oublier pendant un PATCH en cours** : bloqué par `pendingFacts[id]` (bouton disabled).
- **Oublier échec** : rollback optimistic via `setMemory(prevMem)` + alert. **Ne rollback pas `window.JARVIS_DATA.memory`** — mais comme le state React utilise `memory` local, la prochaine render montre la bonne valeur.
- **Citations avec `source_table` inconnu** : mapping fallback `"article"` → navigate vers `updates`.
- **Scroll position** : auto-scroll en bas déclenché par `messages.length`. Si l'utilisateur scroll manuellement vers le haut puis que Jarvis répond, il sera ramené en bas (pas de "scroll-lock" intelligent).
- **Textarea auto-resize** : max 240px, puis scrollbar interne.
- **Search client** : insensible à la casse, filtre in-memory, conserve les stamps même s'ils ne matchent pas (pour l'orientation temporelle). Aucun appel réseau.
- **`xx` fake fallback** : `JV = window.JARVIS_DATA || {...}` avec un default inline qui satisfait toutes les accès `JV.meta.*` / `JV.stats.*` — pas d'erreur TypeError si le global n'est pas initialisé.

## Limitations connues / TODO
- [x] ~~**`handlePin` n'écrit pas en base**~~ → **fixé** : migration [sql/012_profile_facts_pinned.sql](sql/012_profile_facts_pinned.sql) ajoute une colonne `pinned boolean NOT NULL DEFAULT false`. La policy UPDATE existante (`auth_update_superseded` qui est en fait `USING(true) WITH CHECK(true)`) couvre aussi cette colonne. `handlePin` fait maintenant un PATCH optimistic avec rollback + met à jour `stats.memory_pinned`. Loader lit `!!f.pinned` depuis la DB. Telemetry : `jarvis_fact_pinned`.
- [x] ~~**paperclip + mic cosmetic**~~ → **supprimés** : boutons enlevés du composer, icônes `paperclip` et `mic` retirées de `JvIcon`.
- [ ] **quick_prompts hardcoded** : 5 prompts statiques dans `data-jarvis.js` jamais rafraîchis par le loader. Pas de personnalisation selon le contexte (jour de la semaine, radar, etc).
- [ ] **Session "Nouvelle session" ne vide pas les messages affichés** : seul `jarvis-session-id` est clear. Les messages déjà rendus restent à l'écran, le prochain tour démarre juste avec un nouveau session_id côté backend.
- [x] ~~**Historique envoyé = `[]`**~~ → **fixé** : `buildHistoryPayload(messages)` extrait les 8 derniers user/jarvis (skip stamps, enforce alternance user→assistant), envoyé au backend dans le champ `history`. Le backend compacte déjà (cf. `_compact_history`) et tolère max 10 éléments. "Régénérer" profite maintenant du contexte multi-turn.
- [x] ~~**`total_hours` calculé simpliste**~~ → **fixé** : somme des deltas entre messages consécutifs par session, avec seuils : `delta ≤ 10min` compte plein, `10min < delta ≤ 30min` compte pour 2 min forfaitaires (pause courte), `delta > 30min` = nouveau tour, ignoré. Affiché avec 1 décimale au lieu d'arrondi entier. Évite les "2000h" sur conversations étalées sur plusieurs mois.
- [ ] **`cost_today_eur` estimé à 0.000004 $/token** : hardcoded dans le loader, pas de lecture `weekly_analysis` qui serait plus précis. Taux USD→EUR ignoré (affiché en €).
- [ ] **RAG sans feedback visuel** : l'utilisateur ne sait pas que le mode deep/cloud attend le résultat de `search` avant d'appeler le LLM — le ticker démarre quand même mais ne distingue pas "RAG" de "LLM gen".
- [ ] **Pas de retry à la main** : si une réponse est coupée par timeout à 119s, aucun bouton "continuer". Il faut retaper la question.
- [ ] **`xss risk minimal sur formatText`** : `dangerouslySetInnerHTML` après `inlineFormat` — mais l'input vient du backend (answer de Claude / Qwen) qu'on contrôle. Pas de DOMPurify. Si un prompt retourne `<script>`, il sera échappé par `<p>` / `<li>` wrapper mais **pas** les backticks (qui deviennent `<code>`) ni les emphases.
- [ ] **Export JSON memory** ne stocke pas `fact_type` brut ni `confidence` — juste la version transformée. Pour un export "admin", il faudrait passer par un SELECT direct.
- [ ] **Pas de filtre par strength** dans la colonne mémoire (weak/medium/strong visibles mais non filtrables).
- [ ] **Pas de fuzzy search** sur les messages (strict `includes`).
- [x] ~~**SOURCE_KIND fallback "profile"→brief**~~ → **fixé** : ajout de `profile: "profile"` dans les maps `TYPE_LABEL` et `TARGET` de `JvCite`. Un clic sur une citation `user_profile` navigue maintenant correctement vers le panel "Mon profil".
- [ ] **Mode switching en cours de sending** : possible mais le backend reçoit le mode au moment de la requête. Si on switch après envoi, la réponse affichée aura l'ancien mode dans le meta.
- [ ] **Pas de scroll lock** : si l'utilisateur relit l'historique en haut, une nouvelle réponse le ramène en bas.
- [ ] **`handleForget` message d'erreur manque de contexte** : `alert("Impossible d'oublier ce fait. Réessaie dans un instant.")` — pas d'info HTTP code ni de retry automatique.
- [ ] **Tunnel URL non refreshed** : si `start_jarvis.bat` redémarre et regénère l'URL, le front continue de tenter l'ancienne tant que Tier 1 ne refetch pas `user_profile` (= reload complet).
- [ ] **`citations` trop verbeuses en mode deep** : k=5 retourne jusqu'à 5 chips par réponse, pas de dédup si plusieurs chunks pointent vers le même `source_id`.

## Dernière MAJ
2026-04-24 — rétro-doc + 5 fixes (pin DB migration 012, paperclip/mic supprimés, multi-turn history, profile citation target, total_hours actif réel)
