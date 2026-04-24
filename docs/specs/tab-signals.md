# Signaux faibles

> Détecteur éditorial d'n-grams IA en mouvement dans la veille RSS — 3 vues (éditoriale, hype cycle, co-occurrences), watchlist persistante et cross-nav Veille/Jarvis/Opportunités.

## Scope
pro

## Finalité fonctionnelle
Tracker les termes IA qui **montent ou disparaissent** dans les sources de veille avant que le mainstream ne les reprenne. `main.py` extrait chaque matin les mentions de ~120 concepts (CONCEPT_KEYWORDS) dans les titres + summaries d'articles RSS, upsert dans `signal_tracking` agrégé à la semaine ISO, puis recalcule la tendance (`new` / `rising` / `declining` / `stable`) en comparant au lundi précédent. Le panel transforme ce compteur brut en grille éditoriale priorisée + vue Gartner-ish (maturité × momentum) + graphe de co-occurrences. Objectif : capter les termes entre *émergence* et *pic de hype* pour arbitrer mission RTE, idées business et veille personnelle.

## Parcours utilisateur
1. Clic sidebar "Signaux faibles" (ou **Ctrl/Cmd+4** via `QUICK_PANELS[3]` à [app.jsx:319](cockpit/app.jsx:319)) → Tier 2 `loadPanel("signals")`.
2. *Possiblement* arrivée cross-nav depuis Opportunités : `localStorage.signals-focus-name` consommé au mount, force `trendFilter="all"`, `view="editorial"`, ouvre le row matching (case-insensitive) et scroll center ([panel-signals.jsx:750-764](cockpit/panel-signals.jsx:750)).
3. Lecture hero : 4 stats synthétiques (`rising` / `new` / `declining` / `watchlist`) calculées à la volée depuis `SIGNALS_DATA.signals`.
4. Watchlist (si `watched.length > 0`) : 2 colonnes — cards des signaux suivis (sparkline mini) + liste des 6 dernières alertes triées par semaine desc.
5. Priority grid : 4 PriorityCell calculés `sort(new first, then rising by delta)`. Clic → `openSignal(id)` = bascule en éditorial + ouvre le row + scroll.
6. View switcher (3 boutons persistés `sig.view`) :
   - **Éditorial** : toolbar (`Tendance: all/rising/new/declining`, `Fenêtre: 4/8/12 sem`, Export CSV) + groupes par `category`, rows cliquables avec `SignalDetail` (big graph 12 sem + jarvis_take + liste sources + 2 CTAs : "Voir la veille filtrée" / "Demander à Jarvis").
   - **Cycle de hype** : SVG Gartner-ish 1000×540 avec courbe fixe (`hypeCurveY`), signaux positionnés par `maturity` (x = bucket + jitter par delta) et hauteur ajustée au momentum. Halos, labels staggerés 4 slots, légende trend.
   - **Co-occurrences** : SVG 1000×620 radial, angle = catégorie, distance = inverse de `count`, edges depuis `related[]`. Hover isole le cluster.
7. Clic bookmark sur un row/cell → toggle `watched` (persisté `sig.watch`).
8. Export CSV : bouton `.btn--ghost` en bout de toolbar éditoriale, télécharge `signals-YYYY-MM-DD.csv` (8 colonnes, BOM UTF-8 pour Excel FR).
9. Depuis `SignalDetail` :
   - "Voir la veille filtrée" → stash `veille-prefill-query` = `signal.name`, nav `search`.
   - "Demander à Jarvis" → stash `jarvis-prefill-input` = prompt multi-ligne prérempli (catégorie, tendance, sources top 5), nav `jarvis`.

