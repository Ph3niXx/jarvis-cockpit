# Forme

> Tableau de bord sport (Strava running) + composition corporelle (Withings), 5 sections scrollables : KPIs 30j, charge hebdo 12 semaines, composition avec sparklines + courbes long range, records auto-calculés et journal des 20 dernières séances.

## Scope
perso

## Finalité fonctionnelle
Regrouper en un seul onglet l'état physique mesurable : activité sportive (Strava, 57 activités en DB sur 1 an glissant) + composition corporelle (Withings, 3 jours de pesées seulement au 2026-04-24 car sync très récent). La fatigue, la progression, les records et la régularité sont *dérivés côté front* dans `transformForme()` à chaque visite du panel — aucune pré-agrégation en DB. L'onglet branche sa section "Composition" sur `_has_weight` : si Withings n'a jamais été sync ou si toutes les pesées ont disparu, le bloc devient une carte d'onboarding pointant sur `docs/withings-setup.md`.

⚠️ **CLAUDE.md prétend 2 onglets séparés ("Performance Vue d'ensemble" + "Performance Historique") — c'est obsolète.** Le panel actuel est un seul scroll de 5 sections, nommé "Forme" dans la sidebar. Voir Limitations pour la liste des écarts doc/code.

## Parcours utilisateur
1. Clic sidebar "Forme" (group **Personnel**, icon `activity`) — [data-loader.js:1215](cockpit/lib/data-loader.js:1215) + mount [app.jsx:409](cockpit/app.jsx:409).
2. **Panel Tier 2** ([data-loader.js:4547](cockpit/lib/data-loader.js:4547)) — loader générique pendant fetch parallèle `T2.strava()` + `T2.withings()`, puis `transformForme()` construit le shape.
3. **Hero** : 2 branches selon `_has_weight` :
   - Avec Withings : `{today.weight} kg · {week.km} km cette semaine`
   - Sans : `{week.km} km · {week.runs} sorties cette semaine`
   - Sous-titre dynamique : `{year.km} km parcourus en {année} · {year.runs} sorties. Dernière sortie : {name} ({distance} km). Streak actuel : {streak}j.`
   - Card KPI à droite : volume semaine + % objectif (40 km hard-coded).
4. **§1 Entraînement · 30 derniers jours** : 4 cards (Distance vs 30j précédents, Allure moyenne, Dénivelé + kcal, Régularité = streak + jours actifs cette semaine) + **weekbars 7j** avec barres verticales rouges (course) ou `.fm-weekbar-rest` (jour off).
5. **§2 Charge hebdo · 12 semaines** : `<WeekLoadChart>` SVG 1000×220 — bar chart km/semaine avec axe Y 3 ticks (0 / maxKm/2 / maxKm), label x en `{jour} {mois}`. Calcul on-the-fly à partir de `FD._raw` (les 300 rows `strava_activities` stockées dans le global).
6. **§3 Composition (Withings)** — affiché seulement si `_has_weight` :
   - 3 cards conditionnelles (Poids / Masse grasse / Masse musculaire) avec sparkline 30j + deltas 7j/30j/90j (couleur up/down/flat).
   - Eyebrow "dernière pesée · {date}" depuis `today.weighed_at`.
7. **§3b Courbes · tendance longue** : `<LineChart>` 1000×280 avec 2 toggles :
   - Vue : Poids / Composition (masse grasse + eau %) / Muscle
   - Range : 30j / 90j / 180j
   - Auto-padding 10% + empty state "Pas assez de mesures sur {range} pour tracer une courbe." si < 2 points.
8. **§3 fallback (no Withings)** : section simple pointant sur `docs/withings-setup.md` + workflow `withings-sync.yml` à lancer manuellement en backfill.
9. **§4 Records · auto-calculés** : affiché seulement si `records.length > 0`. 6 items possibles (5k, 10k, semi, marathon, plus longue, volume hebdo max). Temps = distance × pace, format `{m}'{ss}"`, allure `{m}:{ss}/km`, "il y a {ago}".
10. **§5 Séances · journal** : 20 dernières avec date / type / nom + effort (`easy`/`tempo`/`long` déduit par seuils) / distance + pace / FC moyenne + D+ / durée. Empty state si `sessions = []`.

