# Musique

> Tableau de bord Last.fm (pipeline quotidien + enrich hebdo) avec hero now-playing live (polling 30s direct API Last.fm), 4 KPIs, top artistes/tracks/albums toggle 7d/30d/6m/all, série 90j + heatmap dow×hour, genres, découvertes RPC et milestones YTD.

## Scope
perso

## Finalité fonctionnelle
Pont Apple Music → Last.fm → Supabase → cockpit. Le scrobbler (AMWin-RP / QuietScrob / Web Scrobbler côté client Apple Music) envoie chaque écoute à Last.fm ; `pipelines/lastfm_sync.py` tourne à 5h UTC pour fetch `user.getRecentTracks` paginé puis calcule les stats quotidiennes (scrobble_count, unique_tracks/artists, top_artist, top_track, listening_minutes estimées à 3.5 min/track) ; `pipelines/lastfm_enrich.py` tourne le lundi (ou `--force`) pour enrichir les artistes avec leurs tags (`artist.getTopTags`, cache 90j), calculer la répartition genre hebdo, et générer un insight Gemini. Le panel consomme 7 tables + 1 RPC en parallèle au Tier 2 (`music_scrobbles/_stats_daily/_top_weekly/_loved_tracks/_genre_weekly/_insights_weekly` + RPC `music_discoveries`). Le hero intègre un polling live à l'API Last.fm en HTTP direct (toutes les 30s) avec une clé publique stockée dans `user_profile` — flag `is_live=true` quand Last.fm signale un scrobble actif.

## Parcours utilisateur
1. Clic sidebar "Musique" — le panel charge en parallèle scrobbles, stats quotidiennes, tops hebdomadaires, loved tracks, genres et découvertes.
2. Lecture du hero en tête de page : eyebrow (nombre total de scrobbles sur 180 jours) + badge "live" conditionnel, titre adaptatif "X scrobbles sur 30 jours — dominé par {genre}", sous-titre streak + record. Carte now-playing à droite (pochette + piste + artiste + album + stats).
3. En arrière-plan, le now-playing se rafraîchit automatiquement toutes les 30 secondes tant que l'onglet est au premier plan — le badge "live" s'allume quand Last.fm signale une écoute active.
4. Lecture des quatre KPIs : scrobbles 7 jours avec variation vs période précédente, scrobbles 30 jours + taux quotidien, streak + record, heures aujourd'hui + semaine.
5. Lecture de la §1 Top artistes avec toggle 7d / 30d / 6m / all — deux colonnes × cinq artistes avec pochette (ou avatar coloré + initiales si image absente).
6. Lecture de la §2 Top titres sur 30 jours en liste dense.
7. Lecture de la §3 Top albums en cartes avec pochette, rang et nombre d'écoutes.
8. Lecture de la §4 Rythme d'écoute :
   - Graphique avec toggle 30j / 90j / 180j : barres par jour + moyenne mobile 7 jours.
   - Heatmap jour × heure réordonnée Lundi→Dimanche, cinq paliers d'intensité, tooltip au survol pour chaque case.
9. Lecture de la §5 Genres 30 derniers jours : barre empilée horizontale + table détaillée avec part, variation et récap hebdomadaire textuel.
10. Lecture de la §6 Découvertes : artistes dont la première écoute date de moins de 90 jours, avec verdict automatique (accroché / à creuser / abandonné). Preview cinq + bouton "Voir les N autres".
11. Lecture de la §7 Milestones YTD : six cartes d'objectifs annuels (scrobbles vs cible, artistes uniques, découvertes, albums écoutés 5+ fois, heures estimées, genre dominant).

