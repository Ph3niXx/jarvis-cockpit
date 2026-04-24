# Opportunités

> Feed hebdomadaire de "fenêtres de tir à saisir" — 5-8 use cases/semaine générés par Claude Haiku à partir des articles de la semaine, affichés en 3 vues (éditorial / kanban par timing / timeline des deadlines), avec actions "Je saisis / Je passe" persistées en DB (colonne `user_status`) et pont vers le Carnet d'idées.

## Scope
pro

## Finalité fonctionnelle
Panel de **priorisation court-termiste** — chaque dimanche 22h UTC, `weekly_analysis.py` purge les lignes de la semaine en cours dans `weekly_opportunities` et regénère 5-8 nouvelles entrées via Claude Haiku 4.5 à partir des 40 derniers articles. Chaque opportunité est taguée (timing, effort, compétition, marché, secteur) et scorée par pertinence relative au profil. Le front transforme ces lignes DB en "cartes fenêtres de tir" avec deadline estimée depuis le `timing`, et force l'utilisateur à trancher : **Je saisis** / **Je passe**. Depuis la migration 011, les statuts sont persistés en DB (`weekly_opportunities.user_status` + `user_status_at`) via PATCH authenticated — plus de localStorage. Les historiques des semaines passées sont conservés (purge `week_start=eq.X` seulement). Une opportunité peut aussi être **envoyée au Carnet d'idées** (panel `ideas`) — qui lui, écrit dans `business_ideas`.

