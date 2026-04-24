# Historique

> Archive 60 jours : heatmap + sparkline du volume d'articles, timeline éditoriale par semaine avec drawer détaillé (macro + top + signaux + actions + note perso + brief_html complet), pin persistant, export CSV et navigation clavier.

## Scope
mixte

## Finalité fonctionnelle
Revivre n'importe quel jour des 60 derniers : volume d'articles, brief Gemini sauvegardé, signaux faibles de la semaine, actions consignées depuis la télémétrie, et une note perso libre persistée en localStorage. Le panel reconstruit une "fiche journalière" à partir de 4 tables indépendantes (`articles`, `daily_briefs`, `usage_events`, `signal_tracking`) — aucune pré-agrégation côté backend, tout est calculé au vol dans `transformHistory()` à chaque visite. Le pin (via icône "●" ou touche `p`) stocke les ISO en localStorage pour marquer les moments clés.

⚠️ L'onglet affiche 60 jours fixes alors que la DB n'a que ~20 jours d'articles et 13 jours d'usage_events au 2026-04-24. La majorité des jours affichés sont donc vides — voir Limitations.

## Parcours utilisateur
1. Clic sidebar "Historique" (group **Système**, icon `clock`) — [data-loader.js:1221](cockpit/lib/data-loader.js:1221) + mount [app.jsx:413](cockpit/app.jsx:413).
2. **Panel Tier 2** — loader Tier 2 générique pendant fetch 4 tables parallèles (`articles` 60j limit 2000, `daily_briefs` 60j limit 60, `usage_events` 60j limit 5000, `signal_tracking` 60j limit 500).
3. Hero : 4 KPIs (`Articles vus 60j`, `Requêtes Jarvis totales + streak en cours`, `Jour le plus chargé`, `Actions consignées`).
4. Top sources 60j : 5 top sources par nb de fois en `top[]` dans les jours, barre horizontale.
5. **Heatmap 60j** : `.hi-sparkline` SVG 720×60 au-dessus, puis grid semaine × jour (Lun-Dim, `(getDay()+6)%7`). Couleur par `intensity` (`pic / normal / calme`), dot épinglé, marqueur today/active. Cliquer une cellule ouvre le drawer.
6. Filtres : pills `Tous/Pics/Normal/Calme` + toggle `● Épinglés seulement` + input `Recherche dans les briefs…` + bouton `↓ CSV (N)` + counter `N/60 jours`.
7. **Timeline** groupée par semaine : `S17 · sam 19 → lun 14 · 87 articles`. Chaque jour est une row cliquable avec date (num + dow + AUJ tag), tag macro (section du top article), pin dot, titre + body du brief, 5 premiers signaux, stats à droite (articles / signaux / req Jarvis / reading time).
8. Clic row → **Drawer** fixed right :
   - Header : eyebrow "il y a Nj", date longue, `S17 · N articles · N signaux · N req Jarvis`, bouton pin + bouton fermer.
   - Section "Macro · synthèse du jour" : titre + body (extraits de `daily_briefs.brief_html`).
   - `<details>` "Voir le brief complet" → HTML sanitisé via DOMPurify.
   - Section "Top N incontournables" : 3 premiers articles cliquables (ouvrent dans nouvel onglet).
   - `<details>` "+ N autres articles ce jour-là" si plus de 3.
   - Section "Signaux ce jour-là" (5 max, avec delta coloré).
   - Section "Actions prises ce jour" (liste déduite de `usage_events`).
   - Textarea "Ma note perso" (auto-saved localStorage, debounce 400ms).
   - Footer : boutons "Fermer" + "Imprimer / Exporter le brief →" (ouvre une fenêtre print-friendly avec CSS inline).
9. **Navigation clavier** : `j/k` ou `↑/↓` pour déplacer la sélection, `p` pour toggle pin, `Escape` pour fermer le drawer. Ignoré dans input/textarea.