## Fonctionnalités
- **Hero dynamique** : en tête de page, soit poids du jour + km de la semaine (quand Withings est branché), soit km + sorties seulement. Sous-titre avec km cumulés de l'année, dernière sortie et streak active courante. Carte volume semaine avec pourcentage de l'objectif hebdomadaire configurable.
- **§1 Entraînement 30 derniers jours** : quatre cartes — distance vs 30 jours précédents, allure moyenne, dénivelé + calories, régularité (streak + jours actifs cette semaine) — et un ruban 7 jours avec des barres par jour (sport actif vs jour off), coloré par famille de sport (course / vélo / natation / marche / muscu / autre).
- **§2 Charge hebdo 12 semaines** : histogramme barres des kilomètres par semaine sur trois mois, avec graduations, pour repérer les pics et les creux de charge.
- **§3 Composition corporelle** : trois cartes Poids / Masse grasse / Masse musculaire (quand Withings est disponible) avec mini-courbe 30 jours et deltas sur 7j / 30j / 90j colorés selon la direction. Fallback en onboarding pointant vers la procédure de setup quand Withings n'est pas branché.
- **§3b Courbes tendance longue** : grand graphique multi-séries avec deux toggles — vue (Poids / Composition / Muscle) et range (30j / 90j / 180j), avec message explicite quand pas assez de mesures sur la période.
- **§4 Records auto-calculés** : six records max (5k, 10k, semi-marathon, marathon, plus longue sortie, volume hebdo max) détectés automatiquement depuis les activités, avec temps formaté, allure et ancienneté.
- **§5 Journal des 20 dernières séances** : tableau dense (date / type / nom / effort déduit easy/tempo/long / distance + pace / FC + D+ / durée) pour parcourir l'historique récent.
- **Empty state pipeline** : quand aucune activité n'est synchronisée, messages explicites pointant vers le workflow Strava à vérifier ou relancer.

## Front — structure UI
Fichier : [cockpit/panel-forme.jsx](cockpit/panel-forme.jsx) — 596 lignes, monté à [app.jsx:409](cockpit/app.jsx:409). Data ref (fake) : [cockpit/data-forme.js](cockpit/data-forme.js) — 274 lignes, shape canonique, **entièrement écrasé** à la visite par `replaceShape(FORME_DATA, shape)`. Stylesheet : [cockpit/styles-forme.css](cockpit/styles-forme.css) — 595 lignes, préfixe `.fm-*`.

Structure DOM :
- `<div class="fm-wrap" data-screen-label="Forme">`
  - `.fm-hero` — 2 cols (eyebrow + titre + lede | stat card droite)
  - `.fm-section` × 5 avec `.fm-section-head` uniforme (`.fm-section-num` 01-05 + `.fm-section-title` + `.fm-section-meta`)
    - §1 : `.fm-train-grid` (4 cards) + `.fm-weekbars` (grille 7 colonnes)
    - §2 : `.fm-chart-wrap > svg.fm-chart-svg`
    - §3 : `.fm-comp-grid` (cards conditionnelles)
    - §3b : `.fm-chart-wrap > .fm-chart-head` (2 `.fm-range-toggle`) + `<LineChart>`
    - §4 : `.fm-records` (6 max)
    - §5 : `.fm-sessions > .fm-sess-head + .fm-sess-row × 20`