## Parcours utilisateur
1. Clic sidebar "Opportunités" (ou raccourci `Ctrl/Cmd+5`, cf. `QUICK_PANELS` [app.jsx:319](cockpit/app.jsx:319)) → Tier 2 `loadPanel("opps")` → résout les IDs d'articles source en batch contre `articles`, croise avec `SIGNALS_DATA`, remplit `window.OPPORTUNITIES_DATA`.
2. **Si la table est vide** : empty state dédié — "Aucune fenêtre ouverte pour l'instant" + 2 CTAs (Carnet d'idées, Signaux faibles). Plus de fake data.
3. Sinon : hero `N ouvertes · urgentes · Xj avant prochaine deadline · saisies · passées` (stats live calculées sur `enrichedOpps`, qui lit `user_status` DB + overrides optimistes).
4. **Flagship card** = la meilleure opp ouverte, triée par urgence puis `match` desc — CTAs "Je saisis" (PATCH `user_status=taken`), "Je passe" (`passed`), "Plan d'action" (pré-remplit Jarvis).
5. View switcher "Éditorial / Par timing / Fenêtres" — vue + scope persistés en localStorage (clés `opp.view`, `opp.scope`). **Les statuts ne sont plus en localStorage** depuis la migration 011.
6. Mode **Éditorial** : 5 pills scopes (Tous/Business/Side/Life/Jarvisception), cards groupées par scope, `MatchRing` SVG coloré 0-100%, `EffortGauge` (4 dots), `CompetitionBars` (3 barres), barre de progression fenêtre de tir.
7. Clic sur card → expand `.opp-detail` avec analyse, **bloc `.opp-detail-biz`** (Qui paye / Marché / Confiance avec classe couleur `--conf-{low,medium,high}`), why_you, sources, next_step, CTAs.
8. Mode **Kanban** : 4 colonnes ordonnées par urgence — "Trop tôt / Bon moment / Se rétrécit / Se dépêcher". Clic sur une carte → back en éditorial + scrollIntoView.
9. Mode **Timeline** : 9 mois à partir du **mois courant** (`new Date()` depuis le fix), barres horizontales de "aujourd'hui" à la date de fermeture, ligne verticale = aujourd'hui. Barre perpétuelle si `closes_iso=null`.
10. **Ledger bas de page** : deux colonnes "Je saisis / Je passe" avec bouton "Restaurer" (PATCH `user_status=null`).

## Fonctionnalités
- **Hero 5 stats** : cinq indicateurs en tête de page — opportunités ouvertes, urgentes, jours avant la prochaine deadline, déjà saisies et déjà passées.
- **Opportunité phare** : en haut de page, la meilleure opportunité ouverte (triée par urgence puis fit), avec trois actions — « Je saisis », « Je passe », « Plan d'action » (qui ouvre Jarvis avec un prompt prérempli).
- **Trois vues switchables** : Éditorial (cartes groupées par scope avec match ring, jauge d'effort, barres de concurrence et fenêtre de tir), Par timing (kanban quatre colonnes Trop tôt / Bon moment / Se rétrécit / Se dépêcher), Timeline (neuf mois à partir du mois courant avec barres horizontales de fenêtre).
- **Cinq filtres de scope** : Tous / Business / Side / Life / Jarvisception, pour ne voir qu'un type d'opportunités.
- **Détail enrichi au clic** : chaque carte dépliable expose analyse, bloc business (qui paye, taille de marché, niveau de confiance avec coloration), pourquoi c'est pour toi, sources d'articles, prochaine étape, signaux liés cliquables.
- **Statuts persistés en base** : « Je saisis » et « Je passe » sont sauvegardés en base de données avec horodatage — partagé entre appareils, avec mise à jour instantanée et restauration en cas d'erreur.
- **Envoyer au Carnet d'idées** : bouton qui crée une entrée riche dans le Carnet d'idées (titre + description + secteur + notes contextuelles) pour matérialiser l'opportunité en projet.
- **Ledger des arbitrages** : en bas de page, deux colonnes « Je saisis » / « Je passe » avec bouton « Restaurer » pour retirer un verdict donné par erreur.
- **Signaux faibles liés** : chaque opportunité affiche jusqu'à quatre chips de signaux détectés automatiquement dans son analyse, cliquables pour basculer vers le panel Signaux centré sur le terme.
- **Empty state pipeline** : quand aucune opportunité n'est disponible, un message explicite indique que le pipeline hebdomadaire tourne chaque dimanche soir, avec deux raccourcis (Carnet d'idées, Signaux).

## Front — structure UI
Fichier : [cockpit/panel-opportunities.jsx](cockpit/panel-opportunities.jsx) — 823 lignes, monté par [app.jsx:402](cockpit/app.jsx:402). CSS dédié : [cockpit/styles-opportunities.css](cockpit/styles-opportunities.css) — 861 lignes. Ressources incluses dans [index.html:23, 64, 87](index.html:23) (versions `css?v=3`, `data?v=2`, `jsx?v=4`).

Structure DOM quand des opportunités existent :
- `.panel-page[data-screen-label="Opportunités"]`
  - `.panel-hero` — eyebrow + titre + sub + `.opp-herometa` (5 stats)
  - `<FlagshipCard>` — `.opp-flagship` grid 2 cols (main + side fenêtre/signaux)
  - `.opp-viewswitch` — label + 3 toggle + compteur
  - `.opp-scopes` (éditorial only) — 5 `.pill`
  - Zone contenu conditionnelle : `.opp-list` / `<KanbanView>` / `<TimelineView>`
  - `.opp-ledger` (si takenOpps + passedOpps > 0)

Structure DOM quand vide :
- `.panel-page[data-screen-label="Opportunités"] > .panel-hero`
  - eyebrow "Opportunités · en attente du pipeline hebdo"
  - h1 "Aucune fenêtre ouverte pour l'instant"
  - sub explicatif avec code inline `weekly_opportunities`
  - `.opp-empty-actions` — 2 boutons ghost (Ouvrir carnet, Voir signaux)

Route id = `"opps"`. **Panel Tier 2** ([data-loader.js:4465](cockpit/lib/data-loader.js:4465)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelOpportunities({ data, onNavigate })` | Composant racine — short-circuit empty state, 3 vues, 5 scopes, view/scope persistés localStorage | [panel-opportunities.jsx:447](cockpit/panel-opportunities.jsx:447) |
| `persistStatus(id, nextStatus)` | Optimistic `statusOverrides[id]` + `PATCH /rest/v1/weekly_opportunities?id=eq.X` avec `{user_status, user_status_at}` + rollback + telemetry | [panel-opportunities.jsx:528](cockpit/panel-opportunities.jsx:528) |
| `handleTake(id)` / `handlePass(id)` / `handleReset(id)` | Thin wrappers sur `persistStatus(id, "taken"|"passed"|null)` | [panel-opportunities.jsx:561-563](cockpit/panel-opportunities.jsx:561) |
| `FlagshipCard({ opp, onTake, onPass, onOpenSignal, onAskJarvis })` | Hero card de la meilleure opp | [panel-opportunities.jsx:129](cockpit/panel-opportunities.jsx:129) |
| `OppCard({ opp, open, onToggle, onTake, onPass, onReset, onOpenSignal, onAskJarvis, onSendToIdeas })` | Card éditoriale avec expand détail (incluant `.opp-detail-biz`) | [panel-opportunities.jsx:195](cockpit/panel-opportunities.jsx:195) |
| `KanbanView({ opps, onOpen, onTake, onPass })` | 4 colonnes groupées par `window.urgency` | [panel-opportunities.jsx:312](cockpit/panel-opportunities.jsx:312) |
| `TimelineView({ opps, onOpen })` | 9 mois depuis le mois courant (`new Date()`) avec barres horizontales | [panel-opportunities.jsx:356](cockpit/panel-opportunities.jsx:356) |
| `MatchRing({ value, size, stroke })` | SVG cercle 0-100% avec 4 paliers | [panel-opportunities.jsx:86](cockpit/panel-opportunities.jsx:86) |
| `EffortGauge` / `CompetitionBars` / `SignalChip` | Micro-composants visuels | [panel-opportunities.jsx:51, 67, 116](cockpit/panel-opportunities.jsx:51) |
| `handleAskJarvis(opp)` | Stash `jarvis-prefill-input` + `onNavigate("jarvis")` | [panel-opportunities.jsx:564](cockpit/panel-opportunities.jsx:564) |
| `handleSendToIdeas(opp)` | `POST /rest/v1/business_ideas` + `track("opp_sent_to_ideas")` + `track("error_shown")` si échec | [panel-opportunities.jsx:570](cockpit/panel-opportunities.jsx:570) |
| `handleOpenSignal(signalName)` | Stash `signals-focus-name` + `onNavigate("signals")` | [panel-opportunities.jsx:618](cockpit/panel-opportunities.jsx:618) |
| `T2.opps()` | `GET weekly_opportunities?order=week_start.desc&limit=40` (inclut `user_status` + `user_status_at`) | [data-loader.js:1230](cockpit/lib/data-loader.js:1230) |
| `buildOpportunitiesFromDB(rows, signals, articleIndex)` | Transforme DB → shape panel (dédup, mapping, window estimé, lit `user_status` → `status`) | [data-loader.js:737-803](cockpit/lib/data-loader.js:737) |
| `loadPanel("opps")` case | Batch-résolution articles + `buildOpportunitiesFromDB` + assign | [data-loader.js:4279-4306](cockpit/lib/data-loader.js:4279) |

## Back — sources de données

| Table | Colonnes lues / écrites | Volumétrie |
|-------|--------------------------|------------|
| `weekly_opportunities` | **Read** : `id, week_start, usecase_title, usecase_description, source_articles[], category, sector, who_pays, market_size, effort_to_build, competition, timing, relevance_score, relevance_why, next_step, confidence, user_status, user_status_at`. **Write (front PATCH)** : `user_status` (nullable text taken/passed), `user_status_at` (timestamptz). | 8 lignes actuelles. Pipeline génère 5-8/semaine (regen `week_start=eq` seulement). RLS : `auth_select` + `auth_update_user_status` (migration 011, `using(true) with check(true)`). |
| `articles` | **Read** : `id, title, source, url, fetch_date` en batch pour résoudre les UUID des `source_articles`. | 621 lignes, cap `limit=200` par batch. |
| `business_ideas` | **Write (POST)** : `{title, description, sector, status:"maturing", notes, related_concepts}` sur "Envoyer au carnet d'idées". | Write via JWT `authenticated`. |
| `signal_tracking` (via `SIGNALS_DATA` Tier 1) | **Read** : matching des signaux dans le body + coloration des `SignalChip`. | — |

## Back — pipelines qui alimentent
- **Weekly pipeline** ([weekly_analysis.py:583-659](weekly_analysis.py:583)) — cron `0 22 * * 0` via [.github/workflows/weekly_analysis.yml](.github/workflows/weekly_analysis.yml). **Step 6/6** :
  1. `week_start = lundi courant`
  2. `sb_delete("weekly_opportunities", f"week_start=eq.{week_start}")` — **purge uniquement la semaine courante** (fix). Les anciennes opportunités sont préservées.
  3. `sb_get("articles", ..., limit=60)` — contexte semaine.
  4. Compile `user_ctx` via `get_user_context()` (profil + 8 axes radar).
  5. `call_claude(system, prompt, max_tokens=4096)` — Claude Haiku 4.5 avec prompt dédié.
  6. Loop `sb_post("weekly_opportunities", opp + week_start)` (pas d'upsert). `user_status` et `user_status_at` restent NULL à l'insertion.
  7. Coût logué dans `weekly_analysis.tokens_used`.
- **Migration 011** (appliquée via MCP Supabase le 2026-04-24) — ajoute `user_status` + `user_status_at` + policy `auth_update_user_status`. Pas de fichier SQL versionné, appliquée directement.
- **Daily pipeline** : aucune interaction.
- **Jarvis (local)** : indexé dans `memories_vectors` (source_table=`weekly_opportunities`) via [jarvis/indexer.py](jarvis/indexer.py). Consommable en mode Deep/Cloud.
- **Front** : writer pour `user_status` / `user_status_at` (PATCH) et `business_ideas` (POST via Send to Ideas).

## Appels externes
- **Supabase REST (lecture)** :
  - `T2.opps()` → `GET /rest/v1/weekly_opportunities?order=week_start.desc&limit=40`.
  - Batch articles → `GET /rest/v1/articles?id=in.(...)&select=id,title,source,url,fetch_date&limit=200`.
- **Supabase REST (écriture)** :
  - `window.sb.patchJSON(/rest/v1/weekly_opportunities?id=eq.X, {user_status, user_status_at})` — take/pass/reset.
  - `window.sb.postJSON(/rest/v1/business_ideas, payload)` — send to ideas.
- **Anthropic Claude API** (backend) — `claude-haiku-4-5` via `call_claude`.
- **localStorage** :
  - `opp.scope`, `opp.view` — persistance UI (scope + vue active).
  - `jarvis-prefill-input`, `signals-focus-name` — stash pour cross-nav.
  - **`opp.status` retiré** depuis le fix (migration 011 + PATCH).
- **Telemetry** :
  - `window.track("opp_status_changed", { opp_id, status })` — take/pass/reset.
  - `window.track("opp_sent_to_ideas", { opp_id, idea_id })` — send to ideas.
  - `window.track("error_shown", { context, message })` — erreurs PATCH + POST.

## Dépendances
- **Onglets in** : sidebar "Opportunités" (`Ctrl/Cmd+5`), `ideas` (cross-nav conceptuel via bouton "Promouvoir en opportunité").
- **Onglets out** : `jarvis`, `signals`, `ideas`.
- **Pipelines obligatoires** : `weekly_analysis.yml` + migration 011.
- **Tier 1 dépendances** : `SIGNALS_DATA` + `articleIndex` construit à la volée.
- **Variables d'env / secrets** :
  - Backend : `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`.
  - Front : clé publishable Supabase + JWT Google OAuth.

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant `T2.opps()` + batch articles.
- **Empty `weekly_opportunities`** : empty state dédié — `OPPORTUNITIES_DATA.opportunities=[]` déclenche le short-circuit au début de `PanelOpportunities` → hero "Aucune fenêtre ouverte" + 2 CTAs (ideas, signals). Plus jamais de fake data.
- **Scope filtré vide** : `.opp-group` affiche "Aucune opportunité ouverte dans ce scope cette semaine." (éditorial + scope ≠ all).
- **PATCH `user_status` échoue** : `setStatusOverrides` rollback à la valeur précédente, `track("error_shown")` émis, `alert("Impossible d'enregistrer le statut. Réessaie dans un instant.")`.
- **`window.sb` absent au moment du PATCH** : l'override local est quand même appliqué, `track("error_shown", { context: "opps:persist", message: "supabase client not ready" })` — pas d'alert (fail silencieux assumé, la session arrivera).
- **`closes_iso` null (perpétuel)** : `windowProgress` retourne 0.15, `formatWindow` affiche "perpétuel", timeline bar variant `--perpetual` à 98%.
- **Résolution d'article échouée** : `try/catch` autour du batch, fallback `console.warn` + sources avec `{who:"article", what:uuid.slice(0,40)}`.
- **PATCH `business_ideas` échoue** : `track("error_shown")` + `alert`.
- **Opp sans `user_status` en DB** : `dbStatus=""` → cascade `status="open"` dans `buildOpportunitiesFromDB` ([data-loader.js:767-768](cockpit/lib/data-loader.js:767)).
- **Opp avec `user_status` inattendu** (ni taken ni passed) : fallback `"open"` (guard `dbStatus === "taken" || "passed"`).
- **Dédup supprime des entrées** : si deux opps ont le même `titleKey` normalisé, la plus récente gagne (`week_start` desc).
- **Erreur réseau Tier 2** : `PanelError` avec bouton Réessayer.

## Limitations connues / TODO
- [x] ~~`today` hardcodé au 21/04/2026~~ — **fixé** : `new Date()` dans TimelineView.
- [x] ~~Fake data affichée si DB vide~~ — **fixé** : `data-opportunities.js` vidé + empty state dédié dans le panel.
- [x] ~~Purge backend agressive (`lte`)~~ — **fixé** : passé à `eq.{current_week}`, historique préservé.
- [x] ~~Statuts en localStorage, pas en DB~~ — **fixé** : migration 011 + PATCH + optimistic update + rollback.
- [x] ~~`alert()` sans télémétrie~~ — **fixé** : `track("error_shown")` systématique avant chaque alert.
- [x] ~~`confidence` / `who_pays` / `market_size` cachés~~ — **fixé** : bloc `.opp-detail-biz` dans le détail étendu avec couleur par niveau de confiance.
- [ ] **Deadlines estimées, pas explicites** : le pipeline ne stocke pas de `closes_at`. Claude ne produit que `timing` enum → estimation naive. Pour avoir "ferme le 15/08/2026" précisément, le prompt doit générer une date ISO.
- [ ] **Matching de signaux naïf** : `body.toLowerCase().includes(signal.name.toLowerCase())` — faux positifs sur noms courts ("mcp" matche "e-commerce" si présent).
- [ ] **RLS `using(true) with check(true)`** sur `auth_update_user_status` : tout authenticated peut muter n'importe quelle ligne. À durcir si multi-utilisateurs un jour.
- [ ] **Pas de migration SQL versionnée pour 011** : la migration a été appliquée via `mcp__supabase__apply_migration` mais pas poussée dans [sql/](sql/). À recréer si re-provision.
- [ ] **Mode Kanban/Timeline masquent les pills de scope** : l'utilisateur voit `scopeFiltered` sans comprendre pourquoi. Ajouter un indicateur "Scope actif : X" dans ces vues.
- [ ] **`flagship` peut changer silencieusement** : si l'utilisateur passe la flagship, la suivante prend la place sans transition ni animation.
- [ ] **Pas de scroll-into-view après cross-nav depuis signal** : on arrive sur la page, pas de focus sur l'opp correspondante.
- [ ] **`confidence` en enum `low|medium|high` hardcodé** : si le pipeline évolue et produit d'autres valeurs, fallback CSS silencieux.
- [ ] **Pas de filtre par statut visible** : impossible de voir uniquement "mes saisies" ou "mes refus" dans la vue principale — on a juste le ledger en bas.

## Dernière MAJ
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — rétro-doc + 6 correctifs appliqués (today dynamique, fake data purgée, empty state, purge backend incrémentale, statuts en DB via migration 011, `.opp-detail-biz`, telemetry error) — commit `c456ac9` (base) + migration 011 appliquée.
