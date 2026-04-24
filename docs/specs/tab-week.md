# Ma semaine

> Vue récapitulative de la semaine en cours : dashboard factuel 6-KPIs + synthèse IA + heatmap 7 jours, ou version éditoriale racontée.

## Scope
mixte

## Finalité fonctionnelle
Donner un point hebdo unique qui croise **veille IA** (articles lus, streak, signaux) et **vie perso** (sport, musique, gaming, sommeil, notes). Deux modes d'affichage : "Factuel" (dashboard multi-blocs) et "Éditorial" (article en prose adaptatif selon le volume de lecture). Panel Tier 1 — aucun fetch propre, consomme `data.week` construit au boot.

## Parcours utilisateur
1. Clic sidebar "Ma semaine" (ou raccourci "Ouvrir ma semaine" depuis le Brief).
2. La vue apparaît immédiatement avec les données de la semaine en cours déjà chargées.
3. Lecture du titre daté en tête de page : "Ma semaine · semaine S… · Lundi → Dimanche en toutes lettres".
4. Clic en toolbar pour choisir entre le mode **Factuel** (dashboard multi-blocs, par défaut) ou **Éditorial** (article en prose).
5. En mode **Factuel**, l'utilisateur scrolle verticalement à travers : six indicateurs clés en tête (articles lus, temps de lecture, streak, signaux détectés, séances sport, notes), synthèse Jarvis en trois points, ruban 7 jours avec barres d'activité (veille / sport / musique / gaming), histogramme des lectures + nuage de thèmes, top quatre lectures + bloc challenges, puis quatre cartes perso (sport / musique / gaming / sommeil moyen).
6. En mode **Éditorial**, l'utilisateur lit un seul article au ton adaptatif (dense / régulier / léger / calme) selon le volume de veille, avec lede chiffré, pull-quote si la streak dépasse sept jours, liste des temps forts et grille de six chiffres en pied.
7. Clic sur "Voir tous" dans le bloc challenges pour basculer vers le panel dédié.

## Fonctionnalités
- **Toggle Factuel / Éditorial** : deux modes d'affichage sélectionnables en tête de page — dashboard multi-blocs ou article en prose racontée, selon l'humeur du matin.
- **Titre daté** : "Ma semaine · semaine S… · Lundi → Dimanche en toutes lettres" pour situer le récap.
- **Six indicateurs clés** : articles lus, temps de lecture, streak, signaux détectés, séances sport, notes, chacun avec sa variation vs la semaine précédente.
- **Ruban 7 jours** : une carte par jour Lundi→Dimanche avec quatre barres de progression (veille / sport / musique / gaming) normalisées sur la semaine.
- **Histogramme lectures** : un graphique barres 7 jours des articles lus, avec graduation pour repérer les pics et les creux.
- **Nuage de thèmes** : chips colorées des sujets dominants de la semaine, avec une jauge de poids relatif sur chaque.
- **Article éditorial adaptatif** : en mode Éditorial, le titre et le ton changent selon le volume de veille (semaine dense / rythme régulier / plus légère / calme), avec un pull-quote si la streak dépasse sept jours.
- **Raccourci Challenges** : un bouton "Voir tous" sur le bloc challenges qui bascule vers le panel dédié.
- **Bloc perso** : quatre cartes synthèse côté vie perso (sport / musique / gaming / sommeil moyen) pour un coup d'œil transverse.

## Front — structure UI
Fichier : [cockpit/panel-week.jsx](cockpit/panel-week.jsx) — 360 lignes, monté par [app.jsx:375](cockpit/app.jsx:375).

Structure DOM (mode factuel) :
- `.panel-page > .panel-hero` (eyebrow + h1 + sub)
- `.panel-toolbar` (label + pills mode)
- `.week-wrap`
  - `.week-stats-row` — 6 `.week-stat` (dont `.week-stat--accent` pour "Articles lus")
  - `.week-section` × N avec `.week-section-head` + contenu
  - `.week-split` × 2 — containers 2-col (Lectures+Thèmes, Top+Challenges)
  - `.week-perso-grid` — 4 `.week-perso-card`

Mode éditorial :
- `.week-wrap.week-wrap--edito > .week-edito` (article unique, longue typographie)