## Fonctionnalités
- **Now-playing live** : carte à droite du hero avec pochette d'album, piste, artiste, album et badge « live » qui s'allume quand Last.fm signale une écoute active (polling toutes les 30 secondes, stoppé quand l'onglet passe en arrière-plan).
- **Hero narratif** : titre adaptatif « X scrobbles sur 30 jours — dominé par {genre dominant} », sous-titre streak d'écoute quotidienne + record, eyebrow avec total scrobbles sur 180 jours.
- **Quatre KPIs** : scrobbles 7j avec variation vs 7 jours précédents, scrobbles 30j avec taux quotidien, streak courante + record, heures aujourd'hui + semaine.
- **§1 Top artistes** : toggle 7d / 30d / 6m / all, grille 2 colonnes × 5 artistes avec pochette (ou avatar coloré + initiales si image absente), nombre d'écoutes, delta vs période précédente.
- **§2 Top titres** : liste dense des titres les plus écoutés sur 30 jours avec pochettes.
- **§3 Top albums** : cartes avec pochette d'album, rang et nombre d'écoutes.
- **§4 Rythme d'écoute** : graphique 30j / 90j / 180j avec barres par jour + moyenne mobile 7 jours. Heatmap jour × heure (Lun→Dim × 0h→23h) avec cinq paliers d'intensité pour repérer les moments d'écoute dominants.
- **§5 Genres 30 derniers jours** : barre empilée horizontale des principaux genres + table détaillée avec part en %, variation vs période précédente, et récap hebdomadaire généré automatiquement avec mood keywords.
- **§6 Découvertes 90 jours** : liste des artistes dont la première écoute date de moins de trois mois, verdict automatique (accroché ≥50 écoutes / à creuser ≥15 / abandonné <15), preview 5 + bouton « Voir les N autres ».
- **§7 Milestones YTD** : six cartes d'objectifs annuels (scrobbles, artistes uniques, découvertes, albums ≥5 écoutes, heures estimées, genre dominant) avec progression vers cible.

## Front — structure UI
Fichier : [cockpit/panel-musique.jsx](cockpit/panel-musique.jsx) — 628 lignes, monté par [app.jsx:410](cockpit/app.jsx:410).

Structure DOM :
- `.mz-wrap[data-screen-label="Musique"]`
  - `.mz-hero > (texte + .mz-hero-np)`
  - `.mz-kpis > .mz-kpi × 4`
  - `.mz-section × 7` (chacune avec `.mz-section-head > .mz-section-num + .mz-section-title + .mz-section-meta`) :
    - §1 Top artists (+ `.mz-range` toggle) → `.mz-top > .mz-top-col × 2 > .mz-artist-row × 5`
    - §2 Top tracks → `.mz-tracks` header + rows
    - §3 Top albums → `.mz-albums > .mz-album × N`
    - §4 Rythme : `.mz-chart-wrap > MzDailyChart` + `.mz-heatmap > MzHeatmap`
    - §5 Genres : `.mz-genre-bar` + `.mz-genres > (.mz-genre-table + prose)`
    - §6 Découvertes (composant `DiscoveriesSection`) : `.mz-disc-list > .mz-disc × N` + bouton "load more"
    - §7 Milestones : `.mz-milestones > .mz-milestone × 6`

Route id = `"music"`. **Panel Tier 2**.

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelMusique()` | Composant racine, lit `window.MUSIC_DATA` + 2 toggles en state | [panel-musique.jsx:256](cockpit/panel-musique.jsx:256) |
| `useLiveNowPlaying(initial)` | Hook polling Last.fm 30s, merge `is_live` + image + ts dans `np` state | [panel-musique.jsx:19](cockpit/panel-musique.jsx:19) |
| `DiscoveriesSection({ discoveries })` | Preview 5 + toggle "load more" | [panel-musique.jsx:98](cockpit/panel-musique.jsx:98) |
| `relTimeMs(ms)` | Millisecondes → "il y a Ns/Nmin/Nh/Nj" (uniquement utilisé par le live hook) | [panel-musique.jsx:141](cockpit/panel-musique.jsx:141) |
| `MzDailyChart({ series, range })` | SVG bar+line chart 30/90/180j avec moyenne mobile 7j, grid Y 4 ticks, X 6 dates | [panel-musique.jsx:154](cockpit/panel-musique.jsx:154) |
| `MzHeatmap({ grid })` | 7×24 réordonné Monday-first, paliers alpha `rgba(168,74,34, 0.15→1)` | [panel-musique.jsx:221](cockpit/panel-musique.jsx:221) |
| `initials(name)` (inline) | 2 premières lettres majuscules pour avatar artiste sans art | [panel-musique.jsx:268](cockpit/panel-musique.jsx:268) |
| `T2.music_scrobbles()` | `GET music_scrobbles?order=scrobbled_at.desc&limit=200` | [data-loader.js:1293](cockpit/lib/data-loader.js:1293) |
| `T2.music_scrobble_times()` | `GET music_scrobbles?select=scrobbled_at&limit=50000` — payload léger pour heatmap sans limite | [data-loader.js:1296](cockpit/lib/data-loader.js:1296) |
| `T2.music_stats()` | `GET music_stats_daily?order=stat_date.desc&limit=400` | [data-loader.js:1294](cockpit/lib/data-loader.js:1294) |
| `T2.music_top()` | `GET music_top_weekly?order=week_start.desc&limit=1000` | [data-loader.js:1295](cockpit/lib/data-loader.js:1295) |
| `T2.music_loved()` | `GET music_loved_tracks?order=loved_at.desc&limit=40` | [data-loader.js:1296](cockpit/lib/data-loader.js:1296) |
| `T2.music_genres()` | `GET music_genre_weekly?order=week_start.desc&limit=120` | [data-loader.js:1297](cockpit/lib/data-loader.js:1297) |
| `T2.music_insights()` | `GET music_insights_weekly?order=week_start.desc&limit=12` | [data-loader.js:1298](cockpit/lib/data-loader.js:1298) |
| `T2.music_discoveries()` | `POST /rpc/music_discoveries {p_window_days:90, p_recent_days:30}` avec catch vide | [data-loader.js:1299](cockpit/lib/data-loader.js:1299) |
| `transformMusic({ scrobbles, stats, top, loved, genres, newArtists })` | Assemble toute la shape MUSIC_DATA depuis 6 corpus + 1 RPC | [data-loader.js:1697](cockpit/lib/data-loader.js:1697) |
| `aggregateTop(rows, weeks)` (inline dans transform) | Rollup weekly tops par item_name + secondary_name | [data-loader.js:1754](cockpit/lib/data-loader.js:1754) |
| `classifyVerdict(plays)` (inline) | ≥50 `accroché`, ≥15 `à creuser`, <15 `abandonné` | [data-loader.js:1995](cockpit/lib/data-loader.js:1995) |
| `tintFor(s)` (inline) | Hash → hue HSL stable pour art placeholder | [data-loader.js:1806](cockpit/lib/data-loader.js:1806) |
| `loadPanel("music")` case | 7 promises.all → transformMusic → `replaceShape(MUSIC_DATA, shape)` | [data-loader.js:4442-4460](cockpit/lib/data-loader.js:4442) |

## Back — sources de données

| Table | Colonnes | Volume live (2026-04-24) | Usage |
|-------|----------|---------------------------|-------|
| `music_scrobbles` | `id uuid PK, track_name, artist_name, album_name, scrobbled_at timestamptz, track_mbid, artist_mbid, album_mbid, track_url, image_url, created_at` | **525** | Source raw (now_playing, heatmap, fallback top artists/tracks/albums, image_url lookup) |
| `music_stats_daily` | `stat_date date PK, scrobble_count, unique_tracks, unique_artists, top_artist, top_artist_count, top_track, top_track_artist, top_track_count, listening_minutes, new_artists_count, computed_at` | **7** | Totals, streak, daily_series, milestones YTD |
| `music_top_weekly` | `id uuid, week_start date, category text (artist\|track\|album), item_name, secondary_name, play_count, rank, computed_at, image_url` | **0** ⚠️ | Rollup weekly (vide actuellement → fallback raw scrobbles) |
| `music_loved_tracks` | `id uuid, track_name, artist_name, track_url, loved_at, created_at, image_url` | **0** ⚠️ | `is_loved` check pour now_playing + fallback discoveries |
| `music_genre_weekly` | `week_start date, genre text, scrobble_count, percentage, rank` | **30** | Répartition genres 30j (filtré `week_start >= today-30d`) |
| `music_insights_weekly` | `week_start date, summary text, top_genre, discovery_ratio, mood_keywords text[], generated_by, generated_at` | **2** | **Fetché mais pas affiché** — cf. limitations |
| `music_artist_tags` | `artist_name PK, tags text[], top_tag, fetched_at` | **162** | Cache backend uniquement (pas lu par le front) |
| `music_scrobbles_raw` | `…payload JSON…` | **23** | Archive brute service_role only, pas lu par le front |
| `user_profile` | `key/value` | — | Lu indirectement pour récupérer `lastfm_api_key` + `lastfm_username` (polling live) |

**RPC** : [sql/010_music_discoveries_rpc.sql](sql/010_music_discoveries_rpc.sql) définit `music_discoveries(p_window_days INT, p_recent_days INT)` qui agrège `music_scrobbles` : grouped-by `artist_name` avec `MIN(scrobbled_at)` dans la fenêtre, retourne `{artist_name, first_scrobble, scrobbles_recent, scrobbles_total, image_url}`. `GRANT EXECUTE TO authenticated`.

## Back — pipelines qui alimentent
- **Last.fm sync** ([pipelines/lastfm_sync.py](pipelines/lastfm_sync.py)) — cron `0 5 * * *` ([lastfm-sync.yml](.github/workflows/lastfm-sync.yml)) :
  - **Phase A** : `user.getRecentTracks` paginé (200/page, 200ms entre pages, max 3 retries avec backoff 2^attempt). Si la table est vide → bootstrap 90 jours ; sinon lookback=1j. Upsert `music_scrobbles_raw` (archive) puis `music_scrobbles` (dedupé sur scrobbled_at+artist+track).
  - **Phase B** : agrège les scrobbles en `music_stats_daily` (scrobble_count, unique, top_artist/track, listening_minutes = `count × 3.5`).
  - **Phase C** : lundi uniquement (ou bootstrap) → 3 appels `user.getWeeklyArtistChart/TrackChart/AlbumChart` → `music_top_weekly` (on_conflict `week_start,category,rank`). Puis `user.getLovedTracks` → `music_loved_tracks`.
- **Last.fm enrich** ([pipelines/lastfm_enrich.py](pipelines/lastfm_enrich.py)) — même workflow, step "Enrich" déclenchée lundi ou manuel :
  - **Phase A** : `artist.getTopTags` pour chaque artiste des 30 derniers jours, cache 90j dans `music_artist_tags`.
  - **Phase B** : compute `music_genre_weekly` depuis scrobbles + tags → 1 ligne par `(week_start, genre)` avec scrobble_count, percentage, rank.
  - **Phase C** : appelle Gemini (si `GEMINI_API_KEY` présent) pour générer un summary / mood_keywords / top_genre → `music_insights_weekly`.
- **Daily pipeline** ([main.py](main.py)) : **n'écrit rien** dans les tables music.
- **Weekly pipeline** ([weekly_analysis.py](weekly_analysis.py)) : **n'écrit rien** dans les tables music.
- **Jarvis (local)** : **ne lit ni n'écrit** — pas dans `jarvis/indexer.py` (musique = personnel privé, pas indexé dans le RAG).

## Appels externes
- **Last.fm API publique** (directement depuis le navigateur) : `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user={username}&api_key={publishable}&limit=1&format=json`. Appel toutes les 30s. Pas d'auth (clé API Last.fm publique stockée dans `user_profile`). Whitelist CSP : `connect-src ... https://ws.audioscrobbler.com`.
- **Supabase REST** : 6 GET + 1 RPC POST via `T2.*`, une seule fois par session (mémoïsé via `once()`).
- **CDN images** whitelist CSP : `img-src ... https://lastfm.freetls.fastly.net https://*.lastfm.freetls.fastly.net https://coverartarchive.org https://*.archive.org https://*.dzcdn.net https://cdn-images.dzcdn.net`. Les URLs viennent de `music_scrobbles.image_url` (écrit par le pipeline depuis `_best_image()`).
- **Aucune télémétrie** : le panel n'émet pas de `track()` events. Pas de navigation sortante (tout reste dans l'onglet).

