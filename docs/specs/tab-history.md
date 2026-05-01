# Historique

> Archive 60 jours : heatmap + sparkline du volume d'articles, timeline éditoriale par semaine avec drawer détaillé (macro + top + signaux + actions + note perso + brief_html complet), pin persistant, export CSV et navigation clavier.

## Scope
mixte

## Finalité fonctionnelle
Revivre n'importe quel jour des 60 derniers : volume d'articles, brief Gemini sauvegardé, signaux faibles de la semaine, actions consignées depuis la télémétrie, et une note perso libre persistée en base. Le panel reconstruit une "fiche journalière" à partir de 5 tables indépendantes (`articles`, `daily_briefs`, `usage_events`, `signal_tracking`, `history_notes`) — aucune pré-agrégation côté backend, tout est calculé au vol dans `transformHistory()` à chaque visite. Le pin (via icône "●" ou touche `p`) stocke les ISO en localStorage pour marquer les moments clés.

⚠️ L'onglet affiche 60 jours fixes alors que la DB n'a qu'une vingtaine de jours d'articles et de télémétrie. La majorité des jours affichés sont donc vides — voir Limitations.

## Parcours utilisateur
1. Clic sidebar "Historique" (groupe Système) — le panel charge en parallèle articles, briefs quotidiens, télémétrie et signaux de la fenêtre historique.
2. Lecture du hero : quatre KPIs (articles vus sur la fenêtre, requêtes Jarvis totales + streak, jour le plus chargé, actions consignées).
3. Lecture du top 5 sources de la fenêtre : barre horizontale par source avec nombre de passages en top.
4. Lecture de la sparkline du volume d'articles au-dessus de la heatmap semaine × jour (Lun→Dim) colorée par intensité (pic / normal / calme) avec dot pour les jours épinglés et marqueur "aujourd'hui". Clic sur une cellule pour ouvrir le drawer du jour correspondant.
5. Utilisation des filtres combinables : pills d'intensité (Tous / Pics / Normal / Calme), toggle "● Épinglés seulement", recherche plein-texte dans les briefs, bouton d'export CSV, compteur "N / M jours affichés".
6. Lecture de la timeline groupée par semaine : une section par semaine ISO avec chaque jour cliquable — date, tag macro, pin dot, titre + body du brief, cinq premiers signaux, stats à droite (articles / signaux / Jarvis / temps de lecture).
7. Clic sur un jour pour ouvrir le drawer latéral :
   - Header : eyebrow "il y a Nj", date longue, stats de la semaine, bouton pin + bouton fermer.
   - Section "Macro · synthèse du jour" avec extraits du brief.
   - Dépliable "Voir le brief complet" avec le contenu intégral sanitisé.
   - Section "Top N incontournables" avec trois premiers articles cliquables.
   - Dépliable "+ N autres articles ce jour-là" si plus de trois.
   - Section "Signaux ce jour-là" (cinq max, delta coloré).
   - Section "Actions prises ce jour" (articles consultés avec domaine, pipelines déclenchés, recherches).
   - Zone "Ma note perso" auto-sauvegardée en tapant.
   - Footer : boutons "Fermer" et "Imprimer / Exporter le brief →" qui ouvre une fenêtre print-friendly.
8. Navigation clavier : `j/k` ou `↑/↓` pour changer de jour sélectionné, `p` pour épingler, `Entrée` pour ouvrir, `Échap` pour fermer le drawer.

## Fonctionnalités
- **Hero 4 KPIs** : articles vus sur la fenêtre, requêtes Jarvis totales + streak en cours, jour le plus chargé, actions consignées.
- **Top 5 sources** : les cinq sources qui reviennent le plus souvent en Top du jour sur la fenêtre, affichées en barres horizontales.
- **Sparkline + heatmap** : mini-courbe du volume d'articles en haut, puis grille semaine × jour colorée par intensité (pic / normal / calme). Dot pour les jours épinglés, marqueur « aujourd'hui » et « actif ». Clic sur une cellule ouvre le drawer du jour.
- **Quatre filtres combinables** : intensité (Tous / Pics / Normal / Calme), toggle « ● Épinglés seulement », recherche plein-texte dans les briefs, et bouton d'export CSV. Compteur « N / M jours affichés ».
- **Timeline groupée par semaine** : une section par semaine ISO avec chaque jour cliquable — date, tag macro, pin dot, titre + body du brief, cinq premiers signaux, stats à droite (articles / signaux / Jarvis / temps de lecture estimé).
- **Drawer détaillé au clic** : panneau latéral avec date longue, récap macro du jour, brief complet dépliable, top 3 articles cliquables, extras dépliables si plus de trois, signaux de la semaine avec delta, actions prises consignées (articles consultés avec domaine, pipelines déclenchés, recherches), zone « Ma note perso » auto-sauvegardée, bouton « Imprimer / Exporter » qui ouvre une fenêtre print-friendly.
- **Épingler un jour** : bouton dans le drawer ou touche `p` — les jours épinglés apparaissent avec un dot et peuvent être filtrés en un clic. Persisté et téléchargé aussi dans l'export CSV.
- **Note perso par jour** : zone de texte libre auto-sauvegardée en local + en base, utile pour noter ce qui s'est passé ce jour-là sans impacter le corpus d'articles.
- **Navigation clavier** : `j/k` ou `↑/↓` pour changer de jour sélectionné, `Entrée` pour ouvrir, `p` pour épingler, `Échap` pour fermer le drawer.
- **Export CSV** : télécharge tous les jours filtrés (date, semaine, intensité, articles, signaux, Jarvis, épinglé, titre macro, top 3) avec encodage compatible Excel français.
- **Fenêtre dynamique** : la vue s'adapte à l'historique disponible (jusqu'à 60 jours max) pour éviter d'afficher des rangs vides quand le corpus est encore jeune.

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
2026-05-01 — sync spec ↔ code : note les guards défensifs sur `hist?.totals` + `t.peak_day?.short_label` + `t.total_articles ?? 0` ajoutés le 2026-04-30 (commit `69ea05b`, P33) pour neutraliser le crash quand l'agrégat `transformHistory()` retournait des champs manquants. Aucun changement fonctionnel observable — fix de robustesse uniquement.
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — retrodoc initial basé sur HEAD `c456ac9`. Correctifs appliqués le même jour :
- [sql/012_history_notes.sql](sql/012_history_notes.sql) — nouvelle table `history_notes` (iso PK, text, updated_at) avec RLS authenticated complète (select/insert/update/delete).
- `DELETE FROM daily_briefs WHERE date='1999-01-01'` — seed anomalie purgé (22 → 21 rows).
- [cockpit/lib/data-loader.js](cockpit/lib/data-loader.js) — `transformHistory()` fenêtre dynamique + actions enrichies objets `{label, url, event_type}` + `signals_rising_by_week` remplace le broadcast per-day + `readingTimeLabel()` calcule 18s/article + 8 event_types ajoutés au mapping.
- [cockpit/panel-history.jsx](cockpit/panel-history.jsx) — `HiDayNote` sync DB via `window.sb.query/postJSON/deleteRequest` + hydrate au mount + `pinsSet` useMemo remplace la mutation in-place + actions drawer cliquables + week-group affiche "N signaux ↑" + check `.is-incident` retiré + `csvStr()` sanitise `\r\n`.
- [cockpit/styles-history.css](cockpit/styles-history.css) — `.is-incident` retiré, `.hi-drawer-action-link/-url` ajoutés.
- [CLAUDE.md:218-236](CLAUDE.md:218) — table "Events instrumentés" complète (13 events au lieu de 5).