## Fonctionnalités
- **Trois vues switchables** : Éditorial (liste groupée par catégorie), Cycle de hype (positionnement sur courbe Gartner) et Co-occurrences (graphe radial de termes qui apparaissent ensemble). La préférence de vue est mémorisée.
- **Hero 4 stats** : nombre de signaux en hausse, nouveaux, en baisse, et taille de la watchlist personnelle, pour situer l'actualité des signaux en un coup d'œil.
- **Priority picks** : quatre cartes mises en avant, priorisant les nouveaux puis les plus fortes hausses, pour savoir quoi regarder en premier.
- **Détail par signal** : clic sur un signal révèle un grand graphique 12 semaines, une courte analyse Jarvis, la liste des sources citées et deux raccourcis — « Voir la veille filtrée » (ouvre la Recherche pré-remplie sur le terme) et « Demander à Jarvis » (ouvre l'assistant avec un prompt contextualisé).
- **Watchlist persistante** : bouton bookmark sur chaque signal, les signaux suivis apparaissent dans un bloc dédié en tête de page avec leurs alertes récentes.
- **Fenêtre d'analyse 4 / 8 / 12 semaines** : toggle pour changer l'horizon des courbes et des sparklines. La préférence est mémorisée.
- **Filtres tendance** : quatre pills (Tous / En hausse / Nouveaux / En baisse) avec compteurs live.
- **Cycle de hype** : chaque signal est placé sur une courbe Gartner (innovation → pic → trough → recovery) selon sa maturité, avec la taille du point modulée par son momentum.
- **Graphe de co-occurrences** : les signaux qui apparaissent ensemble dans plusieurs articles sont reliés, hover isole le cluster.
- **Synthèse hebdo** : un pavé collapsible en haut du panel résume en prose ce qu'il faut retenir des signaux de la semaine, généré automatiquement chaque dimanche.
- **Export CSV** : bouton en toolbar éditoriale qui télécharge la liste filtrée au format CSV (encodée pour Excel français), pour partager une sélection avec une autre équipe.
- **Navigation entrante depuis Opportunités** : arriver via une opportunité filtre automatiquement sur le signal lié et ouvre son détail.

## Front — structure UI
Fichier : [cockpit/panel-signals.jsx](cockpit/panel-signals.jsx) — 1045 lignes, monté à [app.jsx:397](cockpit/app.jsx:397). Données de référence (fake) : [cockpit/data-signals.js](cockpit/data-signals.js) — 369 lignes, shape canonique + `maturity_positions` (overridé à l'hydratation par `buildSignalsFromDB`).

Structure DOM principale :
- `.panel-page[data-screen-label="Signaux faibles"]` (classe conditionnelle `sig-dense` si density=dense)
  - `.panel-hero` — eyebrow `S{N} · mis à jour {ts}`, titre "Détecteur d'*opportunités*", sub dynamique, `.sig-herometa` 4 stats
  - `<WatchlistPanel>` ([:212](cockpit/panel-signals.jsx:212)) — `.sig-watch-empty` si aucun signal suivi, sinon `.sig-watch` 2 colonnes + bouton "Vider"
  - `.sig-priority` — 4 `<PriorityCell>` dans `.sig-priority-grid`
  - `.sig-viewswitch` — 3 boutons (Éditorial / Cycle de hype / Co-occurrences)
  - Branche selon `view` :
    - `editorial` → `.panel-toolbar` (filtres + Fenêtre + Export CSV) + `.sig-groups > .sig-group > .sig-list > .sig-row[data-sig-id]` (expand via `SignalDetail`)
    - `hype` → `<HypeCycleView>` ([:327](cockpit/panel-signals.jsx:327)) — SVG 1000×540
    - `graph` → `<CoOccurGraph>` ([:500](cockpit/panel-signals.jsx:500)) — SVG 1000×620 radial
  - `<TweaksPanelSig>` floating si `editMode` (activé par postMessage `__activate_edit_mode`)

DOM id `#signals` (via `dom_id` sidebar) — **Panel Tier 2** ([data-loader.js:4468](cockpit/lib/data-loader.js:4468)) ET **Panel Quick** (Ctrl+4, [app.jsx:319](cockpit/app.jsx:319)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelSignals({ data, onNavigate })` | Composant racine — lit `window.SIGNALS_DATA`, branche éditorial/hype/graph | [panel-signals.jsx:674](cockpit/panel-signals.jsx:674) |
| `SignalGraph({ history, trend, ... })` | SVG 520×140 en aire + ligne + points + labels X/Y (gridlines 25/50/75/100%, semaines padStart) | [panel-signals.jsx:13](cockpit/panel-signals.jsx:13) |
| `MiniSpark({ history, trend })` | Sparkline inline 100×28, couleur dynamique par trend | [panel-signals.jsx:55](cockpit/panel-signals.jsx:55) |
| `DeltaChip({ signal })` | Chip `nouveau` / `↑ +N / 8 sem` / `↓ N / 8 sem` / `stable` | [panel-signals.jsx:75](cockpit/panel-signals.jsx:75) |
| `SignalDetail({ signal, windowWeeks, onNavigate })` | Bloc expand — big graph + jarvis_take + liste sources + 2 CTAs | [panel-signals.jsx:86](cockpit/panel-signals.jsx:86) |
| `handleSeeVeille()` (inline) | `localStorage.setItem("veille-prefill-query", signal.name)` + nav `search` | [panel-signals.jsx:87-91](cockpit/panel-signals.jsx:87) |
| `handleAskJarvis()` (inline) | Construit un prompt multi-ligne contextualisé, stash `jarvis-prefill-input`, nav `jarvis` | [panel-signals.jsx:92-97](cockpit/panel-signals.jsx:92) |
| `SignalRow({ signal, rank, open, onToggle, watched, onWatch, ... })` | Row cliquable 6 cols + bouton bookmark (stopPropagation) | [panel-signals.jsx:146](cockpit/panel-signals.jsx:146) |
| `PriorityCell({ signal, rank, onOpen, watched, onWatch })` | Cell grande pour grille priority | [panel-signals.jsx:184](cockpit/panel-signals.jsx:184) |
| `WatchlistPanel({ signals, watched, onToggle, onOpen, onClear })` | 2 cols : cards signaux suivis + liste alertes récentes (max 6, sorted desc) | [panel-signals.jsx:212](cockpit/panel-signals.jsx:212) |
| `hypeCurveY(x)` | Courbe Gartner lissée par cosinus (3 segments : rise → peak → trough → recovery) | [panel-signals.jsx:309](cockpit/panel-signals.jsx:309) |
| `HypeCycleView({ signals, onOpen, watched, onWatch })` | SVG cycle de hype + placement collision-aware par bucket `maturity` | [panel-signals.jsx:327](cockpit/panel-signals.jsx:327) |
| `CoOccurGraph({ signals, onOpen, watched })` | Layout radial par catégorie, edges depuis `related[]`, hover-highlight cluster | [panel-signals.jsx:500](cockpit/panel-signals.jsx:500) |
| `exportSignalsCSV(signals)` | Génère CSV 8 colonnes avec BOM UTF-8, `download="signals-{iso}.csv"` | [panel-signals.jsx:655](cockpit/panel-signals.jsx:655) |
| Focus cross-panel (`useEffect`) | Consomme `localStorage.signals-focus-name` (stashé par Opportunités), match case-insensitive, ouvre le row + scroll | [panel-signals.jsx:750-764](cockpit/panel-signals.jsx:750) |
| Edit mode listener (`useEffect`) | `window.addEventListener("message")` pour `__activate_edit_mode` / `__deactivate_edit_mode` | [panel-signals.jsx:768-776](cockpit/panel-signals.jsx:768) |
| `toggleWatch(id)` (inline) | Toggle array dans `watched` + persist `sig.watch` | [panel-signals.jsx:692-698](cockpit/panel-signals.jsx:692) |
| `openSignal(id)` (inline) | Set view=editorial + openId + scroll avec 80ms timeout | [panel-signals.jsx:791-797](cockpit/panel-signals.jsx:791) |
| `clearWatch()` (inline) | Vide la watchlist | [panel-signals.jsx:798](cockpit/panel-signals.jsx:798) |
| `TweaksPanelSig({ density, setDensity, windowWeeks, setWindowWeeks, view, setView })` | Panel floating fixed bottom-right en iframe edit mode | [panel-signals.jsx:979](cockpit/panel-signals.jsx:979) |
| `loadSignals()` (Tier 1) | `GET signal_tracking?order=mention_count.desc&limit=60` | [data-loader.js:82-84](cockpit/lib/data-loader.js:82) |
| `buildSignals(rows)` (Tier 1 lite) | Dedupe par term (latest week_start wins), max 20 → shape simple pour stats hero | [data-loader.js:185-204](cockpit/lib/data-loader.js:185) |
| `buildSignalsFromDB(rows, wikiConcepts)` | Reconstruction complète : group by term, history padding, delta_4w, maturity heuristique, co-occurrences sources ≥ 2 | [data-loader.js:506-625](cockpit/lib/data-loader.js:506) |
| `signalCategoryLabel(cat)` | Mapping `wiki_concepts.category` → label FR panel | [data-loader.js:477-481](cockpit/lib/data-loader.js:477) |
| `slugifySignal(s)` | Normalise le term pour matcher `wiki_concepts.slug` | [data-loader.js:499-504](cockpit/lib/data-loader.js:499) |
| `weekLabel(iso)` | `S{NN}` ISO week depuis une date | [data-loader.js:494-497](cockpit/lib/data-loader.js:494) |
| `loadPanel("signals")` case | Fetch `signal_tracking` 500 rows + `wiki_concepts`, rebuild via `buildSignalsFromDB` | [data-loader.js:4233-4246](cockpit/lib/data-loader.js:4233) |
| `hydrateGlobalsFromTier1()` (signals branch) | Partial hydratation au boot depuis `raw.signals` (60 rows Tier 1) — remplacée au visit Tier 2 | [data-loader.js:4495-4504](cockpit/lib/data-loader.js:4495) |

## Back — sources de données

| Table | Colonnes lues / écrites | Volumétrie observée (2026-04-24) |
|-------|--------------------------|----------------------------------|
| `signal_tracking` | **Read (front)** : `id, term, week_start, mention_count, sources, trend, created_at`. **Write (pipeline daily)** : insert (`term, week_start, mention_count, sources, trend="new"`) + patch (`mention_count, sources`). **Write (pipeline daily final step)** : patch `trend`. | 86 lignes, 39 termes uniques, **4 semaines seulement** (2026-03-30 → 2026-04-20). Le schéma n'a **pas** de colonnes `history`, `delta`, `category`, `context`, `jarvis_take`, `alerts`, `first_seen`, `last_seen` — tout ça est calculé côté front. |
| `wiki_concepts` | **Read (front T2 signals case)** : `slug, category` pour résoudre la catégorie via slug-matching. | lecture seule côté signaux — la table vit surtout pour le wiki |
| `weekly_analysis` | `signals_summary` écrit par `weekly_analysis.py::analyze_signals` mais **non consommé par le panel** (voir Limitations). | une ligne/semaine |

Schéma réel `signal_tracking` (Postgres) :
```
id uuid NOT NULL
term text NOT NULL
week_start date NOT NULL
mention_count integer NULL
sources text[] NULL            -- URLs d'articles (pas "who — what")
trend text NULL                -- "new" | "rising" | "stable" | "declining"
created_at timestamptz NULL
```

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) — `.github/workflows/daily_digest.yml` cron `0 6 * * 1-5` (+ ping samedi 10h UTC).
  - [`extract_concepts(articles)`](main.py:584) : scan title+summary des articles du jour contre `CONCEPT_KEYWORDS` (dict ~120 entrées IA/régulation/RTE/code — [main.py:~500-582](main.py:500)). Produit `{slug: {name, count, sources[urls]}}`.
  - [`track_signals(concept_mentions)`](main.py:680) : calcule `week_start = monday(today)`, upsert par `(term, week_start)` — si existant : `mention_count += count` + merge `sources[]` dédupliqué top 10 ; sinon insert avec `trend="new"`.
  - [`update_signal_trends()`](main.py:732) : après tous les inserts, compare chaque terme de la semaine courante à la semaine précédente. Seuils : `prev==0 → new`, `curr > 1.5*prev → rising`, `curr < 0.5*prev → declining`, sinon `stable`.
  - Appelé dans `main()` à [main.py:964-965](main.py:964).
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) — `.github/workflows/weekly_analysis.yml` cron `0 22 * * 0` :
  - [`analyze_signals()`](weekly_analysis.py:280) : lit top 20 `signal_tracking` de la semaine courante, formatte en bullet list, envoie à Claude Haiku 4.5 avec le profil utilisateur. Retourne une analyse en 4-5 phrases.
  - Écrit dans `weekly_analysis.signals_summary` à [weekly_analysis.py:690](weekly_analysis.py:690). **Ce summary n'est lu par aucun composant cockpit** — gap d'intégration.
  - N'écrit rien dans `signal_tracking`.
- **Jarvis (local)** : aucune interaction avec `signal_tracking`. Le panel envoie des prompts vers Jarvis via `jarvis-prefill-input`, mais Jarvis ne relit pas ni n'écrit la table.

## Appels externes
- **Supabase REST (lecture Tier 1)** : `GET /rest/v1/signal_tracking?order=mention_count.desc&limit=60` au boot.
- **Supabase REST (lecture Tier 2)** : `GET /rest/v1/signal_tracking?order=week_start.desc,mention_count.desc&limit=500` + `T2.wiki()` à la première visite — memoized via `once("signals_full", ...)`.
- **localStorage** : `sig.density`, `sig.window`, `sig.view`, `sig.watch` (lecture + écriture), `signals-focus-name` (lecture), `veille-prefill-query` et `jarvis-prefill-input` (écriture).
- **Navigation interne** : `onNavigate("search")`, `onNavigate("jarvis")`.
- **Téléchargement local** : `Blob + URL.createObjectURL` pour export CSV.
- **postMessage** : écoute `__activate_edit_mode` / `__deactivate_edit_mode` (iframe dev tools), envoie `__edit_mode_available` au parent au mount.
- Pas d'appel API externe depuis le panel — le pipeline `main.py` consomme les flux RSS côté backend.

## Dépendances
- **Onglets in** :
  - Opportunités (`panel-opportunities.jsx:588`) — stash `signals-focus-name` avant `onNavigate("signals")`.
  - Sidebar principale (groupe "Apprentissage").
  - Raccourci clavier **Ctrl/Cmd+4** (`QUICK_PANELS` à [app.jsx:319](cockpit/app.jsx:319)).
- **Onglets out** :
  - Search (via `veille-prefill-query`) pour filtrer la veille sur le nom du signal.
  - Jarvis (via `jarvis-prefill-input`) pour demander un take contextualisé.
- **Pipelines** : `main.py` (obligatoire — sans lui, `signal_tracking` vide → panel `signals: []`). `weekly_analysis.py` optionnel (génère un summary non affiché).
- **Variables d'env / secrets** : `GEMINI_API_KEY` (pipeline daily, techniquement utilisée par `main.py` pour le brief mais pas par `track_signals`), `SUPABASE_URL` + `SUPABASE_KEY` + `SUPABASE_SERVICE_KEY` (pipelines), `ANTHROPIC_API_KEY` (weekly pour le summary non affiché).
- **Table `wiki_concepts`** : obligatoire pour résoudre la catégorie. Si le concept n'y est pas, fallback `"Autres"`.

## États & edge cases
- **Loading** : `PanelLoader` générique pendant `loadPanel("signals")` (Tier 2 gating à [app.jsx:391](cockpit/app.jsx:391)).
- **Erreur réseau Tier 2** : `PanelError` avec bouton Réessayer (géré globalement par `app.jsx`).
- **Empty `signal_tracking`** : `buildSignalsFromDB` retourne `null` → `SIGNALS_DATA` reste sur la fake data de `data-signals.js` (16 signaux mockés en `S17`). ⚠️ **Pas de message explicite** "pipeline non exécuté".
- **Empty après boot (hydratation `raw.signals = []`)** : `buildSignalsFromDB` retourne `null`, la fake data reste affichée. Mêmes conséquences que ci-dessus.
- **Filtre sans résultat** (ex. `declining` alors que tout est stable) : les groupes affichent 0 rows, `.sig-priority-grid` peut être partiellement vide. Pas de `empty state` pour les pills.
- **Fenêtre 8 ou 12 sem avec seulement 4 semaines en DB** : `buildSignalsFromDB` pad `history` avec des zéros jusqu'à 12. `MiniSpark` affiche donc une ligne plate 0 puis un pic brutal à la dernière semaine ⇒ lecture visuelle faussée.
- **`delta_4w` avec < 8 semaines** : `prev4Sum = 0` → `delta = last4Sum = count` → toujours positif, chip "↑" injustifié.
- **Sources dans la DB = URLs** : `main.py:723` stocke `article["link"]`. `buildSignalsFromDB:558-562` tente de parser `"Anthropic — blog"` sur une URL → regex matche mais `who` = URL entière, `what` = "". Affichage dans `SignalDetail` : liste de URLs nues sans source propre.
- **`jarvis_take` vide** : `buildSignalsFromDB:585` laisse `""`. Dans `SignalDetail` et `SignalRow.sig-row-take` → chaîne vide visible. Dans la fake data, c'est rempli.
- **`alerts[]` toujours vide** : `buildSignalsFromDB:589` laisse `[]`. La section "Alertes récentes" de la watchlist affiche systématiquement "Pas d'alerte sur tes signaux cette semaine." en prod.
- **`related[]` vide le plus souvent** : le critère "2 sources strictement identiques entre 2 termes" matche rarement puisque chaque mention empile l'URL de l'article — deux termes co-détectés dans le même article partagent l'URL, mais il faut 2 articles communs pour créer un edge.
- **`signals-focus-name` avec un nom inexistant** : `find` retourne undefined, le useEffect sort silencieusement. Pas de toast / feedback.
- **Watchlist persistante mais sans ID check** : si un signal suivi disparaît côté DB (term supprimé, renommé), `watched.includes(id)` reste true mais aucun `watchedSignals` ne ressort — la watchlist affiche 0 items tout en ayant des IDs fantômes dans localStorage.
- **Export CSV sur 0 ligne** : bouton `disabled` (`!filtered.length`), no-op.
- **`window.SIGNALS_DATA` non monté au premier render** : le panel est Tier 2, donc App attend `panelStatus[signals] === "done"` avant de mount `PanelSignals` — pas de NPE à redouter.

## Limitations connues / TODO
- [x] ~~**`signals_summary` Claude ignoré par le front**~~ → **fixé (2026-04-24)** : `buildSignalsFromDB` lit désormais le latest `weekly_analysis.signals_summary` et l'expose sur `SIGNALS_DATA.signals_summary` + `signals_summary_week`. Le panel a un nouveau bloc `.sig-summary` entre hero et watchlist (markdown rendu via `marked.parse` + `DOMPurify`, collapsible persisté `localStorage.sig.summary-open`).
- [x] ~~**`jarvis_take` et `alerts[]` jamais remplis**~~ → **fixé (2026-04-24)** : migration `sql/011_signal_tracking_enrichment.sql` ajoute `jarvis_take text` + `alerts jsonb`. Nouvelle step 2b `weekly_analysis.py::enrich_top_signals()` — 1 appel Claude Haiku batch pour les top 15 signaux de la semaine → PATCH `jarvis_take` (10-18 mots) + append weekly alert dans `alerts` (dédoublonné par `week`). Front lit `latest.jarvis_take` et agrège `alerts` de toutes les semaines du terme dans `buildSignalsFromDB`.
- [x] ~~**Sources = URLs brutes**~~ → **fixé (2026-04-24)** : `main.py::extract_concepts` stocke maintenant `{url, title}` dicts. `track_signals` sérialise au format `"{domain} — {title[:100]}"` via `_source_entry_for_signal()`. `save_concepts_to_wiki` mappe vers URLs (rétrocompat `wiki_concepts.sources`). Front : nouveau regex `/^(.+?)\s+—\s+(.+)$/` parse strictement l'em-dash ; les rows antérieures (URLs) tombent en `who` sans erreur.
- [ ] **Historique tronqué à 4 semaines** : `signal_tracking` n'a que 4 semaines en DB (depuis 2026-03-30). Les vues 8 et 12 sem + `delta_4w` sont donc encore faiblement significatives ; padding zéros côté front crée l'illusion d'une ligne "nouvelle" sur tous les signaux. *Posture : attendre l'accumulation naturelle — pas de backfill forcé depuis `articles`.*
- [ ] **`delta_4w` biaisé avec < 8 semaines** : `prev4Sum` est 0 tant qu'on n'a pas 8 semaines d'historique, ce qui inflate la flèche montante de tout le monde. Se corrige avec l'accumulation (cf. point précédent).
- [ ] **Co-occurrences sur sources (URLs) → graphe quasi-vide** : le seuil "overlap ≥ 2 sources strictement identiques" matche rarement. La vue "graphe" est donc très dispersée tant que la normalisation des sources n'est pas retravaillée. *Posture : accepté comme limitation (note user 2026-04-24).*
- [ ] **Pas d'empty state "pipeline non exécuté"** : si `signal_tracking` est vide, la fake data de `data-signals.js` reste affichée silencieusement. Risque de confusion avec de la vraie data.
- [ ] **`CONCEPT_KEYWORDS` figé côté code** : ajouter un nouveau concept demande un deploy de `main.py`. Pas de table `tracked_terms` éditable depuis le cockpit.
- [ ] **Dégradation visuelle MiniSpark avec 0 dominant** : history `[0,0,0,0,0,0,0,0,0,0,0,N]` produit une ligne plate puis pic vertical au dernier point ⇒ peu lisible.
- [ ] **Focus cross-panel via `signals-focus-name` sans retour visuel en cas d'échec** : si le nom ne matche aucun signal, l'utilisateur arrive sur la page sans voir pourquoi son clic n'a rien ouvert.
- [ ] **Tweaks panel accessible uniquement en iframe** : impossible d'accéder aux paramètres densité/vue depuis l'UI normale (sauf via le view-switcher principal). La densité "dense" est donc une fonctionnalité cachée.
- [ ] **Catégorie via slug fuzzy** : `slug.startsWith(w.slug) || w.slug.startsWith(slug)` peut produire des faux positifs (ex. "agent" slug matche "agent-memory" concept). Catégorie possiblement erronée sur les termes composés.
- [ ] **`SIGNALS_DATA.maturity_positions` écrasé** à l'hydratation avec une valeur différente de la fake (`declining: 0.78` vs `0.92`, `plateau: 0.92` vs `0.80`). Cohérence à vérifier.

## Dernière MAJ
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — retrodoc initial basé sur HEAD `c456ac9`. Correctifs appliqués le même jour :
- migration `sql/011_signal_tracking_enrichment.sql` (jarvis_take + alerts)
- `main.py` enrichissement sources `{domain} — {title}`
- `weekly_analysis.py::enrich_top_signals()` (step 2b du pipeline hebdo)
- `buildSignalsFromDB` lit jarvis_take + alerts, parse nouveau format sources, surface signals_summary
- `panel-signals.jsx` bloc `.sig-summary` markdown collapsible entre hero et watchlist