## Dépendances
- **Onglets in** : sidebar uniquement. Pas de deep-link / hash.
- **Onglets out** : aucun (pas de lien cliquable sortant du panel).
- **Globals lus** : `window.MUSIC_DATA` (14 champs), `window.PROFILE_DATA._values.lastfm_api_key + .lastfm_username` pour le polling live.
- **Composants externes** : aucun. Tout est inline (JvIcon absent, Icon absent — pas d'icônes à part le badge live).
- **Pipelines** : `lastfm-sync.yml` (daily + enrich Monday).
- **Variables d'env / secrets (backend)** :
  - `LASTFM_API_KEY`, `LASTFM_USERNAME`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
  - `GEMINI_API_KEY` (optionnel, sinon la Phase C enrich est skippée)
- **Variables user_profile** (lues par le front) :
  - `lastfm_api_key` (clé publique Last.fm)
  - `lastfm_username`

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant les 7 fetches + 1 RPC.
- **DB vide** : `transformMusic({})` retourne quand même une shape complète avec `now_playing` placeholder `"—"`, totals 0, tops vides, daily_series 90 jours avec `scrobbles: 0`. Le panel s'affiche sans crash mais avec des zéros.
- **`music_top_weekly` vide** (actuel) : fallback automatique sur les raw scrobbles → panneau fonctionnel mais limité aux 200 derniers scrobbles.
- **`music_loved_tracks` vide** (actuel) : `loved: false` toujours dans now_playing, fallback discoveries utilise loved tracks vides → discoveries peut être vide si RPC aussi retourne vide.
- **Polling sans `lastfm_api_key`** : le useEffect retourne early, pas de polling. `np` reste sur le cached `now_playing` du loader.
- **Polling échec** : catch silent, le state ne change pas. Pas de compteur d'échecs, pas de badge "offline".
- **Image placeholder Last.fm** : le hash `2a96cbd8b46e442fc41c2b86b821562f` (étoile générique) est filtré côté front ET côté pipeline — replacé par `null` pour tomber sur le `tintFor()` fallback.
- **Image absente** : `<img onError>` cache l'img → le div parent garde sa couleur `tintFor` + initiales.
- **Album sans year** : champ `year` vide → affiché sans "·".
- **Artist change indicator** : `{a.change > 0 ? "▲ +N" : a.change < 0 ? "▼ N" : "— 0"}`. Loader set toujours `delta: 0` sur les rollups weekly → toujours "— 0" affiché pour les rows DB.
- **Heatmap sans scrobbles** : `max=0` → `max / v = 0/0 = NaN` → rgba NaN → cellule bg = invalide. En pratique `grid.flat()` retourne du 0 partout et le color fallback sur `var(--bd)`.
- **RPC 404** (migration 010 pas appliquée) : `.catch(() => [])` retourne `[]`, fallback sur loved → si loved aussi vide, section discoveries disparaît (filter vide).
- **Aujourd'hui sans scrobbles** : `todayStats` = undefined, `hours_today = 0`, streak break → `current_daily` repart de 0.
- **Mix de dates** (Last.fm UTC vs local timezone) : `new Date(s.scrobbled_at).getDay()` utilise le TZ local → un scrobble fait à 00:30 Paris tombe dans le bon jour, mais les streaks sur `stat_date` utilisent la date UTC du pipeline.
- **`percentage` dans `music_genre_weekly` non lu** : le front recalcule `count / total` au lieu d'utiliser la colonne → double source de vérité.
- **Polling + onglet en arrière-plan** : setInterval continue de tourner (pas de `document.visibilityState` check). Consomme ~2 req/min même si l'utilisateur ne regarde pas.

## Limitations connues / TODO
- [x] ~~**KPI "+8% vs 7j préc." hardcodé**~~ → **fixé** : loader calcule `last7_change_pct = (last7 - prev7) / prev7 × 100` via `inPrevRange()`. Le KPI affiche ▲/▼/— selon le signe. `+100%` si `prev7=0` et `last7>0`.
- [x] ~~**`genres_30d[i].change` toujours à 0**~~ → **fixé** : loader agrège 2 tallies (`genreTally` 0-30j + `genrePrevTally` 30-60j), `change = curPct - prevPct` en **points de %**. Pour `top_artists` idem via `aggregateTopRange(rows, fromWeeks, toWeeks)` qui calcule cur + prev window-equivalent → `change/delta = count - prevCount`.
- [x] ~~**Prose "lecture" hardcoded**~~ → **fixé** : remplacée par `D.insight.summary` (le plus récent depuis `music_insights_weekly`), avec fallback explicite vers un message "Aucun insight — le pipeline tourne le lundi". Les `mood_keywords` sont affichés en dessous en mono-caps si présents.
- [x] ~~**`music_insights_weekly` fetché mais ignoré**~~ → **fixé** : loader sort maintenant un objet `insight: {week_start, summary, top_genre, mood_keywords, discovery_ratio}` (le + récent par `week_start desc`). Consommé par la section §5.
- [ ] **`music_top_weekly` vide** : le pipeline ne tourne la Phase C que le lundi (ou au bootstrap). Si le premier run n'était pas un lundi et qu'aucun relancement manuel n'a eu lieu, la table reste vide. **Constaté actuellement : 0 lignes**. Le panel marche en fallback mais les tops 6m/all-time sont limités aux 200 derniers scrobbles (pas représentatifs).
- [ ] **`music_loved_tracks` vide** : idem — Phase C lundi. 0 lignes actuellement.
- [ ] **Artist `new` badge jamais affiché** : le loader ne set jamais `new: true` sur les rollups DB. Seule la fake data l'avait.
- [x] ~~**Polling live en arrière-plan**~~ → **fixé** : `useLiveNowPlaying` écoute `visibilitychange`, `start()` lance `setInterval(poll, 30s)`, `stop()` le clear. Cleanup unmount retire aussi le listener.
- [ ] **Sécurité clé API Last.fm** : `lastfm_api_key` est stockée dans `user_profile` et lue côté front → exposée en clair dans le DOM/network. **OK pour Last.fm** (clé publique read-only, non sensible), mais non évident pour un relecteur.
- [ ] **Aucun feedback d'erreur** : si les 7 fetches renvoient `[]` pour une raison réseau, le panel affiche juste des zéros sans message. Le chargement d'erreur du Tier 2 (retry button) ne se déclenche pas parce que le catch est côté `q()` qui renvoie `[]`.
- [x] ~~**Heatmap calculée sur 200 scrobbles seulement**~~ → **fixé** : nouveau loader dédié `T2.music_scrobble_times()` qui fait `GET music_scrobbles?select=scrobbled_at&limit=50000` (payload léger, ~12 octets/ligne). `transformMusic` utilise `scrobbleTimes` en priorité, fallback sur `scrobbles` (200) si indisponible.
- [ ] **`listening_minutes` = `scrobble_count × 3.5`** : estimation crude (pipeline). Un titre de 7 min et un skip de 20s comptent pareil.
- [ ] **Pas de cleanup de chart range en localStorage** : le toggle 30j/90j/180j revient à "90j" à chaque reload.
- [ ] **Pas de filtre artist** : impossible de voir la série de scrobbles d'un artiste spécifique (ex. "Gojira sur 180j").
- [ ] **Pas de lien sortant** : on ne peut pas cliquer sur un artiste pour ouvrir sa page Last.fm ou Apple Music.
- [ ] **Milestones "objectif 35k" hardcoded** : `YTD_TARGET = 35000` dans le loader. Pas configurable via `user_profile`.
- [ ] **Tops 6m / all-time approximatifs** : `aggregateTop(byCat.artist, 999 weeks)` lit tout `music_top_weekly` — mais l'all-time réel dépasse largement la fenêtre de scrobbles (limit 200) pour le fallback.

## Dernière MAJ
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — rétro-doc + 5 fixes (last7 change % réel, top_artists/genres delta vs période précédente, insight_weekly branché, polling visibilitychange, heatmap sans limite via loader dédié)