## Front — fonctions JS
| Fonction / Composant | Rôle | Fichier/ligne |
|----------------------|------|---------------|
| `PanelForme({ data, onNavigate })` | Root — lit `window.FORME_DATA`, branches `_has_weight` | [panel-forme.jsx:151](cockpit/panel-forme.jsx:151) |
| `Sparkline({ data, w, h, color, range })` | SVG mini 64×24 avec aire + ligne, range optionnel | [panel-forme.jsx:15](cockpit/panel-forme.jsx:15) |
| `WeekLoadChart({ weeks })` | SVG 1000×220 — bar chart km/semaine | [panel-forme.jsx:37](cockpit/panel-forme.jsx:37) |
| `LineChart({ series, ySeries, range, height })` | SVG chart multi-séries avec padding 10% + empty state | [panel-forme.jsx:83](cockpit/panel-forme.jsx:83) |
| `spark` (useMemo) | Mappe `weight_series` 30j → 3 sparklines (weight/fat/muscle) | [panel-forme.jsx:158-166](cockpit/panel-forme.jsx:158) |
| `weekBars` (useMemo) | Construit 7 jours glissants depuis `today.date` avec `maxKm` | [panel-forme.jsx:178-197](cockpit/panel-forme.jsx:178) |
| `weekLoad` (useMemo) | 12 semaines glissantes sur `FD._raw` (activités brutes) | [panel-forme.jsx:200-219](cockpit/panel-forme.jsx:200) |
| State `chartView` / `setChartView` | Toggle Poids/Composition/Muscle (pas persisté) | [panel-forme.jsx:154](cockpit/panel-forme.jsx:154) |
| State `range` / `setRange` | Toggle 30j/90j/180j (pas persisté) | [panel-forme.jsx:155](cockpit/panel-forme.jsx:155) |
| `T2.strava()` | `GET strava_activities?order=start_date.desc&limit=300` | [data-loader.js:1291](cockpit/lib/data-loader.js:1291) |
| `T2.withings()` | `GET withings_measurements?order=measure_date.desc&limit=365`, `.catch(() => [])` | [data-loader.js:1292](cockpit/lib/data-loader.js:1292) |
| `transformForme(activities, withings)` | Build complet du shape panel (today, week, month, year, sessions, records, weight_series, deltas) | [data-loader.js:2085-2344](cockpit/lib/data-loader.js:2085) |
| `activeDates` streak compute | Set de `start_date.slice(0,10)` + boucle 365j | [data-loader.js:2126-2132](cockpit/lib/data-loader.js:2126) |
| `fastestIn(lo, hi)` (inline) | Pool runs entre `lo` et `hi` km, reduce par `paceOf` | [data-loader.js:2164-2168](cockpit/lib/data-loader.js:2164) |
| `pickOffsetAgo(days)` (inline Withings) | Cherche mesure ≤ target avec tolérance ±3j | [data-loader.js:2272-2291](cockpit/lib/data-loader.js:2272) |
| `loadPanel("perf")` case | Fetch parallèle + `replaceShape` + `_raw` + `_withings` | [data-loader.js:4427-4440](cockpit/lib/data-loader.js:4427) |

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
- **`activities = []`** (pipeline jamais exécuté) : hero affiche "Aucune activité Strava synchronisée sur cette période.", §1 KPIs à 0, §2 chart vide, §4 records absent, §5 "Aucune séance Strava synchronisée. Vérifie le workflow strava-sync.yml".
- **`withings = []`** : `_has_weight = false`. §3 devient `.fm-empty-section` avec onboarding. §3b caché entièrement.
- **Aucune pesée sur 180j mais quelques-unes sur 30j** : LineChart range=180j affiche l'empty state "Pas assez de mesures sur 180j pour tracer une courbe."
- **Activity avec `distance_m = 0`** (séance sans GPS, eg. gym) : `paceOf = 0`, exclue de `avgPace` et records allure. Le panel force `sport_type` → "run" dans les sessions ([data-loader.js:2145](cockpit/lib/data-loader.js:2145)) — ⚠️ force "run" même si c'est "Ride" ou autre.
- **`gap dans streak`** : si `today` vide + `yesterday` vide → streak = 0. Si `today` vide + `yesterday` OK → streak = 1+.
- **Withings token rotation non persisté** : la prochaine rotation force un échec silencieux (401 Unauthorized) jusqu'à re-init manuelle via `scripts/withings_oauth_init.py`.
- **Rate limit Strava atteint** : `fetch_activity_detail` throws, compteur `errors` incrémenté, le pipeline continue mais avec trous. Pas de retry.
- **Backfill Strava** non supporté nativement : `LOOKBACK_DAYS=365` hard-codé, mais override via `--days=N` en CLI (pas via workflow_dispatch input).
- **Activité supprimée côté Strava** : le pipeline ne la refetche plus, mais elle reste dans `strava_activities` indéfiniment (pas de `soft_delete` ni détection "disparue").
- **Réentrance** : si on visite `perf` 2× de suite, les 2 fetches sont mémoizés via `once()`. Navigation retour → `once()` retourne le cache.

