# Jarvis

> Conversation unique (pas de threads) avec un assistant LLM local+cloud routé par le serveur `jarvis/server.py` (localhost:8765 OU tunnel Cloudflare), split 2/3 chat ↔ 1/3 mémoire structurée éditable.

## Scope
mixte

## Finalité fonctionnelle
L'onglet Jarvis est **la gateway front du module Jarvis backend** (assistant IA perso, voir [CLAUDE.md](CLAUDE.md)). Il affiche une conversation chronologique persistée dans `jarvis_conversations` (lue au mount, appendée à chaque tour), ouvre un composer qui envoie la question à `POST /chat` (routé par `server.py` entre Qwen local / Claude Haiku cloud selon le `mode` choisi par l'utilisateur), puis rend la réponse avec citations RAG cliquables qui renvoient vers les autres panels (signals/updates/wiki/ideas/opps/brief). La colonne de droite affiche la mémoire structurée (`profile_facts`, 87 faits actifs au 2026-04-24) que le `nightly_learner.py` alimente la nuit ; l'utilisateur peut épingler (local) ou oublier (soft-delete via `superseded_by`) chaque fait. 3 modes de chat (Rapide LLM local sans RAG, Deep LLM local + RAG, Cloud Claude Haiku + RAG ~0,01 $/requête) + override Thinking (auto/on/off) exposé dans un volet Settings.

## Parcours utilisateur
1. Clic sidebar "Jarvis" — le panel charge en parallèle les 200 derniers messages de la conversation et les 200 faits actifs de la mémoire. Les messages sont affichés en ordre chronologique avec des séparateurs par jour ("Aujourd'hui", "Hier", "Il y a Nj", date complète au-delà d'une semaine).
2. Lecture du header : statut en ligne + date de dernière activité, titre "Jarvis · ta conversation continue", badge du mode en cours (cliquable pour ouvrir les paramètres), total de messages, heures cumulées, date de la première conversation, compteur coût du jour vs budget.
3. Deux boutons d'action dans le header : loupe (recherche plein-texte dans la conversation) et roue crantée (trois modes + trois options thinking + identifiant de session + bouton "Nouvelle session").
4. Lecture du feed chronologique, auto-scrollé en bas à chaque nouveau message. Chaque réponse Jarvis affiche ses citations sous forme de chips typées (article / wiki / opportunité / idée / signal / brief) — clic bascule vers le panel correspondant. Boutons Copier / Régénérer sous la dernière réponse.
5. Rédaction dans le composer en bas : zone de saisie qui grandit en écrivant, cinq quick prompts juste au-dessus, trois boutons de mode inline, bouton Envoyer actif quand le texte est non-vide. Entrée envoie, Shift+Entrée ajoute une nouvelle ligne.
6. À l'envoi, le message apparaît immédiatement puis Jarvis répond en quelques secondes — une bulle "Jarvis réfléchit…" avec compteur temps réel s'affiche en attendant. Si le serveur est injoignable, un message d'erreur détaillé liste les passerelles tentées avec un hint pour relancer.
7. Colonne mémoire à droite : header "Ce que je sais de toi · N faits", deux filtres fixes (Tout, ★ Épinglés) + un filtre par catégorie (Profil / Préférences / Intérêts / Positions / Projets / Contraintes). Clic sur un fait pour révéler deux boutons — Épingler (garder prioritairement) et Oublier (retirer des prompts futurs). Pied de colonne : date du dernier fait appris + bouton "Exporter tout" (téléchargement JSON).
8. Si l'utilisateur arrive depuis Opportunités / Recherche / Signaux / Wiki via "Demander à Jarvis", le composer s'ouvre déjà pré-rempli avec le contexte du panel d'origine.

## Fonctionnalités
- **Conversation continue** : un seul fil chronologique avec Jarvis, persisté en base et rechargé au mount pour reprendre là où on s'est arrêté. Séparateurs visuels par jour (Aujourd'hui / Hier / Il y a Nj / date complète).
- **Trois modes de chat** : Rapide (LLM local, pas de RAG, réponses courtes), Deep (LLM local + corpus personnel en RAG), Cloud (Claude Haiku + RAG, environ un centime par requête). Bascule depuis le header, le composer ou les settings.
- **Override thinking** : auto / on / off, pour forcer ou désactiver le mode raisonnement du modèle selon le besoin.
- **Citations cliquables** : chaque réponse Jarvis affiche les sources utilisées sous forme de chips typées (article / wiki / opportunité / idée / signal / brief / profil) qui renvoient au panel correspondant en un clic.
- **Mémoire structurée éditable** : colonne de droite « Ce que je sais de toi », regroupant les faits que Jarvis a appris la nuit (profil, préférences, intérêts, positions, projets, contraintes). Chaque fait montre sa force (trois points).
- **Épingler / Oublier un fait** : clic sur un fait révèle deux boutons — « Épingler » (persisté en base, partagé entre appareils) et « Oublier » (soft-delete, retire le fait de la liste et du prochain apprentissage nocturne).
- **Filtres mémoire** : deux filtres fixes (Tout / ★ Épinglés) + un par catégorie (Profil / Préférences / Intérêts / Positions / Projets / Contraintes).
- **Export mémoire** : bouton en pied de colonne qui télécharge tous les faits actifs au format JSON daté.
- **Recherche dans la conversation** : filtre client instantané sur le contenu des messages, garde les séparateurs de jour pour l'orientation.
- **Quick prompts** : cinq raccourcis au-dessus du composer pour démarrer vite sur les questions fréquentes.
- **Régénérer la dernière réponse** : bouton sous la dernière réponse Jarvis pour remettre la question dans le composer et relancer.
- **Copier une réponse** : bouton sous chaque réponse Jarvis pour copier le texte dans le presse-papiers.
- **Pré-remplissage depuis un autre panel** : arriver depuis Opportunités / Recherche / Signaux / Wiki ouvre le composer déjà rempli avec un prompt contextualisé.
- **Compteurs de session** : header affiche total de messages, heures cumulées, date de la première conversation et coût du jour rapporté au budget.
- **Nouvelle session** : bouton dans les settings qui démarre une session propre sans vider la conversation affichée.
- **Mode dégradé serveur offline** : message d'erreur explicite avec la liste des passerelles tentées (localhost et tunnel Cloudflare) et un hint sur la commande à lancer pour relancer Jarvis.

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
  - [jarvis/nightly_learner.py](jarvis/nightly_learner.py) lu les nouvelles conversations depuis un checkpoint, passe chaque bloc à Qwen3.5 9B Instruct (modèle unique partagé avec le chat) pour extraction JSON (faits + entités), `sb_post profile_facts` + `sb_post entities` (upsert), puis reindex via `indexer.py`. Déclenché à minuit par le scheduler asyncio dans `server.py:575`, au démarrage via `start_jarvis.bat`, ou manuel via `POST /nightly-learner`.
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
2026-04-25 — switch backend LM Studio sur modèle unique Qwen3.5 9B Instruct (chat Rapide/Deep + extraction nightly_learner). Suppression de la dual-stack 4B Thinking + 4B Instruct pour éliminer la slot contention LM Studio et les timeouts cockpit 120s sur les chats Deep.
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — rétro-doc + 5 fixes (pin DB migration 012, paperclip/mic supprimés, multi-turn history, profile citation target, total_hours actif réel)
