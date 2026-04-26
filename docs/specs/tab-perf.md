# Forme

> Tableau de bord sport + composition corporelle. Hero global avec snapshot Withings (poids/MG/muscle) et bandeau 7 jours multi-discipline, deux sous-onglets dédiés (Course / Workout) chacun avec ses KPIs et son journal, et des courbes composition long range persistantes en bas.

## Scope
perso

## Finalité fonctionnelle
Regrouper en un seul onglet l'état physique mesurable, séparé proprement par discipline : course à pied (sorties Strava) et workout (musculation, cross-training, yoga — tout ce que Strava enregistre comme `WeightTraining`, `Workout`, `Crossfit`…). La composition corporelle (Withings) est traitée comme un état global et reste affichée en haut quel que soit le sous-onglet actif, parce qu'elle ne dépend pas d'une discipline. La fatigue, la progression, les records et la régularité sont *dérivés côté front* dans `transformForme()` à chaque visite du panel — aucune pré-agrégation en DB. Si Withings n'est pas branché, le bloc composition devient une carte d'onboarding pointant sur la procédure de setup.

## Parcours utilisateur
1. Clic sidebar "Forme" (groupe Personnel) — le panel charge en parallèle les activités Strava et les pesées Withings.
2. Lecture du hero global :
   - À gauche : titre cross-discipline (poids du jour si Withings branché + nombre de séances de la semaine, toutes disciplines confondues) avec sous-titre récap (km cumulés de l'année, dernière activité, streak).
   - À droite : snapshot composition Withings — trois cellules Poids / Masse grasse / Muscle avec mini-sparkline 30j et delta 30j coloré. Fallback onboarding si Withings non connecté.
3. Lecture du bandeau 7 derniers jours : barres empilées par jour, colorées par discipline (course / workout / autre), permettant de voir d'un coup d'œil le mix d'entraînement de la semaine.
4. Choix du sous-onglet (persisté entre visites) :
   - **Course** : KPIs course (Distance 30j, Allure moyenne, Dénivelé, Volume semaine), histogramme charge hebdo en kilomètres sur 12 semaines, records auto-calculés (5k, 10k, semi, marathon, plus longue, volume max), puis journal des 20 dernières sorties course.
   - **Workout** : KPIs workout (Séances 30j, Volume horaire, Discipline n°1, Régularité 7j), histogramme charge hebdo en minutes sur 12 semaines, message explicite "Records à venir" pour le tonnage/1RM (Strava ne l'expose pas), puis journal des 20 dernières séances workout.
5. Lecture des courbes composition tendance longue (persistantes sous les onglets si Withings est branché) : deux toggles (Vue Poids / Composition / Muscle et Range 30j / 90j / 180j) pour explorer l'évolution sur la durée.
6. Si aucune activité Strava n'est synchronisée, ou si l'onglet Workout est ouvert sans aucune séance workout : message explicite pointant la prochaine action à faire (vérifier le workflow ou enregistrer une première séance).

## Fonctionnalités
- **Hero global cross-discipline** : titre dynamique (poids du jour si Withings branché + nombre de séances de la semaine toutes disciplines confondues) et sous-titre récap (kilomètres cumulés de l'année, dernière activité avec sa discipline, streak active).
- **Snapshot composition dans le hero** : trois cellules Poids / Masse grasse / Muscle avec mini-sparkline 30 jours et delta 30j coloré, intégrées au hero parce que la composition corporelle est un état global qui ne dépend pas de la discipline. Fallback en onboarding pointant vers la procédure de setup quand Withings n'est pas connecté.
- **Bandeau 7 derniers jours multi-discipline** : barres empilées par jour colorées par discipline (course / workout / autre), avec totalisateur (séances + km + heures actives) et légende, pour voir d'un coup d'œil le mix d'entraînement de la semaine.
- **Sous-onglet Course** : quatre KPIs course (Distance 30j vs 30j précédents, Allure moyenne, Dénivelé + calories, Volume semaine vs objectif), histogramme charge hebdo en kilomètres sur 12 semaines, six records auto-calculés (5k, 10k, semi-marathon, marathon, plus longue sortie, volume hebdo max), puis journal dense des 20 dernières sorties (date / type / nom + effort easy/tempo/long / distance + allure / FC + D+ / durée).
- **Sous-onglet Workout** : quatre KPIs workout (Séances 30j, Volume horaire 30j vs 30j précédents, Discipline n°1 + calories, Régularité 7j), histogramme charge hebdo en minutes sur 12 semaines, message explicite "Records à venir" car Strava n'expose pas la structure d'une séance de force, puis journal des 20 dernières séances workout (date / type / nom + effort court/moyen/long / FC / kcal / durée).
- **Courbes composition tendance longue** : grand graphique multi-séries persistant sous les onglets (si Withings branché), avec deux toggles — vue (Poids / Composition / Muscle) et range (30j / 90j / 180j), avec message explicite quand pas assez de mesures sur la période.
- **Empty states honnêtes** : quand aucune activité n'est synchronisée, message pointant vers le workflow Strava. Quand l'onglet Workout est ouvert sans séance workout, message expliquant comment Strava classera la prochaine séance.

## Front — structure UI
Fichier : [cockpit/panel-forme.jsx](cockpit/panel-forme.jsx) — monté à [app.jsx:409](cockpit/app.jsx:409). Data ref (fake) : [cockpit/data-forme.js](cockpit/data-forme.js) — shape canonique, **entièrement écrasé** à la visite par `replaceShape(FORME_DATA, shape)`. Stylesheet : [cockpit/styles-forme.css](cockpit/styles-forme.css) — préfixe `.fm-*`.

Structure DOM :
- `<div class="fm-wrap" data-screen-label="Forme">`
  - `.fm-hero` — 2 cols (`.fm-hero-head` titre+lede | `.fm-hero-comp` snapshot Withings 3 cellules avec sparkline + delta 30j)
  - `.fm-week-strip` — bandeau 7 jours multi-discipline (segments empilés colorés par catégorie via `--brand` et `#5b8def`)
  - `.fm-tabs` — bascule Course / Workout (`localStorage forme.tab`)
  - **Tab Course** : `<CourseTab>` rend 4 sections — `.fm-train-grid` (4 cards run) → `.fm-chart-wrap` (charge hebdo km) → `.fm-records` (6 max) → `.fm-sessions` (journal runs 20)
  - **Tab Workout** : `<WorkoutTab>` rend 4 sections — `.fm-train-grid` (4 cards workout) → `.fm-chart-wrap` (charge hebdo min) → `.fm-empty-card` (records "à venir") → `.fm-sessions.fm-sessions--workout` (journal workouts 20, sans colonnes distance/allure)
  - `.fm-section` final (si `_has_weight`) : `.fm-chart-wrap > .fm-chart-head` (2 `.fm-range-toggle`) + `<LineChart>` courbes composition long range, persistant sous les deux onglets

## Front — fonctions JS
| Fonction / Composant | Rôle | Fichier |
|----------------------|------|---------|
| `PanelForme({ data, onNavigate })` | Root — lit `window.FORME_DATA`, branches `_has_weight` / `_has_workouts`, gère l'état `tab` persisté | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `CourseTab({ FD, weekLoadKm })` | Rendu sous-onglet Course (KPIs run + charge km + records + journal runs) | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `WorkoutTab({ FD, weekLoadMin })` | Rendu sous-onglet Workout (KPIs workout + charge min + placeholder records + journal workouts) | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `Sparkline({ data, w, h, color, range })` | SVG mini-courbe avec aire + ligne, range optionnel | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `WeekLoadChart({ weeks, valueKey, unit, colorVar })` | SVG 1000×220 — bar chart générique, paramétré sur la clé valeur (km ou min) et la couleur | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `LineChart({ series, ySeries, range, height })` | SVG chart multi-séries avec padding 10% + empty state | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `weekStrip` (useMemo) | 7 jours glissants depuis `today.date` avec `maxMin` (segments multi-discipline) | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `weekLoad` (useMemo) | 12 semaines glissantes sur `FD._raw` (vraies activités) ou fallback `sessions` (fixture), produit `{week_start, km, min}` | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| State `tab` / `setTab` | "course" \| "workout", persisté dans `localStorage.forme.tab` | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| State `chartView` / `range` | Toggles courbes composition (non persistés) | [panel-forme.jsx](cockpit/panel-forme.jsx) |
| `categorizeSport(sport_type)` | Classifie un `sport_type` Strava en `"run" \| "workout" \| "other"` (workout = WeightTraining, Workout, Crossfit, Yoga, Pilates, Strength, …) | [data-loader.js](cockpit/lib/data-loader.js) |
| `T2.strava()` | `GET strava_activities?order=start_date.desc&limit=300` | [data-loader.js](cockpit/lib/data-loader.js) |
| `T2.withings()` | `GET withings_measurements?order=measure_date.desc&limit=365`, `.catch(() => [])` | [data-loader.js](cockpit/lib/data-loader.js) |
| `transformForme(activities, withings)` | Build complet du shape panel : tag chaque activité avec `_cat`, calcule KPIs séparés runs/workouts, produit `run_sessions` + `workout_sessions` + `_has_runs` + `_has_workouts` | [data-loader.js](cockpit/lib/data-loader.js) |
| `mapSession(a)` (inline transform) | Mappe une activité en ligne de journal avec `type` (catégorie réelle), `effort` calculé selon le type (pace pour run, durée pour workout) | [data-loader.js](cockpit/lib/data-loader.js) |
| `loadPanel("perf")` case | Fetch parallèle Strava + Withings + `replaceShape` + expose `_raw` + `_withings` | [data-loader.js](cockpit/lib/data-loader.js) |

## Back — sources de données

| Table | Colonnes (types) | Volumétrie (2026-04-24) |
|-------|------------------|-------------------------|
| `strava_activities` | `id` bigint PK, `athlete_id` bigint, `name` text, `sport_type` text, `start_date` timestamptz, `distance_m` real, `moving_time_s` int, `elapsed_time_s` int, `total_elevation_gain` real, `average_speed` real, `max_speed` real, `average_heartrate` real, `max_heartrate` real, `average_watts` real, `kilojoules` real, `suffer_score` int, `calories` real, `map_summary_polyline` text, `gear_id` text, `synced_at` timestamptz | **57 rows** (2025-04-17 → 2026-04-12) — ~1 an d'historique |
| `strava_activities_raw` | `id` bigint PK, `athlete_id` bigint, `payload` jsonb, `fetched_at` timestamptz | 57 rows (archive complète payloads Strava) |
| `withings_measurements` | `measure_date` date PK, `weight_kg` real, `fat_pct` real, `fat_mass_kg` real, `muscle_mass_kg` real, `hydration_kg` real, `bone_mass_kg` real, `measured_at` timestamptz, `updated_at` timestamptz | **3 rows seulement** (2026-04-20 → 2026-04-23) — setup très récent, courbes 180j quasi-vides |
| `withings_measurements_raw` | `measure_group_id` PK, `user_id`, `measured_at`, `payload` jsonb | 3 rows |
| `user_profile` | `key='strava_refresh_token'` | Lu par le pipeline Strava à chaque run ; upsert post-refresh |

Pipeline Strava fait **2 requêtes par activité** : 1 list (30 par page) + 1 detail (fetch complet) avec `time.sleep(1.0)` entre chaque. 57 activités → 57+ appels. Rate limit Strava = 100 req/15min + 1000/jour.

## Back — pipelines qui alimentent
- **Strava sync** ([pipelines/strava_sync.py](pipelines/strava_sync.py)) — cron `30 4 * * *` (4h30 UTC quotidien) via [.github/workflows/strava-sync.yml](.github/workflows/strava-sync.yml).
  - Step 1 : lit `strava_refresh_token` depuis `user_profile` (Supabase) sinon fallback env `STRAVA_REFRESH_TOKEN`.
  - Step 2 : refresh access_token via OAuth, persiste le nouveau refresh_token dans `user_profile` si rotation.
  - Step 3 : `/athlete/activities?after={epoch-365j}` (lightweight list).
  - Step 4 : `/activities/{id}` pour chaque id (detail complet), `time.sleep(1.0)` entre.
  - Step 5 : upsert `strava_activities_raw` (payload jsonb) + `strava_activities` (mapped fields).
  - Idempotent (on_conflict=id).
- **Withings sync** ([pipelines/withings_sync.py](pipelines/withings_sync.py)) — cron `45 4 * * *` (4h45 UTC quotidien) via [.github/workflows/withings-sync.yml](.github/workflows/withings-sync.yml).
  - Step 1 : refresh token (NON persisté — TODO).
  - Step 2 : `getmeas?lastupdate={epoch-7j}` en mode incrémental, ou `startdate=0&enddate=now` si `--backfill`.
  - Step 3 : `group_to_daily_row()` extrait les 6 measure types (1/6/8/76/77/88), `merge_daily_rows()` collapse multiple mesures/jour en "latest-per-column wins".
  - Step 4 : upsert `withings_measurements_raw` (par `measure_group_id`) + `withings_measurements` (par `measure_date`).
  - Mode `--backfill` disponible via `workflow_dispatch` input.
- **Scripts OAuth init** : [scripts/strava_oauth_init.py](scripts/strava_oauth_init.py) et [scripts/withings_oauth_init.py](scripts/withings_oauth_init.py) — run locaux one-shot pour obtenir le premier refresh_token, à stocker dans GitHub Secrets.
- **Docs setup** : [docs/strava-setup.md](docs/strava-setup.md), [docs/withings-setup.md](docs/withings-setup.md).
- **Daily / Weekly pipelines IA** : aucune interaction avec `perf`.
- **Jarvis (local)** : aucune interaction.

## Appels externes
- **Supabase REST (lecture Tier 2)** : `T2.strava()` et `T2.withings()` en parallèle au clic sur l'onglet.
- **Pas d'écriture côté front** — le panel est 100% read-only.
- **Pas de télémétrie spécifique** au panel (hors event `section_opened` global).
- **API Strava** (backend uniquement) : OAuth2 token endpoint + `/athlete/activities` + `/activities/{id}`.
- **API Withings** (backend uniquement) : OAuth2 `requesttoken` + `/measure?action=getmeas`.

## Dépendances
- **Onglets in** : sidebar group "Personnel" (icon `activity`).
- **Onglets out** : aucune navigation croisée (panel autonome).
- **Pipelines requis** : `strava-sync.yml` obligatoire (sans lui, panel vide). `withings-sync.yml` optionnel (sans lui, panel cache §3 et §3b).
- **Variables d'env / secrets** :
  - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`
  - `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`, `WITHINGS_REFRESH_TOKEN`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (écriture pipelines)
- **Tables externes** : `user_profile` (pour persistance Strava token rotating).

## États & edge cases
- **Loading** : `PanelLoader` Tier 2 générique ([app.jsx:391](cockpit/app.jsx:391)).
- **Erreur réseau Tier 2** : `PanelError` avec bouton Réessayer.
- **`activities = []`** (pipeline jamais exécuté) : hero affiche "Aucune activité Strava synchronisée sur cette période.", bandeau 7j vide, tab Course "Aucune sortie course synchronisée. Vérifie le workflow strava-sync.yml.", tab Workout "Pas encore de workout dans Strava…".
- **`activities = [run, run, run]`** (uniquement de la course) : tab Course rempli normalement, tab Workout affiche l'empty state "Pas encore de workout".
- **`activities = [workout]`** (premier workout enregistré sans course) : tab Workout devient l'onglet par défaut affiché (utile mais pas garanti — le tab persisté gagne).
- **`withings = []`** : `_has_weight = false`. Bloc composition dans le hero devient une carte d'onboarding. Section courbes long range cachée entièrement.
- **Aucune pesée sur 180j mais quelques-unes sur 30j** : LineChart range=180j affiche l'empty state "Pas assez de mesures sur 180j pour tracer une courbe."
- **Activity avec `distance_m = 0`** sans `sport_type` workout : tombe dans `categorizeSport()` → "other". Apparaît dans le bandeau 7j (gris) mais pas dans les onglets Course / Workout.
- **`gap dans streak`** : si `today` vide + `yesterday` vide → streak = 0. Si `today` vide + `yesterday` OK → streak = 1+.
- **Withings token rotation non persisté** : la prochaine rotation force un échec silencieux (401 Unauthorized) jusqu'à re-init manuelle via `scripts/withings_oauth_init.py`.
- **Rate limit Strava atteint** : `fetch_activity_detail` throws, compteur `errors` incrémenté, le pipeline continue mais avec trous. Pas de retry.
- **Backfill Strava** non supporté nativement : `LOOKBACK_DAYS=365` hard-codé, mais override via `--days=N` en CLI (pas via workflow_dispatch input).
- **Activité supprimée côté Strava** : le pipeline ne la refetche plus, mais elle reste dans `strava_activities` indéfiniment (pas de `soft_delete` ni détection "disparue").
- **Réentrance** : si on visite `perf` 2× de suite, les 2 fetches sont mémoizés via `once()`. Navigation retour → `once()` retourne le cache. Le tab actif est restauré depuis `localStorage`.

## Limitations connues / TODO
- [x] ~~**`sessions[].type` forcé à "run"**~~ → **fixé (2026-04-26)** : `transformForme` utilise maintenant `categorizeSport(sport_type)` qui retourne `run / workout / other`. Le journal de chaque sous-onglet filtre sur la bonne catégorie. L'effort est calculé selon le type (pace pour run, durée pour workout).
- [x] ~~**Pas de section dédiée workout**~~ → **fixé (2026-04-26)** : ajout du sous-onglet Workout avec ses propres KPIs (séances, volume horaire, top discipline, régularité), sa charge hebdo en minutes, et son journal filtré.
- [x] ~~**Composition Withings noyée en §3**~~ → **fixé (2026-04-26)** : le snapshot composition (poids/MG/muscle + sparklines + delta 30j) est maintenant intégré au hero global, parce que la composition corporelle est un état global qui ne dépend pas de la discipline.
- [ ] **Records workout impossibles depuis Strava** : tonnage, sets, reps, 1RM ne sont pas exposés par l'API. Le tab Workout affiche un message "Records à venir" honnête. Pour suivre ces métriques, il faudra brancher Hevy / Strong / saisie manuelle.
- [ ] **Pas de heatmap annuelle** : décidé non-priorité.
- [ ] **Rate limit Strava silencieux** : si pipeline dépasse 100 req/15min, `fetch_activity_detail` throw puis `errors += 1` mais le pipeline continue. Pas de retry avec backoff.
- [ ] **Pas de gestion "activity deleted côté Strava"** : les ghost rows restent.
- [ ] **Records course limités à 4 distances** (5k/10k/semi/marathon) : pas de custom PB. Pas de "fastest km", "fastest 2k", etc.
- [ ] **`chartView` et `range` non persistés** (pas de localStorage). Reset au changement d'onglet. Le `tab` Course/Workout l'est, lui.
- [ ] **Pas de télémétrie** clic sur toggle tab / vue / range. Impossible de savoir quel onglet est le plus regardé.
- [ ] **Sparklines de composition** basées sur `.slice(-30)` brut : ignorent les jours sans mesure. Quand 3 pesées sur 30 jours, la sparkline affiche 3 points collés à droite.
- [ ] **`_withings` et `_raw` exposés sur FORME_DATA** : pratique pour debug console mais non-documenté.
- [ ] **Pas de lien "Ouvrir dans Strava"** sur les lignes journal : utile pour voir la carte / split détaillé.
- [ ] **Pas de graphe de FC** : `average_heartrate` stocké mais affiché seulement en colonne journal.

## Dernière MAJ
2026-04-26 — refonte panel Forme en hero global + sous-onglets :
- Hero intègre le snapshot Withings (composition cross-discipline) + bandeau 7 jours multi-couleur.
- Sous-onglets Course / Workout persistés dans `localStorage.forme.tab`, chacun avec KPIs / charge hebdo / journal dédiés.
- `categorizeSport(sport_type)` dans `data-loader.js` classifie les activités Strava (run / workout / other), shape étendu avec `run_sessions`, `workout_sessions`, `_has_workouts` et KPIs workout (`week.workouts`, `month.workout_minutes`, `month.workout_top_type`, …).
- Empty state honnête sur le tab Workout quand aucune séance n'est encore enregistrée (cas du premier workout en cours).
- Records workout marqués "à venir" parce que Strava n'expose pas tonnage / sets / 1RM.

2026-04-24 — réécriture Parcours utilisateur + Fonctionnalités en vocabulaire produit.
2026-04-24 — retrodoc initial basé sur HEAD `c456ac9`. Correctifs appliqués le même jour : CLAUDE.md "Forme" actualisé, classifySport + goal_km lu depuis user_profile, persistance refresh_token Withings, input `days` pour backfill Strava manuel.