## Limitations connues / TODO
- [x] ~~**CLAUDE.md obsolète sur cet onglet**~~ → **fixé (2026-04-24)** : les 2 lignes `Performance (Vue d'ensemble)` + `Performance (Historique)` fusionnées en une seule "Forme" décrivant la vraie architecture (1 panel scrollable, 5 sections, pas de heatmap).
- [x] ~~**Withings refresh_token non persisté après rotation**~~ → **fixé (2026-04-24)** : `pipelines/withings_sync.py::main()` lit maintenant `user_profile.withings_refresh_token` en priorité (fallback env), et `save_refresh_token_to_supabase()` persiste la rotation dès qu'elle arrive. Pattern miroir de Strava.
- [x] ~~**`_has_muscu` et section muscu = dead code**~~ → **fixé (2026-04-24)** : champs retirés du shape `transformForme` (`_has_muscu`, `lifts`, `tonnage`, `tonnage_prev`). La section muscu n'a jamais été rendue côté panel. Si la feature est reprise plus tard, ce sera avec un shape propre. *Contexte user : pas de données muscu saisies dans Strava à date.*
- [x] ~~**`sessions[].type` forcé à "run"**~~ → **fixé (2026-04-24)** : nouvelle fonction `classifySport(sport_type)` retourne `run / ride / swim / walk / lift / other`. Le panel passe `data-t={s.type || "other"}` et le CSS a des couleurs par famille (brand / vert / bleu / sable / gris).
- [x] ~~**Objectif `goal_km: 40` hard-codé**~~ → **fixé (2026-04-24)** : `transformForme` lit `user_profile.weekly_goal_km` (fallback 40). Édition via le panel Profil (user_profile est key/value). `Tier 2 case "perf"` passe `profileRows` depuis `__COCKPIT_RAW`.
- [x] ~~**Pas de backfill Strava via workflow_dispatch**~~ → **fixé (2026-04-24)** : `.github/workflows/strava-sync.yml` accepte un input `days` (défaut 365). Si != 365, passe `--days=$DAYS` au script. `timeout-minutes` bump 10 → 20 pour gérer les backfills longs.
- [ ] **Pas de heatmap annuelle** : décidé non-priorité.
- [ ] **Rate limit Strava silencieux** : si pipeline dépasse 100 req/15min, `fetch_activity_detail` throw puis `errors += 1` mais le pipeline continue. Pas de retry avec backoff.
- [ ] **Pas de gestion "activity deleted côté Strava"** : les ghost rows restent.
- [ ] **Records limités à 4 distances** (5k/10k/semi/marathon) : pas de custom PB. Pas de "fastest km", "fastest 2k", etc.
- [ ] **`chartView` et `range` non persistés** (pas de localStorage). Reset au changement d'onglet.
- [ ] **Pas de télémétrie** clic sur toggle vue/range. Impossible de savoir quelle vue est la plus regardée.
- [ ] **Sparklines de composition** basées sur `.slice(-30)` brut : ignorent les jours sans mesure. Quand 3 pesées sur 30 jours, la sparkline affiche 3 points collés à droite.
- [ ] **`_withings` et `_raw` exposés sur FORME_DATA** : pratique pour debug console mais non-documenté.
- [ ] **Pas de lien "Ouvrir dans Strava"** sur les lignes journal : utile pour voir la carte / split détaillé.
- [ ] **Pas de graphe de FC** : `average_heartrate` stocké mais affiché seulement en colonne journal.

## Dernière MAJ
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — retrodoc initial basé sur HEAD `c456ac9`. Correctifs appliqués le même jour :
- [CLAUDE.md](CLAUDE.md) — ligne "Forme" actualisée (1 panel scrollable au lieu de 2 vues fictives).
- [cockpit/lib/data-loader.js](cockpit/lib/data-loader.js) — `classifySport()` + `weeklyGoalKm` lu depuis user_profile + champs muscu retirés du shape.
- [cockpit/panel-forme.jsx](cockpit/panel-forme.jsx) — `data-t={s.type}` au lieu de `"run"` hardcodé.
- [cockpit/styles-forme.css](cockpit/styles-forme.css) — couleurs par famille sport (run/ride/swim/walk/lift/other).
- [pipelines/withings_sync.py](pipelines/withings_sync.py) — persistance du refresh_token rotating dans `user_profile.withings_refresh_token`.
- [.github/workflows/strava-sync.yml](.github/workflows/strava-sync.yml) — input `days` pour backfill manuel + timeout bumpé à 20 min.

