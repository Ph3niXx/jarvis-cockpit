# Carnet d'idées

> Incubateur à backlog sans deadline : capture éclair → 5-colonnes kanban (seed → ready) → promotion en opportunité ou parking, avec suggestions auto tirées des signaux/opps.

## Scope
pro

## Finalité fonctionnelle
Stocker les idées de produits/side-projects/contenu/vie-perso captées au fil de l'eau, les laisser mûrir sans pression de date, et les faire grader par stade de maturité (5 colonnes : seed → incubating → maturing → ready_to_promote → parked). C'est le seul onglet frontend qui fait du CRUD complet sur Supabase (INSERT + UPDATE depuis le navigateur). Distinction claire avec `opps` : **Opportunités** = fenêtres datées urgentes, **Idées** = backlog sans deadline. Les idées promues remontent ensuite dans `opps` via un tag `status='promoted'`.

## Parcours utilisateur
1. Clic sidebar "Carnet d'idées" → Tier 2 `loadPanel("ideas")` fetch les 100 lignes de `business_ideas` les plus récentes, `buildIdeasFromDB` les mappe vers la shape panel, injecte dans `window.IDEAS_DATA.ideas`.
2. **Hero** avec 4 KPIs (total, captées cette semaine, en maturation, prêtes à promouvoir).
3. **Capture bar** en haut : `Titre #tag1 #tag2` + Entrée → POST immédiat. Ou clic "Détails" → ouvre la `TicketModal` préremplie.
4. **Suggestions Jarvis** (section conditionnelle) : 4 signaux rising/new + 3 top opportunités non déjà liés aux idées existantes, avec boutons "Ajouter au carnet" / "Ignorer".
5. **Flagship card** : la ready_to_promote la plus touchée (fallback : la maturing la plus touchée) avec scores impact/effort/alignment, signaux source, actions Promouvoir/Modifier/Parquer.
6. **View switcher** (Pipeline | Galerie) + filtres catégorie (5 pills) + filtres libellés dynamiques (top 20 labels).
7. **Pipeline view** : 5 colonnes drag-and-drop natives (HTML5). Drop d'une carte dans une autre colonne → `handleMoveStatus` PATCH + mutation in-memory.
8. **Galerie view** : mur de post-its, ready_to_promote en premier.
9. Clic sur une carte → ouvre **TicketModal** en mode edit (titre, description, libellés, métadonnées read-only, menu "Déplacer →" vers chaque autre stade, boutons Promouvoir/Demander à Jarvis/Parquer).
10. "Promouvoir" → PATCH `status='promoted'`. L'idée disparaît des 5 colonnes et doit être relue depuis le panel `opps` (pas de nav auto). "Parquer" → PATCH `status='parked'`.
11. "Demander à Jarvis" → `onNavigate("jarvis")` direct (pas de prompt prefill, contrairement à d'autres onglets).
12. Raccourcis clavier : `Ctrl+N` (focus capture depuis n'importe où), `Ctrl+Shift+N` (ouvre modal create), `P/G` (switch view), `Escape` (ferme detail inline).

## Fonctionnalités
- **Capture-as-you-go avec hashtags** : `parseHashtags("Lance un LoRA #jarvis #ml")` → `{title: "Lance un LoRA", labels: ["jarvis","ml"]}`. Normalisation : lowercase, strip diacritiques, slug ≤ 32 chars.
- **TicketModal réutilisable** ([components-ticket.jsx](cockpit/components-ticket.jsx)) : shape `{title, description, labels}`, suggestions d'autocomplete sur les labels existants, `Ctrl+Entrée` save / `Échap` cancel. Le modal affiche une section `metadata` (stade, âge, scores, signaux, Jarvis) read-only et des `extraActions` (status menu + Promouvoir/Jarvis/Parquer) en mode edit.
- **Pipeline 5 colonnes** : `seed` → `incubating` → `maturing` → `ready_to_promote` → `parked`. Drag natif HTML5 avec feedback `drophover` sur la colonne survolée, pending state visuel pendant le PATCH.
- **Galerie "post-its"** : cards colorées par catégorie (5 catégories : business, side, content, jarvis, life), sortées ready-first puis par `last_touched` desc.
- **Flagship** : l'idée "qui attend d'être promue" — la plus mature non-promue. Carte XL avec scores visuels, oneliner, body, prompt Jarvis, signaux source, CTA.
- **Détail inline** (`IdeaDetail`) : legacy path, atteignable uniquement via `openId` qui n'est plus défini par `handleOpen` (qui bascule sur le modal). **Dead code sur le chemin nominal**, mais composant toujours présent.
- **Suggestions Jarvis dérivées** : union (signaux rising/new non couverts par une idée existante) ∪ (top 3 opportunités non déjà promues depuis une idée). Dismiss persisté dans `localStorage.idea.suggestDismissed`. Accept → crée l'idée en `seed`.
- **Filtres combinables** : catégorie (via mapping heuristique `sector → category` dans le loader) + multi-labels en union (`some(l => labelFilter.includes(l))`).
- **Scores impact/effort/alignment** : **heuristiques**. `impact` dérivé de `market_size_estimate` (large=5, med=4, small=3, niche=2, default=3). `effort` dérivé de `competition_level` (low=2, med=3, high=4, default=3). `alignment` toujours = 3 (pas de colonne DB).
- **Télémétrie** : 6 events (voir section Appels externes).
- **Cross-panel write-in** : le panel `opps` peut créer une ligne `business_ideas` via le bouton "Envoyer au Carnet" ([panel-opportunities.jsx:537](cockpit/panel-opportunities.jsx:537)).

## Front — structure UI
Fichier : [cockpit/panel-ideas.jsx](cockpit/panel-ideas.jsx) — 1091 lignes, monté par [app.jsx:403](cockpit/app.jsx:403).

Structure DOM :
- `.panel-page[data-screen-label="Carnet d'idées"]`
  - `.panel-hero > .panel-hero-eyebrow + .panel-hero-title + .panel-hero-sub + .id-herometa` (4 stats)
  - `.id-capture` (input + boutons Capturer/Détails + message + hint clavier)
  - `.id-suggests` (conditionnel, si ≥ 1 suggestion active)
  - `.id-flagship` (conditionnel, si au moins une `ready_to_promote` ou `maturing`)
  - `.id-viewswitch` (Pipeline | Galerie + count total)
  - `.id-cats` (pills catégories)
  - `.id-labfilters` (conditionnel, si ≥ 1 label existe)
  - `.id-pipe > .id-pipe-col × 5` OU `.id-gallery > .id-note × N`
  - `.id-detail` (conditionnel, openId non-null — legacy)
  - `<TicketModal>` via `window.TicketModal` (portail modale)

Catégories frontend (fixes) : `business | side | content | jarvis | life` avec couleurs distinctes dans `CAT_COLOR`. Le mapping DB `sector → category` est dans le loader ([data-loader.js:805-826](cockpit/lib/data-loader.js:805)).

Route id = `"ideas"`. **Panel Tier 2**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelIdeas({ data, onNavigate })` | Composant racine — état (view/cat/labelFilter/captureValue/capturing/modal/pending) | [panel-ideas.jsx:413](cockpit/panel-ideas.jsx:413) |
| `FlagshipIdea({ idea, ... })` | Card XL pour l'idée phare (ready_to_promote | maturing la plus touchée) | [panel-ideas.jsx:113](cockpit/panel-ideas.jsx:113) |
| `PipelineView({ ideas, stages, onOpen, onMoveStatus, pending })` | 5 colonnes DnD natif HTML5 | [panel-ideas.jsx:182](cockpit/panel-ideas.jsx:182) |
| `GalleryView({ ideas, onOpen })` | Mur de post-its, ready-first | [panel-ideas.jsx:283](cockpit/panel-ideas.jsx:283) |
| `SuggestionsSection({ allIdeas, onAccept, onDismiss, dismissedIds })` | Suggestions dérivées signaux + opportunités | [panel-ideas.jsx:323](cockpit/panel-ideas.jsx:323) |
| `TicketModalSlot({ state, onSave, onCancel, ... })` | Wrapper qui lit `window.TicketModal` à l'exécution et injecte metadata + extraActions | [panel-ideas.jsx:955](cockpit/panel-ideas.jsx:955) |
| `IdLabelChip({ label, active, onClick, onRemove })` | Chip coloré (teinte stable hash(label)%360) | [panel-ideas.jsx:59](cockpit/panel-ideas.jsx:59) |
| `IdSignalChip({ name, onClick })` | Chip signal avec dot trend (rising/new/stable/declining) tiré de `SIGNALS_DATA` | [panel-ideas.jsx:101](cockpit/panel-ideas.jsx:101) |
| `normalizeLabel(s)` | Slugify libellé : lowercase, strip diacritiques, max 32 chars | [panel-ideas.jsx:29](cockpit/panel-ideas.jsx:29) |
| `parseHashtags(text)` | `"Titre #a #b"` → `{title, labels}` | [panel-ideas.jsx:40](cockpit/panel-ideas.jsx:40) |
| `labelTint(label)` | Hash → hue HSL déterministe | [panel-ideas.jsx:52](cockpit/panel-ideas.jsx:52) |
| `daysSince(iso)` / `ageLabel(iso)` | ISO → jours / "aujourd'hui"/"Nj"/"N sem."/"N mois" | [panel-ideas.jsx:86](cockpit/panel-ideas.jsx:86) |
| `patchIdea(id, patch)` (inline) | `PATCH /business_ideas?id=eq.{id}` + mutation in-memory | [panel-ideas.jsx:521](cockpit/panel-ideas.jsx:521) |
| `createIdea({title, body, labels, signals})` (inline) | `POST /business_ideas` + prepend dans `IDEAS_DATA.ideas` | [panel-ideas.jsx:629](cockpit/panel-ideas.jsx:629) |
| `handleCapture()` (inline) | Parse hashtags + `createIdea` + feedback temporaire | [panel-ideas.jsx:678](cockpit/panel-ideas.jsx:678) |
| `handleMoveStatus(id, nextStatus)` (inline) | Drop handler → `patchIdea({status, updated_at})` | [panel-ideas.jsx:707](cockpit/panel-ideas.jsx:707) |
| `handlePromote(id)` / `handleArchive(id)` (inline) | `confirm()` → `patchIdea({status: promoted\|parked})` | [panel-ideas.jsx:542, 558](cockpit/panel-ideas.jsx:542) |
| `handleAcceptSuggestion(sugg)` / `handleDismissSuggestion(key)` | Crée l'idée depuis suggestion → ouvre modal edit OU dismiss | [panel-ideas.jsx:725, 741](cockpit/panel-ideas.jsx:725) |
| `openCreateModal(prefillTitle, prefillLabels)` / `openEditModal(idea)` / `closeModal()` / `handleModalSave(ticket)` | Contrôle du modal ticket | [panel-ideas.jsx:578-624](cockpit/panel-ideas.jsx:578) |
| `handleOpen(id)` | Clic carte → `openEditModal` | [panel-ideas.jsx:536](cockpit/panel-ideas.jsx:536) |
| useEffect raccourcis (Ctrl+N, Ctrl+Shift+N, P, G) | Keyboard shortcuts panel-scopés | [panel-ideas.jsx:451-476](cockpit/panel-ideas.jsx:451) |
| `window.__ideasFocusCapture` exposé | Callback global pour que `app.jsx` puisse focus la capture après navigation | [panel-ideas.jsx:441-447](cockpit/panel-ideas.jsx:441) |
| Global `Ctrl+N` handler (app-level) | Navigate to ideas + focus capture via `__ideasFocusCapture` | [app.jsx:300-315](cockpit/app.jsx:300) |
| Global `Ctrl+6` (QUICK_PANELS) | Idées est le 6e panel du raccourci numérique | [app.jsx:319](cockpit/app.jsx:319) |
| `T2.ideas()` | `GET business_ideas?order=created_at.desc&limit=100` mémoïsé via `once()` | [data-loader.js:1231](cockpit/lib/data-loader.js:1231) |
| `buildIdeasFromDB(rows)` | DB rows → IDEAS_DATA shape + tri STATUS_ORDER + stats + `updated` (max updated_at) | [data-loader.js:911](cockpit/lib/data-loader.js:911) |
| `ideaCategoryFromSector(sector)` | Mapping heuristique `sector` → 5 catégories frontend (default=business) | [data-loader.js:859](cockpit/lib/data-loader.js:859) |
| `ideaKicker(r)` | `"Secteur · dim 14 avr"` depuis sector + created_at | [data-loader.js:868](cockpit/lib/data-loader.js:868) |
| `ideaOneLiner(description)` | Premier paragraphe / première phrase, tronqué 200 chars | [data-loader.js:877](cockpit/lib/data-loader.js:877) |
| `ideaRelativeUpdated(iso)` | ISO → "aujourd'hui" / "hier" / "il y a Nj/Nsem./Nmois" | [data-loader.js:884](cockpit/lib/data-loader.js:884) |
| `formatIdeasUpdated(iso)` | ISO → "Sam 24 avr · 14h30" (eyebrow hero "mis à jour …") | [data-loader.js:899](cockpit/lib/data-loader.js:899) |
| `loadPanel("ideas")` case | `T2.ideas()` → `buildIdeasFromDB` → mute `IDEAS_DATA.ideas/stats/updated` | [data-loader.js:4368](cockpit/lib/data-loader.js:4368) |

## Back — sources de données

| Table | Colonnes (schéma live) | Usage |
|-------|------------------------|-------|
| `business_ideas` | `id uuid PK, title text NOT NULL, description text, sector text, related_trends text[], related_concepts text[], status text DEFAULT 'seed', market_size_estimate text, competition_level text, timing_score text, notes text, competitors jsonb DEFAULT '[]', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), labels text[] NOT NULL DEFAULT '{}'` | **Lu** (T2, limit=100 order by created_at desc). **Écrit** (INSERT depuis capture/suggestions/opps→ideas, PATCH depuis promote/archive/move/edit/set labels). **Jamais DELETE** (RLS l'interdit). |

Volumétrie actuelle (2026-04-24) : **1 seule ligne en DB**. Le panel montre donc principalement la fake data de [cockpit/data-ideas.js](cockpit/data-ideas.js) (18 entrées démo) tant que `buildIdeasFromDB` retourne `null` sur un corpus vide (protection `if (!raw.length) return null;` à [data-loader.js:863](cockpit/lib/data-loader.js:863)).

**RLS** : 3 politiques actives sur `authenticated` — `auth_select (r)`, `auth_insert (a)`, `auth_update (w)`. Aucune politique DELETE → "Parquer" fait un `UPDATE status='parked'` (pas une suppression). Définies dans [sql/006_rls_authenticated.sql:60-62](sql/006_rls_authenticated.sql:60).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) : **aucune écriture dans `business_ideas`** (vérifié grep). Les ideas sont purement user-generated depuis le front.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : **aucune écriture dans `business_ideas`**.
- **Jarvis (local)** — [jarvis/indexer.py:55-64](jarvis/indexer.py:55) : indexe `business_ideas` dans `memories_vectors` pour le RAG. Chunk = `title + description + "Secteur: {sector}"` via `_build_ideas()` ([jarvis/indexer.py:138](jarvis/indexer.py:138)). PK=id, date_col=created_at. Meta exposée : title, sector, status. **Lecture uniquement — pas d'écriture retour.**
- **Cross-panel** : [panel-opportunities.jsx:537-577](cockpit/panel-opportunities.jsx:537) dans la fonction `handleSendToIdeas` — POST `business_ideas` avec sector, status='maturing', description enrichie, notes contextuelles (pertinence/fenêtre/effort/concurrence/marché/sources), related_concepts = signals + tags de l'opp.

## Appels externes
- **Supabase REST** :
  - `GET /rest/v1/business_ideas?order=created_at.desc&limit=100` via `T2.ideas()` (1× au premier clic sidebar, mémoïsé).
  - `POST /rest/v1/business_ideas` via `createIdea()` (capture + suggestions).
  - `PATCH /rest/v1/business_ideas?id=eq.{id}` via `patchIdea()` (promote, archive, move status, set labels, edit).
- **localStorage** :
  - `idea.view` : "pipeline" | "gallery" (persistant)
  - `idea.cat` : id catégorie active ("all" par défaut)
  - `idea.labels` : JSON array des labels actifs
  - `idea.suggestDismissed` : JSON array de clés `"sig:xxx"` ou `"opp:xxx"` dismissées
- **Télémétrie** (via `window.track()`) :
  - `idea_captured` (`{id, labels}`)
  - `idea_promoted` (`{id}`)
  - `idea_archived` (`{id}`)
  - `idea_moved` (`{id, from, to}`)
  - `idea_edited` (`{id}`)
  - `suggestion_accepted` (`{key, source}`)

## Dépendances
- **Onglets in** : sidebar ; `opps` via bouton "Envoyer au Carnet" ([panel-opportunities.jsx:537](cockpit/panel-opportunities.jsx:537)) qui POST puis navigue.
- **Onglets out** : `signals` (clic sur un chip signal via `handleOpenSignal`) ; `jarvis` (bouton "Demander à Jarvis").
- **Globals lus** :
  - `window.IDEAS_DATA` (ideas, stages, categories, stats)
  - `window.SIGNALS_DATA.signals` (SuggestionsSection + IdSignalChip pour trend)
  - `window.OPPORTUNITIES_DATA.opportunities` (fallback `OPPS_DATA` — cf. limitations)
  - `window.TicketModal` (composant global)
  - `window.sb`, `window.SUPABASE_URL` (client REST)
  - `window.track` (télémétrie)
- **Composants externes** : `<Icon>` (cockpit/icons.jsx), `<TicketModal>` (cockpit/components-ticket.jsx).
- **Pipelines** : aucun — **table 100 % user-generated**. Seul Jarvis indexer la lit pour le RAG.
- **Variables d'env / secrets** : aucun secret côté front. RLS requiert un JWT `authenticated` injecté par `cockpit/lib/auth.js`.

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant `T2.ideas()` ([app.jsx:391](cockpit/app.jsx:391)). Panel non monté tant que le status est `"loading"`.
- **DB vide** : `buildIdeasFromDB([])` retourne `null`, le loader ne remplace pas `IDEAS_DATA.ideas` → les 18 entrées fake de `data-ideas.js` restent affichées. **L'utilisateur ne voit pas de différence entre "DB vide" et "loader ok" — source de confusion**.
- **Client Supabase absent** : `createIdea`/`patchIdea` throw `"no client"` → capture affiche "Client Supabase indisponible.", promote/archive font un `alert("Échec…")`.
- **PATCH 4xx/5xx** : `patchIdea` throw, les handlers logguent puis `alert("Échec de la sauvegarde — réessaie.")`. Pas de rollback de l'UI (optimistic update a déjà muté `IDEAS_DATA.ideas`). **TODO** : la mutation in-memory reste en place même si la requête échoue (cf. limitations).
- **POST sans représentation** : `postJSON` retourne `r.json()` grâce au header `Prefer: return=representation` ([supabase.js:29](cockpit/lib/supabase.js:29)). Si la réponse est `[]` ou sans `id`, `createIdea` throw `"no row returned"`.
- **Drag sur sa propre colonne** : early-return si `current.status === nextStatus` dans `handleMoveStatus`.
- **Drag pendant un PATCH en cours** : bloqué par `pending[id]` (visuel `id-pipe-card--pending`, `draggable={!isPending}`).
- **Capture avec que des hashtags** : `parseHashtags("#a #b")` → title=`""` → message "Il faut au moins un titre avant les #libellés."
- **Flagship absent** : si aucune `ready_to_promote` ni `maturing`, `flagship` est `undefined` → section non rendue.
- **Suggestion déjà dismissée** : filtrée via `dismissedIds.includes(key)`. Pas de bouton "Réactiver" — l'utilisateur doit `localStorage.removeItem("idea.suggestDismissed")` à la main.
- **Suggestion sans title en DB** : `hasTitle(sugg.title)` bypass si un existing.title match.
- **Detail view après un patch** : `openIdea = allIdeas.find(i => i.id === openId)` — si la mutation a remplacé l'objet, l'ancien openId pointe dans le vide. Mais `handleOpen` bascule sur le modal donc cette branche est rarement atteinte.
- **`scope`/`sector` manquant** : `ideaCategoryFromSector(null)` → `"business"` par défaut.
- **Catégorie inconnue** : un `sector='aerospace'` retombe sur `"business"` dans `IDEA_SECTOR_TO_CATEGORY`.
- **Scores heuristiques** : une idée sans `market_size_estimate` ni `competition_level` reçoit impact=3, effort=3, alignment=3 → barres toutes à moitié (signal visuel "non noté" indiscernable de "noté moyen").

## Limitations connues / TODO
- [ ] **`touched_count` non persisté** : colonne absente du schéma. Le loader hardcode `touched_count: 1` à chaque build. Les affichages "×N" sont donc toujours "×1" sur les rows DB. La fake data (data-ideas.js) a des vraies valeurs, ce qui crée un écart perceptible.
- [ ] **`last_touched` = `updated_at`** : pas de colonne dédiée. Chaque PATCH bump `updated_at` → y compris les changements de label. OK mais ça crée du "je viens de toucher cette idée" pour des micro-edits.
- [ ] **`alignment` toujours = 3** : aucune colonne DB équivalente. La barre est affichée mais sans lien avec la donnée.
- [ ] **`related_ids` vide pour les rows DB** : le loader le met à `[]`. Le champ existe dans la fake data (id1 → id2 → id3) mais pas en base — donc la section "Idées liées" du detail est toujours vide pour les vraies idées.
- [ ] **`jarvis_prompt` et `jarvis_enriched` fake-only** : aucun champ DB équivalent → toujours vide sur une idée créée depuis le front. Conséquence : la flagship d'une vraie idée n'a pas de prompt socratique, et le detail/modal n'ont pas d'enrichissement Jarvis.
- [x] ~~**`promoted_to_opp` mal branché**~~ → **fixé** : la DB n'a pas de colonne de liaison idée→opp. Le loader retourne maintenant toujours `promoted_to_opp: null`. Le marqueur de promotion reste `status='promoted'` (idée disparue des 5 colonnes). Pas de "↗ opp {id}" affiché tant qu'on n'ajoute pas une vraie colonne de liaison.
- [x] ~~**Détail inline dead code**~~ → **supprimé** : `IdeaDetail` component + state `openId` + handler `handleSetLabels` + bloc de render retirés (~196 lignes). `handleAcceptSuggestion` ouvre maintenant le modal d'édition sur la nouvelle idée (cohérent avec `handleOpen`).
- [ ] **`window.OPPS_DATA` fallback** : ligne 508, on fallback sur `window.OPPS_DATA` qui n'est défini nulle part (le vrai global est `OPPORTUNITIES_DATA`). Code mort.
- [x] ~~**`teaser` dans la recherche**~~ → **fixé** : [panel-search.jsx:345](cockpit/panel-search.jsx:345) cherche maintenant sur `title,description,notes` (colonnes qui existent vraiment).
- [ ] **`alert()`/`confirm()` partout** : pas de toast system. `handleArchive`, `handlePromote`, `handleSendToIdeas` font des confirm natifs. Mauvaise UX sur mobile.
- [ ] **Suggestion-dismiss irréversible** : pas de bouton pour revoir les suggestions dismissées. Il faut vider le localStorage.
- [ ] **Pas de déduplication fuzzy sur la création** : `existingTitles = Set(title.toLowerCase())` fait un match exact ; "Launch LoRA" vs "Lancer un LoRA" passent toutes les deux.
- [ ] **Aucun pipeline n'alimente `business_ideas`** : contrairement au wiki (détection dans main.py) ou aux opportunités (weekly Claude), les idées ne sont jamais poussées automatiquement. Seul le bouton manuel "Envoyer au Carnet" depuis `opps` crée des rows.
- [ ] **Pas de lien "voir les idées promues"** : quand tu promeus, l'idée disparaît du kanban (status='promoted' absent des 5 colonnes) mais il n'y a pas de filtre "archive / promues" pour les retrouver. Elles ne remontent que via l'indexation Jarvis ou un SELECT direct DB.
- [ ] **Drag-and-drop natif HTML5** : ne marche pas sur tactile (mobile). Sur un iPhone, seule l'édition via modal est utilisable.
- [ ] **Capture bar max-length** : pas de limite côté front → un user peut poster 10KB dans un seul titre (col `title` text, pas de contrainte DB).
- [ ] **Catégories hardcoded côté front** ([panel-ideas.jsx:20-26](cockpit/panel-ideas.jsx:20) + [data-ideas.js:33-39](cockpit/data-ideas.js:33)) : ajouter une catégorie nécessite de toucher à 2 endroits + au mapping loader.
- [x] ~~**`IDEAS_DATA.updated` hardcodé**~~ → **fixé** : `buildIdeasFromDB` calcule `max(updated_at)` sur les rows DB et `formatIdeasUpdated()` le formate en "Sam 24 avr · 14h30". Loader case "ideas" écrit `window.IDEAS_DATA.updated` après fetch. Tant que la DB est vide, la valeur fake reste affichée (comportement cohérent avec le fallback fake-data du reste du panel).

## Dernière MAJ
2026-04-24 — rétro-doc + 4 fixes (promoted_to_opp, detail inline supprimé, teaser→notes, updated date branchée)