Pas d'id HTML stable. Route id = `"week"`, URL hash `#week`, panel Tier 1.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelWeek({ data, onNavigate })` | Composant racine — lit `data.week` et `data.challenges` | [panel-week.jsx:113](cockpit/panel-week.jsx:113) |
| `StatBig({ label, value, unit, delta, accent })` | Tuile KPI avec delta flèche | [panel-week.jsx:6](cockpit/panel-week.jsx:6) |
| `ReadingChart({ days })` | Barres 7 jours avec grille numérotée | [panel-week.jsx:23](cockpit/panel-week.jsx:23) |
| `DayStrip({ days })` | 7 day-cards avec 4 activités normalisées par max | [panel-week.jsx:48](cockpit/panel-week.jsx:48) |
| `ThemeCloud({ themes })` | Chips colorées avec barre de weight | [panel-week.jsx:99](cockpit/panel-week.jsx:99) |
| `isoWeekNum(d)` (inline) | Numéro de semaine ISO 8601 | [panel-week.jsx:120-125](cockpit/panel-week.jsx:120) |
| `buildWeek(recentArticles)` | Construit `data.week` au boot à partir des articles 30 jours | [data-loader.js:1028](cockpit/lib/data-loader.js:1028) |
| `loadRecentArticles(30)` | `GET articles?fetch_date=gte.<d-30>&order=fetch_date.desc&limit=400` | [data-loader.js:96](cockpit/lib/data-loader.js:96) |

Pas d'event listener global, que du React state local.

## Back — sources de données

| Table | Colonnes lues | Volumétrie |
|-------|--------------|------------|
| `articles` | `id, title, source, fetch_date` | 400 lignes / 30j max (limit Tier 1) |

**Tables NON lues malgré affichage** — c'est le cœur de la limitation du panel :
- `strava_activities` : panel affiche `personal.workouts.done/target` → toujours `0/3` car hardcodé dans `buildWeek`.
- `music_stats_daily` / `music_scrobbles` : panel affiche `personal.music.total_min`, `top_artist`, `sessions` → toujours `0` / `"—"` / `0`.
- `gaming_stats_daily` / `steam_games_snapshot` : `personal.gaming.total_min`, `top_game` → toujours `0` / `"—"`.
- `withings_measurements` (pour sommeil) : `personal.sleep_avg_h` → toujours `0`.
- `weekly_challenges` : panel lit `data.challenges` mais Tier 1 met `challenges: []` ([data-loader.js:1179](cockpit/lib/data-loader.js:1179)). Les challenges ne s'affichent QUE si l'utilisateur a visité le panel `challenges` avant (qui hydrate `window.CHALLENGES_DATA` + re-render).

## Back — pipelines qui alimentent
- **Daily pipeline** ([main.py](main.py)) — nourrit `articles` pour `total_read` / `top_read` / `days[].read`. Le seul signal réel sur ce panel.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) — aucune écriture vers une table consommée directement par Week.
- **Jarvis (local)** : aucune ; la carte "Synthèse auto · Jarvis · Ta semaine en 3 points" est alimentée par `w.ai_summary` = `[]` (vide). "mis à jour il y a 2h" est un texte hardcodé ([panel-week.jsx:172](cockpit/panel-week.jsx:172)).
- **Strava / Withings / Last.fm / Steam** : syncs daily (4h30 / 4h45 / 5h / 5h30 UTC) — ces tables existent mais **ne sont pas jointes** à `buildWeek`.

## Appels externes
- **Supabase REST** : partagé avec la Home via `loadRecentArticles(30)` — aucun appel dédié à Week.
- **localStorage** : `read-articles` lu par `buildWeek` pour calculer `total_read` et `top_read`.
- **Aucune API externe** côté front.

## Dépendances
- **Onglets** : consomme `data.week` (Tier 1) et `data.challenges` (vide sauf si le panel Challenges a été visité). Navigation out vers `challenges`.
- **Pipelines** : `daily_digest.yml` strictement obligatoire pour que la heatmap et les stats d'articles ne soient pas à zéro.
- **Variables d'env / secrets** : aucune côté front.