## Fonctionnalités
- **Reconstruction 60 jours** en 1 boucle : pour chaque jour offset 0..59 depuis today, groupement articles + brief + signaux (per-week broadcast) + actions (usage_events) + jarvis_calls.
- **Intensité dynamique** : calcule p25/p75 des counts > 0 sur les 60 jours, seuil `pic ≥ max(p75, 6)`, `calme ≤ max(p25, 1)`, sinon `normal`. Évite d'avoir "tout pic" ou "tout calme" même sur corpus pauvre.
- **Signals per-week broadcast** : `signal_tracking` est stocké par semaine, donc tous les jours d'une même semaine affichent les mêmes top 5 signaux (décision cohérente mais un peu trompeuse — voir TODO).
- **Actions déduites télémétrie** : mapping `link_clicked → "Article consulté"`, `pipeline_triggered → "Pipeline déclenché"`, `search_performed → "Recherche effectuée"`. `section_opened` et `error_shown` ignorés ("too noisy").
- **Jarvis calls counter** : `pipeline_triggered` avec `payload.pipeline === "jarvis"` uniquement.
- **Peak day** : premier jour parcouru qui maximise `count` (en cas d'égalité, le plus récent gagne car offset 0 traité en premier).
- **Streak** : jours consécutifs depuis today avec `count > 0`, casse au premier gap (après offset 0).
- **Pin system** : `localStorage.cockpit:history:pinned` (array d'ISO). API globale `window.cockpitHistoryPins.{read, toggle}`. Le pin mute `day.pinned` en place pour éviter un refetch — `setPinTick()` force re-render.
- **Note perso par jour** : `localStorage.cockpit:history:notes` (dict iso → text). Debounce 400ms, toast "Enregistré" temporaire. Jamais synchronisée en DB.
- **Recherche plein-texte** : sur `macro.title + macro.body + signals.map(name)` — bas niveau, insensible à la casse.
- **Export CSV** 12 colonnes (iso, long, week, intensity, articles, signals_rising, jarvis_calls, pinned, macro.title, top[0..2].title) avec BOM UTF-8 pour Excel FR.
- **Print-friendly brief** : ouvre une fenêtre HTML minimale avec CSS Georgia serif, cadre 720px, couleur brand `#8b4513`. Sanitisée via DOMPurify.

## Front — structure UI
Fichier : [cockpit/panel-history.jsx](cockpit/panel-history.jsx) — 596 lignes, monté à [app.jsx:413](cockpit/app.jsx:413). Data ref : [cockpit/data-history.js](cockpit/data-history.js) — 207 lignes, shape + fake totals, **écrasé** à la visite par `transformHistory()` qui régénère `days` + `totals`. Stylesheet : [cockpit/styles-history.css](cockpit/styles-history.css) — 901 lignes, préfixe `.hi-*`.

Structure DOM :
- `.hi-wrap`
  - `.hi-hero` — eyebrow + h1 + sub + `.hi-kpis` (4 cards)
  - `<HiTopSources>` — `.hi-topsources` top 5 sources 60j (bar chart)
  - `.hi-heatmap-section` — kicker + h2 + `<HiSparkline>` + `<HiHeatmap>` + `.hi-kbd-hint`
  - `.hi-filters` — 4 pills intensité + toggle pinned + search input + bouton CSV + count
  - `.hi-timeline` — `.hi-week-group × N` → `.hi-day[.is-weekend/.is-today/.is-active/.hi-day-calm]`
  - Drawer conditionnel : `.hi-drawer-backdrop + .hi-drawer[role="dialog"]`

## Front — fonctions JS
| Fonction / Composant | Rôle | Fichier/ligne |
|----------------------|------|---------------|
| `PanelHistory({ data, onNavigate, onLoadDay, historicalDay })` | Root, lit `window.HISTORY_DATA`, 5 states (intensity, pinnedOnly, query, selectedIso, pinTick) | [panel-history.jsx:355](cockpit/panel-history.jsx:355) |
| `HiSparkline({ days })` | SVG 720×60 courbe volume + ligne moyenne + dots "pic" | [panel-history.jsx:14](cockpit/panel-history.jsx:14) |
| `HiTopSources({ days })` | Count `top[].source` sur 60j, top 5 avec bar chart | [panel-history.jsx:42](cockpit/panel-history.jsx:42) |
| `HiHeatmap({ days, activeIso, todayIso, onPick })` | Grid semaine × jour (Lun-Dim), classes dynamiques, clic → setSelectedIso | [panel-history.jsx:111](cockpit/panel-history.jsx:111) |
| `HiDrawer({ day, onClose, onTogglePin, isPinned })` | Drawer complet avec macro, top, signaux, actions, note, brief_html, print | [panel-history.jsx:173](cockpit/panel-history.jsx:173) |
| `HiDayNote({ iso })` | Textarea note perso avec debounce 400ms | [panel-history.jsx:83](cockpit/panel-history.jsx:83) |
| `hiExportCsv(days)` | Blob CSV 12 cols + BOM UTF-8 | [panel-history.jsx:328](cockpit/panel-history.jsx:328) |
| `handleTogglePin(iso)` (inline) | Toggle via `cockpitHistoryPins.toggle`, mute `day.pinned` in place, track event | [panel-history.jsx:392](cockpit/panel-history.jsx:392) |
| `useHiEffect` keyboard nav | `j/k/Arrow/Esc/Enter/p` handler | [panel-history.jsx:363-390](cockpit/panel-history.jsx:363) |
| `filtered` (useHiMemo) | Filtre intensity + pinnedOnly + query sur `hist.days` | [panel-history.jsx:404-416](cockpit/panel-history.jsx:404) |
| `filteredByWeek` (useHiMemo) | Group par semaine + sort desc | [panel-history.jsx:419-423](cockpit/panel-history.jsx:419) |
| `readHistoryNotes()` | `localStorage.cockpit:history:notes` → dict iso→text | [panel-history.jsx:73-75](cockpit/panel-history.jsx:73) |
| `writeHistoryNote(iso, text)` | Upsert ou delete d'une note (trim, drop empty) | [panel-history.jsx:76-81](cockpit/panel-history.jsx:76) |
| `transformHistory(articles, briefs, extras)` | Reconstruction complète 60 jours + totals | [data-loader.js:3550-3710](cockpit/lib/data-loader.js:3550) |
| `classify(count)` (inline) | Intensité dynamique p25/p75 avec floor | [data-loader.js:3614-3619](cockpit/lib/data-loader.js:3614) |
| `readPinnedHistoryDays()` | `localStorage.cockpit:history:pinned` → Set<iso> | [data-loader.js:3714-3719](cockpit/lib/data-loader.js:3714) |
| `togglePinnedHistoryDay(iso)` | Toggle pin + persist, retourne nouveau state | [data-loader.js:3720-3724](cockpit/lib/data-loader.js:3720) |
| `window.cockpitHistoryPins` | API globale exposée `{ read, toggle }` | [data-loader.js:3727](cockpit/lib/data-loader.js:3727) |
| `loadPanel("history")` case | Fetch 4 tables parallèles + `transformHistory` + expose `_raw` | [data-loader.js:4576-4595](cockpit/lib/data-loader.js:4576) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie (2026-04-24) |
|-------|---------------|-------------------------|
| `articles` | `id, title, fetch_date, section, source, url, summary` | **660 rows**, fetch_date 2026-04-04 → 2026-04-24 (~20 jours) |
| `daily_briefs` | `date, brief_html, article_count` | **22 rows**, date 1999-01-01 (seed anomalie) → 2026-04-24 |
| `usage_events` | `event_type, payload, ts` | **893 rows**, 2026-04-11 → 2026-04-24 (~13 jours) |
| `signal_tracking` | `term, week_start, mention_count, trend, delta` | 89 rows, 2026-03-30 → 2026-04-20 |

Event types présents en DB (telemetry usage) :
```
section_opened    652  (ignoré par mapping actions)
error_shown       154  (ignoré)
pipeline_triggered 44  (mapped "Pipeline déclenché" + jarvis_calls si pipeline=jarvis)
link_clicked       20  (mapped "Article consulté")
profile_field_saved 7  (non mappé)
search_performed    7  (mapped "Recherche effectuée")
jobs_action         2  (non mappé)
profile_payload_copied 2 (non mappé)
idea_moved          2  (non mappé)
wiki_shared         1  (non mappé)
skill_radar_bumped  1  (non mappé)
challenge_completed 1  (non mappé)
```

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) — cron `0 6 * * 1-5` + ping sam 10h UTC — écrit dans `articles` (fetch + dedup par URL) et `daily_briefs` (brief Gemini du jour).
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) — cron dim 22h UTC — écrit dans `signal_tracking` indirectement via le main.py (c'est `main.py::track_signals` qui incrémente le compteur). Le weekly fournit `signals_summary` et enrichit `jarvis_take / alerts` via `enrich_top_signals()` (ajouté lors des correctifs signals).
- **Front telemetry** : chaque action UI émet un `usage_events` append-only via `window.track(event_type, payload)`. Documenté dans [CLAUDE.md:218-226](CLAUDE.md:218).
- **Jarvis (local)** : aucune interaction directe avec les 4 tables. Les requêtes Jarvis sont comptées via `pipeline_triggered` avec `payload.pipeline === "jarvis"` émis par [cockpit/panel-jarvis.jsx](cockpit/panel-jarvis.jsx).
- **Panel history** : **pas d'écriture vers Supabase**. Les pins et notes restent en `localStorage`. Seule trace serveur = `history_pin_toggled` tracked via `usage_events`.

## Appels externes
- **Supabase REST (lecture Tier 2)** : 4 queries parallèles (articles / daily_briefs / usage_events / signal_tracking).
- **localStorage** :
  - `cockpit:history:pinned` — Array<iso> des jours épinglés.
  - `cockpit:history:notes` — Record<iso, string> des notes perso.
- **`window.open()`** : articles (top 3 + extras, `_blank noopener`) + popup print-friendly du brief.
- **Telemetry** : `history_pin_toggled` (event_type non documenté dans CLAUDE.md — voir TODO).

## Dépendances
- **Onglets in** : sidebar group "Système" (icon `clock`).
- **Onglets out** : aucune navigation croisée. Les articles ouvrent en tab externe.
- **Pipelines requis** : `main.py` obligatoire (sans `articles` ni `daily_briefs`, panel affiche 60 jours vides). Les signaux et la télémétrie sont enrichissants mais pas bloquants.
- **Variables d'env / secrets** : rien côté panel (tout via Supabase auth JWT).
- **Globals lus** :
  - `window.HISTORY_DATA` (Tier 2, construit à la visite).
  - `window.HISTORY_DATA._raw.briefs` (lu par HiDrawer pour le brief_html complet).
  - `window.HISTORY_DATA._raw.arts60` (lu par HiDrawer pour les "extras articles").
  - `window.DOMPurify` (pour sanitize).
  - `window.cockpitHistoryPins` (API pin exposée par le loader).
  - `window.track` (telemetry).

## États & edge cases
- **Loading** : `PanelLoader` Tier 2 générique.
- **Erreur réseau Tier 2** : `PanelError` avec bouton Réessayer.
- **`arts60 = []`** : `if (window.HISTORY_DATA && arts60.length)` gate la reconstruction. Si vide, la fake data baked dans `data-history.js` reste — **le panel affiche des données fictives pour les jours sans articles**. Risque de confusion.
- **Filtre sans résultat** : `.hi-empty` "Aucun jour ne correspond aux filtres en cours."
- **Brief HTML absent** pour un jour : macro title = `"Pas de brief pour ce jour"`, body = `"N articles ce jour-là."` OU `"Pas d'activité consignée."` si 0 article. Bouton "Imprimer" affiche `alert("Pas de brief Gemini pour ce jour-là.")`.
- **`daily_briefs.date = '1999-01-01'`** : une entrée seed en DB, hors fenêtre 60j donc ignorée par le filter `date=gte.{fromDate}` — le panel ne la verra jamais.
- **Jour avec `count = 0`** : intensity = `calme` par défaut. Si 0 articles et 0 usage_events et 0 jarvis, la ligne affiche "Pas d'activité consignée." mais reste dans la timeline (sauf filtre `pic`/`normal`).
- **`signals_rising`** : basé sur `signal_tracking` par semaine → tous les jours de S17 affichent le même count. Intuitivement trompeur (un lundi ne devrait pas "hériter" du count du vendredi) — décision volontaire.
- **Signaux manquants pour une semaine** : `daySignals = []`, la section drawer et les chips du day-row disparaissent silencieusement.
- **Actions pour un jour sans usage_events** : liste vide → section drawer cachée via `day.actions.length > 0`.
- **Note perso pré-existante** : lue via `readHistoryNotes()[iso]` au mount du HiDayNote, pas de re-sync si changée ailleurs.
- **Pin toggle pendant que drawer ouvert** : `setPinTick` force re-render, le bouton drawer passe de `○ épingler` à `● épinglé` sans fermer.
- **Pin sur jour hors `hist.days`** : `cockpitHistoryPins.toggle` accepte n'importe quel ISO, mais le find retourne undefined → `if (day)` empêche la mutation. Silencieux.
- **Navigation clavier dans drawer** : le handler skip les touches dans `INPUT/TEXTAREA` mais pas dans `textarea.hi-daynote` du drawer ouvert — ⚠️ ambigu : tester si taper `j` dans la note perso navigue la sélection. Probablement OK car le textarea a tag "TEXTAREA".
- **`query` inclut HTML stripped** : `macro.body` a été `stripHtml()` dans `transformHistory`, mais les noms de signaux peuvent contenir caractères spéciaux.
- **Export CSV avec title contenant HTML** : double-quotes échappés (`""`) mais pas les `&lt;` etc. Titres ne contiennent pas d'HTML (déjà cleaned en amont), donc OK en pratique.
- **Fenêtre 60j avec seulement 20 jours d'articles en DB** : 40 jours affichent "Pas de brief" + "Pas d'activité consignée" avec intensité `calme`. Heatmap majoritairement vide.
- **`history_pin_toggled` event absent de CLAUDE.md** : le tableau "Events instrumentés" de CLAUDE.md liste 5 events (section_opened / search_performed / link_clicked / pipeline_triggered / error_shown). Il manque `history_pin_toggled` + 7 autres présents en DB.

## Limitations connues / TODO
- [x] ~~**Fenêtre 60j fixe**~~ → **fixé (2026-04-24)** : fenêtre dynamique dans `transformHistory` — `windowDays = min(60, diffDays(today, oldest article/brief))`. Exposée dans `totals.window_days`. Plus de rangs vides artificiels quand le corpus est jeune.
- [x] ~~**`history_pin_toggled` + 7 autres events non documentés**~~ → **fixé (2026-04-24)** : [CLAUDE.md:218-236](CLAUDE.md:218) a maintenant 13 events (ajout : profile_field_saved, profile_payload_copied, skill_radar_bumped, challenge_completed, idea_moved, wiki_shared, jobs_action, history_pin_toggled).
- [x] ~~**`signals_rising` broadcasté sur tous les jours**~~ → **fixé (2026-04-24)** : retiré de `day.signals_rising`, exposé uniquement au niveau semaine dans `totals.signals_rising_by_week` et affiché dans `.hi-week-label` ("… · 3 signaux ↑").
- [x] ~~**`macro.tag === "incident"` dead CSS path**~~ → **fixé (2026-04-24)** : check retiré du panel, style `.hi-day-macro-tag.is-incident` retiré du CSS.
- [x] ~~**`reading_time` hardcodé**~~ → **fixé (2026-04-24)** : calculé réellement depuis `count × 18s` avec floor 1 min. `"—"` pour les jours vides. Fonction `readingTimeLabel()` partagée dans `transformHistory`.
- [x] ~~**`daily_briefs.date = '1999-01-01'`**~~ → **fixé (2026-04-24)** : seed supprimé (`DELETE FROM daily_briefs WHERE date='1999-01-01'`), 1 ligne purgée.
- [x] ~~**Note perso jamais synchronisée**~~ → **fixé (2026-04-24)** : nouvelle table `history_notes (iso PK, text, updated_at)` avec RLS authenticated. `HiDayNote` écrit simultanément localStorage (cache) + Supabase (source de vérité), hydrate depuis DB au mount (override cache si divergence). Migration : `sql/012_history_notes.sql`.
- [x] ~~**Pas de lien direct "Article consulté" → article**~~ → **fixé (2026-04-24)** : les actions stockent maintenant `{label, url, event_type}` (dédup par label+url). Le drawer rend `<a target="_blank">` avec domaine à droite quand l'URL est présente.
- [x] ~~**Titre CSV non sanitisé (`\r\n`)**~~ → **fixé (2026-04-24)** : helper `csvStr()` strip `[\r\n]+ → " "` et escape les doubles-quotes.
- [x] ~~**`handleTogglePin` mute `day.pinned` in place**~~ → **fixé (2026-04-24)** : nouveau `pinsSet = useHiMemo(() => cockpitHistoryPins.read(), [pinTick])` + `filtered.map(d => ({ ...d, pinned: pinsSet.has(d.iso) }))` — zéro mutation, tout passe par React state.
- [ ] **`section_opened` et `error_shown` ignorés du mapping actions** : bien pour le bruit, mais perte d'info "15 erreurs ce jour-là = signal incident". À réfléchir comme bucket séparé plus tard.
- [ ] **Pas de recherche par date** : l'input plein-texte ne matche pas une date saisie à la main.
- [ ] **Heatmap orientation** : weeks récents à gauche (inversé vs convention GitHub). Apprentissage cognitif supplémentaire.
- [ ] **Pas de métrique "fidélité à l'app"** : le streak est calculé mais pas mis en valeur dans le hero.
- [ ] **Pas de partage** : bouton "Partager ce jour" non implémenté.
- [ ] **Drawer fixed-right** pas responsive sur mobile.

## Dernière MAJ
2026-04-24 — retrodoc initial basé sur HEAD `c456ac9`. Correctifs appliqués le même jour :
- [sql/012_history_notes.sql](sql/012_history_notes.sql) — nouvelle table `history_notes` (iso PK, text, updated_at) avec RLS authenticated complète (select/insert/update/delete).
- `DELETE FROM daily_briefs WHERE date='1999-01-01'` — seed anomalie purgé (22 → 21 rows).
- [cockpit/lib/data-loader.js](cockpit/lib/data-loader.js) — `transformHistory()` fenêtre dynamique + actions enrichies objets `{label, url, event_type}` + `signals_rising_by_week` remplace le broadcast per-day + `readingTimeLabel()` calcule 18s/article + 8 event_types ajoutés au mapping.
- [cockpit/panel-history.jsx](cockpit/panel-history.jsx) — `HiDayNote` sync DB via `window.sb.query/postJSON/deleteRequest` + hydrate au mount + `pinsSet` useMemo remplace la mutation in-place + actions drawer cliquables + week-group affiche "N signaux ↑" + check `.is-incident` retiré + `csvStr()` sanitise `\r\n`.
- [cockpit/styles-history.css](cockpit/styles-history.css) — `.is-incident` retiré, `.hi-drawer-action-link/-url` ajoutés.
- [CLAUDE.md:218-236](CLAUDE.md:218) — table "Events instrumentés" complète (13 events au lieu de 5).