## États & edge cases
- **Loading** : pas de skeleton. Data injectée par Tier 1 avant le mount.
- **Empty (`articles 30j = []`)** : `days[*].read = 0`, `total_read = 0`, `top_read = []`. Mode éditorial bascule sur "Semaine calme — peu de veille" + lede "Pas encore de lecture enregistrée cette semaine."
- **Empty challenges (défaut)** : `data.challenges = []` → le bloc Challenges rend un conteneur vide, pas de message. C'est la situation par défaut.
- **`todayIdx` figé à Mardi** : `DayStrip` utilise `todayIdx = 1` hardcodé ([panel-week.jsx:56](cockpit/panel-week.jsx:56)). Classes `is-today` / `is-past` / `is-future` ne reflètent pas le jour réel.
- **Numéros de jour 14-20 hardcodés** : la day-card affiche `{14 + i}` ([panel-week.jsx:67](cockpit/panel-week.jsx:67)), toujours 14→20 peu importe la vraie date.
- **Perso "Au-dessus de l'objectif (2 min.)"** : texte figé dans la carte Sport ([panel-week.jsx:286](cockpit/panel-week.jsx:286)) peu importe `w.personal.workouts.done` vs `target`.
- **Perso "Stable vs semaine dernière"** : texte figé dans la carte Sommeil ([panel-week.jsx:304](cockpit/panel-week.jsx:304)).
- **Erreur réseau Tier 1** : `loadRecentArticles(30).catch(() => [])` → `buildWeek([])` → tout à zéro, layout OK.
- **Division par zéro** : `ReadingChart` fait `d.read / max` avec `max = Math.max(...days.map(d => d.read))`. Si toutes les valeurs sont 0, `max = 0`, division `0/0 = NaN` → barre invisible (mais pas de crash car React ignore les `height: NaN%`).

## Limitations connues / TODO
- [ ] **Personal block entièrement statique** : `buildWeek` remplit `personal` avec `{ workouts: {done:0,target:3}, music: {total_min:0, top_artist:"—", sessions:0}, gaming: {total_min:0, top_game:"—"}, sleep_avg_h: 0, notes_count: 0 }` ([data-loader.js:1067-1073](cockpit/lib/data-loader.js:1067)). **Aucune intégration** avec Strava/Withings/Last.fm/Steam alors que ces tables existent et sont peuplées quotidiennement.
- [ ] **`ai_summary` vide en permanence** : `buildWeek` met `ai_summary: []` ([data-loader.js:1059](cockpit/lib/data-loader.js:1059)), pas de génération. La carte "Synthèse auto · Jarvis" ne rend rien. Le "mis à jour il y a 2h" est un mensonge visuel.
- [ ] **`themes: []`** ([data-loader.js:1060](cockpit/lib/data-loader.js:1060)) → `ThemeCloud` rend vide.
- [ ] **`compare_last.*.last = 0`** ([data-loader.js:1074-1078](cockpit/lib/data-loader.js:1074)) pour `signals_spotted` / `workouts` / `notes` → deltas affichés toujours `+N vs 0`.
- [ ] **`todayIdx = 1` (Mardi) hardcodé** dans le DayStrip — lundi ou samedi affiche "Mardi = aujourd'hui".
- [ ] **Numéros de jour 14-20 hardcodés** ([panel-week.jsx:67](cockpit/panel-week.jsx:67)).
- [ ] **`data.challenges` non wiré en Tier 1** : le bloc Challenges est vide sauf si l'utilisateur a déjà visité le panel `challenges` (qui hydrate `window.CHALLENGES_DATA`). Incohérent avec le reste du panel qui est Tier 1.
- [ ] **`reading_time_min = total_read * 3`** ([data-loader.js:1058](cockpit/lib/data-loader.js:1058)) — heuristique 3 min/article, pas une vraie mesure.
- [ ] **`total_marked = total_read`** ([data-loader.js:1056](cockpit/lib/data-loader.js:1056)) — pas de distinction lu/bookmarké côté backend (cf. même TODO que Brief).
- [ ] **Pas de persistance du mode Factuel/Éditorial** : retour à "factuel" à chaque navigation.
- [ ] **Pas de détection "aujourd'hui"** : `fmtDay(monday)` → `fmtDay(sunday)` affiche la plage mais aucun marqueur visuel "tu es ici" sur `DayStrip`.

## Dernière MAJ
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-23 — d752b79
