# Gaming

> Vue consolidée de l'activité gaming perso — bibliothèque Steam (918 jeux), TFT live, backlog, abandonnés, wishlist **éditable (CRUD)**, courbe d'activité 90j, genres 14j, top all-time, milestones YTD. 4 "profils plateformes" (Steam + Riot live, PSN + Xbox en placeholder). Heatmap supprimée (jamais calculée depuis les données réelles).

## Scope
perso

## Finalité fonctionnelle
Agrégateur multi-plateforme centré sur Steam (source principale) avec TFT live (pipeline Riot) et deux placeholders PSN/Xbox (pas de pipeline). Répond à "où en suis-je de ma vie de joueur ?" en 8 sections verticales : état live (dernière session + profils plateformes), jeux en cours (14 derniers jours), backlog jamais ouvert, **abandonnés** (>1h cumulées, 0h sur 14j — candidats finir ou désinstaller), courbe temps de jeu 90j, genres 14j, **wishlist éditable (CRUD authenticated)**, top all-time par heures, achievements récents, milestones YTD. Toutes les stats sont calculées **côté client** par `transformGaming` à partir des 7 tables — aucune agrégation backend au-delà du sync Steam quotidien.

## Parcours utilisateur
1. Clic sidebar "Gaming" (groupe Personnel) → Tier 2 `loadPanel("gaming")` → 7 fetchs parallèles (snapshot, stats, achievements, game_details, tft_rank_latest, tft_match_count, wishlist) puis `transformGaming({...})` + `replaceShape(GAMING_PERSO_DATA, shape)`.
2. **Hero** : eyebrow "steam + riot (tft) · Nh cumulées Steam", H1 avec heures 30j + nombre de jeux lancés/owned + backlog count. Sub avec genre dominant 14j + rang TFT live. Droite : `gm-last-cover` = dernière session (premier jeu de `in_progress`), cover via Steam CDN direct.
3. **Grid 4 profils** : Steam (réel), PlayStation + Xbox (`_placeholder: true` — opacity 45%, "pipeline non branché"), Riot (TFT live avec rang + LP + matchs trackés + W/L ratio).
4. **§1 En cours** : cards grid, max 4 jeux Steam par `playtime_2weeks_minutes desc` + TFT en "ongoing" si matchs trackés. Cover Steam CDN, genre depuis `steam_game_details[0]`, note "Jeu actif récemment — Nh sur les 2 dernières semaines". `hltb_main` et `progress_pct` toujours null (pas d'intégration HowLongToBeat).
5. **§2 Backlog** : 8 jeux (hardcoded slice) avec `playtime_forever_minutes === 0`. Priority "shame" appliqué sur tous. `hype=5`, `hltb=0`, `acquired="—"` car pas de date d'acquisition en base.
6. **§2bis Abandonnés** (conditionnel ≥1 jeu) : jeux avec >=60min cumulées mais 0min sur 14j. Tri par playtime_forever desc, max 12. Signal "commencé sérieusement puis lâché".
7. **§3 Activité** : courbe 90j (`daily_sessions[]` = hours/jour depuis `gaming_stats_daily.total_playtime_minutes / 60`) + moyenne mobile 7j. Toggle 30j/90j via state local. **Heatmap retirée** (jamais calculée depuis les données réelles).
8. **§4 Genres 14j** : bar horizontale proportionnelle `share` + table détaillée. Calculé depuis `steam_games_snapshot.playtime_2weeks_minutes` croisé avec `steam_game_details.genres[0]`. Les jeux non enrichis tombent dans "Autre". Avec 2/918 jeux enrichis, "Autre" domine en pratique.
9. **§5 Wishlist éditable** : cards avec cover Steam (via appid), `days_out` calculé depuis `release_date`, classe `.is-out` si <90j, hype, platform, prix cible, note. Bouton `+ Ajouter` ouvre un `<WishlistEditor>` avec 7 champs (titre, appid, plateforme, date, hype, prix, note) + "Enregistrer" (POST) / "Annuler". Boutons `Éditer` et `Retirer` par card (PATCH / DELETE avec confirm). Optimistic update via state local `wlLocal` (pas de reload Tier 2 complet). CTA "Veille gaming →" bascule vers panel `gaming_news` + `track("gaming_veille_link_clicked")`.
10. **§6 Top all-time** : 10 premiers jeux par `playtime_forever_minutes desc`. Barre de progression proportionnelle au max. Colonnes `sessions` et `since` retirées (toujours nulles).
11. **§7 Achievements** : 6 max depuis `steam_achievements` (actuellement **0 rows**). Icônes typés (PLT / OR / AG / BZ / ★ / ●), rarity % des joueurs.
12. **§8 Milestones** : 6 indicateurs figés — Heures YTD (progress vers 500h), bibliothèque total, heures cumulées, achievements count, TFT rang, sessions 30j.

## Fonctionnalités
- **Hero multi-plateforme** : titre avec heures de jeu 30 jours + jeux lancés sur owned + backlog. Carte dernière session (pochette + nom + temps récent) et sous-titre avec genre dominant et rang TFT live.
- **Grid 4 profils plateformes** : cartes Steam (réelle, heures cumulées), Riot/TFT (live avec rang + LP + W/L), PlayStation + Xbox en placeholders grisés (« pipeline non branché »).
- **§1 En cours** : jeux les plus joués sur les 14 derniers jours sur Steam, plus une carte TFT si des matchs sont trackés. Pochette via le CDN Steam direct.
- **§2 Backlog** : huit jeux possédés jamais lancés, avec tag « shame » pour les candidats à finir ou désinstaller.
- **§2bis Abandonnés** : jeux avec au moins 1h cumulée mais 0 minute sur les 14 derniers jours — signal honnête « commencé sérieusement puis lâché », distinct du backlog.
- **§3 Activité** : courbe de temps de jeu sur 30 ou 90 jours avec moyenne mobile 7 jours pour lisser les variations.
- **§4 Genres 14 jours** : barre horizontale empilée + table détaillée des principaux genres joués, calculée à partir des jeux enrichis (les autres tombent en « Autre »).
- **§5 Wishlist éditable** : cartes avec pochette, titre, date de sortie (badge « sort bientôt » si <90j), hype, plateforme, prix cible et note. Boutons « + Ajouter », « Éditer » et « Retirer » avec sauvegarde en base et mise à jour instantanée. Raccourci « Veille gaming ↗ » vers l'onglet news gaming.
- **§6 Top all-time** : dix jeux les plus joués par heures cumulées, avec barre de progression relative au maximum.
- **§7 Achievements récents** : jusqu'à six derniers achievements Steam débloqués (platine / or / argent / bronze / spécial / commun) avec rareté en pourcentage des joueurs.
- **§8 Milestones YTD** : six indicateurs annuels (heures vs objectif 500h, taille de bibliothèque, heures cumulées, achievements, rang TFT, sessions 30j).
- **Empty state pipeline** : quand aucun snapshot Steam n'est disponible, message explicite avec raccourci « Veille gaming ↗ » et instruction de vérifier le workflow steam-sync.

## Front — structure UI
Fichier : [cockpit/panel-gaming.jsx](cockpit/panel-gaming.jsx) — ~700 lignes post-fix, monté par [app.jsx:411](cockpit/app.jsx:411). CSS dédié : [cockpit/styles-gaming.css](cockpit/styles-gaming.css) — ~1020 lignes, scope `gm-*` (`mz-*` plus utilisé depuis suppression heatmap). Ressources dans [index.html:29, 70, 95](index.html:29) (versions `css?v=5`, `data?v=2`, `jsx?v=5`).

Structure DOM :
- `.gm-wrap[data-screen-label="Gaming"]`
  - **Empty state** (si `profiles + in_progress + top_alltime` tous vides) : `.gm-hero` avec eyebrow "en attente du prochain sync Steam" + CTA "Veille gaming →". Aucune autre section rendue.
  - Sinon :
    - `.gm-hero` — eyebrow + H1 + sub à gauche, `.gm-last` à droite (cover + meta dernière session)
    - `.gm-profiles` — 4 `.gm-profile` (1 avec `.is-placeholder` si `_placeholder: true`)
    - 8 `<section class="gm-section">` numérotées 01-08 :
      - §01 `.gm-ip-grid` → `.gm-ip-card` avec `.gm-ip-cover` + `.gm-ip-body` (progress bar conditionnelle)
      - §02 `.gm-bl-list` → header `.gm-bl-row.is-head` + N rows classés `.is-shame` si priority
      - §02b `.gm-abandoned-grid` → `.gm-abandoned-card`
      - §03 `.gm-chart-wrap` avec toggle 30j/90j → `<GmActivityChart>` SVG uniquement (heatmap supprimée)
      - §04 `.gm-genre-bar` horizontale + grid 2 cols (table + paragraph italique)
      - §05 `.gm-section-meta` avec bouton `+ Ajouter` → `<WishlistEditor>` + `.gm-wl-grid` → `.gm-wl-card.is-out?` avec `.gm-wl-actions` (Éditer / Retirer) + `.gm-veille-link` bas
      - §06 `.gm-top-row` table 5 cols (# / jeu / plateforme / heures / spacer)
      - §07 `.gm-ach-list` → `.gm-ach` avec icône typée
      - §08 `.gm-milestones` grid 3 cols avec `.gm-milestone-bar` optionnel

Route id = `"gaming"`. **Panel Tier 2** ([data-loader.js:4565](cockpit/lib/data-loader.js:4565)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelGaming({ onNavigate })` | Composant racine — lit `GAMING_PERSO_DATA`, state chartRange 30j/90j + wlEditing + wlLocal. Short-circuit empty state si pas de profils/in_progress/top | [panel-gaming.jsx:180](cockpit/panel-gaming.jsx:180) |
| `GmActivityChart({ series, range })` | SVG 1000×200 : yTicks + bars opacity 22% + ligne moyenne mobile 7j. Guard data.length>1 pour éviter NaN | [panel-gaming.jsx:18](cockpit/panel-gaming.jsx:18) |
| `WishlistEditor({ initial, onSave, onCancel })` | Form 7 champs (titre/appid/plateforme/date/hype/prix/note) + boutons Enregistrer/Annuler | [panel-gaming.jsx:94](cockpit/panel-gaming.jsx:94) |
| `gmWishlistPost(payload)` / `gmWishlistPatch(id, patch)` / `gmWishlistDelete(id)` | REST wrappers vers `/rest/v1/gaming_wishlist` | [panel-gaming.jsx:79-92](cockpit/panel-gaming.jsx:79) |
| `handleWishlistCreate / Update / Delete` | Handlers avec optimistic `wlLocal` + telemetry add/update/delete + `track("error_shown")` | [panel-gaming.jsx:237-296](cockpit/panel-gaming.jsx:237) |
| `T2.steam_snapshot()` | `GET steam_games_snapshot?snapshot_date=eq.{today}&limit=2000&order=playtime_forever_minutes.desc.nullslast` | [data-loader.js:1310](cockpit/lib/data-loader.js:1310) |
| `T2.steam_stats()` | `GET gaming_stats_daily?order=stat_date.desc&limit=180` | [data-loader.js:1312](cockpit/lib/data-loader.js:1312) |
| `T2.steam_achievements()` | `GET steam_achievements?order=unlocked_at.desc&limit=50` | [data-loader.js:1313](cockpit/lib/data-loader.js:1313) |
| `T2.steam_game_details()` | `GET steam_game_details?select=appid,name,genres,header_image_url,release_date&limit=2000` | [data-loader.js:1314](cockpit/lib/data-loader.js:1314) |
| `T2.tft_rank_latest()` | `GET tft_rank_history?order=captured_at.desc&limit=1` | [data-loader.js:1315](cockpit/lib/data-loader.js:1315) |
| `T2.tft_match_count()` | `GET tft_matches?select=match_id&limit=1000` puis `rows.length` | [data-loader.js:1316](cockpit/lib/data-loader.js:1316) |
| `T2.gaming_wishlist()` | `GET gaming_wishlist?order=hype.desc.nullslast,release_date.asc.nullslast&limit=50` | [data-loader.js:1324](cockpit/lib/data-loader.js:1324) |
| `transformGaming({ snapshot, stats, achievements, gameDetails, tftRank, tftMatchCount, wishlist })` | Build complet du shape `GAMING_PERSO_DATA` (profiles + totals + 7 sections) | [data-loader.js:2378](cockpit/lib/data-loader.js:2378) |
| `steamHeaderUrl(appid)` | URL CDN header.jpg | [data-loader.js:2428](cockpit/lib/data-loader.js:2428) |
| `steamLibraryUrl(appid)` | URL CDN library_600x900.jpg — défini mais **non utilisé** par ce panel | [data-loader.js:2431](cockpit/lib/data-loader.js:2431) |
| `loadPanel("gaming")` case | `Promise.all` des 7 fetchs + `transformGaming` + `replaceShape` | [data-loader.js:4480-4495](cockpit/lib/data-loader.js:4480) |
| `replaceShape(target, source)` | Object.assign-like (overwrite keys de source, **ne supprime pas** les keys orphelines) | [data-loader.js:1386](cockpit/lib/data-loader.js:1386) |

## Back — sources de données

| Table | Colonnes lues | Volumétrie actuelle |
|-------|---------------|--------------------|
| `steam_games_snapshot` | `appid, name, playtime_forever_minutes, playtime_2weeks_minutes, snapshot_date`. Filtré `snapshot_date=eq.{today}`. | **918 rows** (snapshot du jour 2026-04-24). DDL versionné dans [sql/013_gaming.sql](sql/013_gaming.sql). |
| `steam_game_details` | `appid, name, genres, header_image_url, release_date`. Cache permanent. | **2 rows** — enrichissement Store API plafonné à 20/run par le pipeline, catch-up extrêmement lent. Conséquence : `genres_30d` est dominé par "Autre". DDL versionné dans [sql/013_gaming.sql](sql/013_gaming.sql). |
| `gaming_stats_daily` | `stat_date, total_playtime_minutes` (autres colonnes `games_played_count, top_game_name, top_game_minutes, tft_games_count` ignorées par le panel). | **8 jours** (pipeline jeune). Chart 90j a 82 zéro-fills pour l'instant. DDL versionné dans [sql/013_gaming.sql](sql/013_gaming.sql). |
| `steam_achievements` | `appid, achievement_name, achievement_api_name, unlocked_at`. | **0 rows** — phase D du pipeline ne déclenche que lundi ou via `--force`, et n'a jamais rempli. Zone 07 affiche empty state. DDL versionné dans [sql/013_gaming.sql](sql/013_gaming.sql). |
| `gaming_wishlist` | **Read** : `id, appid, title, platform, release_date, hype, price_target, note, on_radar, bought, updated_at`. **Write (front CRUD)** : POST (via `+ Ajouter`), PATCH (via `Éditer`), DELETE (via `Retirer`). | **8 titres**. RLS : `select/insert/update/delete authenticated`. DDL + policies + trigger `updated_at` versionnés dans [sql/013_gaming.sql](sql/013_gaming.sql). |
| `tft_rank_history` | `tier, rank, lp, wins, losses, captured_at`. Dernière ligne seulement. | 8 snapshots. |
| `tft_matches` | `match_id` uniquement (pour count via `rows.length`). Les autres colonnes sont consommées par le panel TFT dédié, pas ici. | — |

## Back — pipelines qui alimentent
- **Pipeline Steam** ([pipelines/steam_sync.py](pipelines/steam_sync.py) — 415 lignes) — cron `30 5 * * *` via [.github/workflows/steam-sync.yml](.github/workflows/steam-sync.yml), workflow tourne avec `--force` pour bypasser la gate lundi d'achievements.
  - **Phase A** : Daily library snapshot → `steam_games_snapshot`. `GetOwnedGames` (profil public requis — 403 = exit) + `GetRecentlyPlayedGames` pour `playtime_2weeks_minutes`. Upsert via `(appid, snapshot_date)`.
  - **Phase B** : Delta stats vs hier → `gaming_stats_daily`. `total_playtime_minutes` = somme des deltas `playtime_forever_minutes`. Upsert par `stat_date`.
  - **Phase C** : Enrichissement Store API → `steam_game_details`. Cap `MAX_ENRICH_PER_RUN = 20`. Délai `STORE_DELAY = 0.3s`. 403 traité graciously (skip).
  - **Phase D** : Achievements → `steam_achievements`. `GetUserStatsForGame` per-game, 403 silencieux si jeu sans achievements. Déclenché lundi ou `--force`.
- **Pipeline TFT** ([tft_pipeline.py](tft_pipeline.py)) — toutes les 2h via [.github/workflows/tft-sync.yml](.github/workflows/tft-sync.yml). Écrit `tft_matches`, `tft_rank_history` (+ `tft_match_units`, `tft_match_traits`, `tft_match_lobby` non lus ici). Utilisé par le panel TFT Matches dédié + count partiel ici.
- **`gaming_wishlist`** : aucun pipeline — édition manuelle uniquement. Les lignes actuelles ont été insérées via Supabase Studio ou MCP.
- **Front** : aucun writer. Lecture seule.

## Appels externes
- **Supabase REST (lecture)** : 7 requêtes parallèles — détail dans "Fonctions JS".
- **Steam CDN** (public, no-auth) : `shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg` pour chaque cover. ~30-50 images par page view.
- **Steam Web API** (backend uniquement) — `GetOwnedGames`, `GetRecentlyPlayedGames`, `GetUserStatsForGame`, `GetSchemaForGame`, `GetPlayerAchievements`. Délai `DELAY_BETWEEN_REQUESTS = 0.2s` entre chaque call.
- **Steam Store API** (backend uniquement) — `/api/appdetails?appids=X` pour genres + description + header + release date. Délai `STORE_DELAY = 0.3s`.
- **Riot TFT API** (backend via `tft_pipeline.py`) — non documentée dans ce panel (cf. tab-tft dédié).
- **`window.open(..., "_blank")`** : aucun dans le panel Gaming (pas de lien sortie par jeu).
- **Supabase REST (écriture)** — sur wishlist uniquement (via CRUD UI) :
  - `window.sb.postJSON(/rest/v1/gaming_wishlist, payload)` — ajouter.
  - `window.sb.patchJSON(/rest/v1/gaming_wishlist?id=eq.X, patch)` — éditer.
  - `window.sb.deleteRequest(/rest/v1/gaming_wishlist?id=eq.X)` — retirer.
- **Telemetry** :
  - `gaming_wishlist_added` `{appid, hype}`
  - `gaming_wishlist_updated` `{id}`
  - `gaming_wishlist_deleted` `{id}`
  - `gaming_veille_link_clicked` `{}`
  - `error_shown` `{context, message}` — 4 handlers (add/update/delete + éventuellement autres).

## Dépendances
- **Onglets in** : sidebar "Gaming" (groupe Personnel). Aucun cross-nav entrant.
- **Onglets out** : `gaming_news` via bouton "Veille gaming →" dans §5 Wishlist.
- **Pipelines obligatoires** :
  - `steam-sync.yml` — sans ça, toutes les sections sauf Riot sont vides, la condition `(snapshot || []).length` dans `loadPanel("gaming")` empêche même le `replaceShape` → fake data persist.
  - `tft-sync.yml` — sans ça, le profil Riot est "—" et la card "Teamfight Tactics" n'apparaît pas.
- **Variables d'env / secrets** : `STEAM_API_KEY`, `STEAM_ID` (pipeline), `RIOT_API_KEY`, `RIOT_PUUID` (TFT), `SUPABASE_SERVICE_KEY` (écriture).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant les 7 fetchs parallèles.
- **Snapshot vide** : `data-gaming-perso.js` expose désormais un shape vide `{profiles:[], in_progress:[], ...}`. Le panel détecte ce cas (`profiles + in_progress + top_alltime` tous vides) et short-circuit vers un empty state dédié : hero "Aucun snapshot Steam disponible" + explication pipeline + CTA "Veille gaming →". **Plus de fake data affichée**.
- **`in_progress` vide** (aucun jeu Steam joué 14j + pas de TFT) : "Aucun jeu joué les 14 derniers jours sur Steam."
- **Backlog vide** (bibliothèque à 100% lancée) : "Bibliothèque entièrement explorée."
- **Abandoned section** : skippée entièrement (`{(D.abandoned || []).length > 0 && (...)}`) si 0 match.
- **`daily_sessions` vide** : "Pas de stats quotidiennes — pipeline trop récent."
- **`genres_30d` vide** (0 jeu enrichi avec playtime 14j) : "Pas assez de données enrichies (steam_game_details quasi vide)." — explicite sur la cause racine.
- **`wishlist` vide** : "Wishlist vide — ajoute des entrées dans la table Supabase `gaming_wishlist`." — dirige vers Supabase Studio car pas d'UI.
- **`top_alltime` vide** : "Pas de snapshot Steam disponible."
- **`achievements` vide** (actuel) : "Aucun achievement Steam tracké pour l'instant — phase D du pipeline ne déclenche que sur les jeux joués les 14 derniers jours." — description légèrement imprécise (en vrai, phase D tourne lundi/--force, pas gated par 14j).
- **Heatmap** : section supprimée du panel + composant `GmHeatmap` retiré. Plus de faux "Lun 14h · 2.3h moy." inventés.
- **`lastGame` null** (in_progress vide) : bloc "aucune session récente" avec opacity 0.6.
- **`tftRow.tier` null** : rang = "—", matchs = 0, la card "Teamfight Tactics" n'apparaît pas.
- **PSN/Xbox placeholders** : toujours affichés, toujours à 45% opacity, "pipeline non branché". Aucun moyen de les masquer.
- **Erreur réseau Tier 2** : `PanelError` avec bouton Réessayer. Les 4 fetchs avec `.catch(() => [])` (game_details, tft_rank, tft_match_count, wishlist) se dégradent silencieusement.
- **Steam CDN down** : les covers deviennent les backgrounds fallback `#1b2838` (Steam dark).

## Limitations connues / TODO
- [x] ~~Fake data persist si DB vide~~ — **fixé** : `data-gaming-perso.js` vidé à un shape vide + short-circuit empty state dédié dans le panel. Plus jamais de profils/backlog/wishlist de démo.
- [x] ~~Heatmap = mock 100% du temps~~ — **fixé** : section `.mz-heatmap` retirée du JSX + composant `GmHeatmap` supprimé (39 lignes de moins).
- [x] ~~Wishlist lecture seule~~ — **fixé** : `<WishlistEditor>` ajouté avec POST/PATCH/DELETE + optimistic `wlLocal` + boutons `+ Ajouter` / `Éditer` / `Retirer`. Les 4 policies RLS CRUD sont enfin utilisées.
- [x] ~~Pas de migration SQL versionnée~~ — **fixé** : [sql/013_gaming.sql](sql/013_gaming.sql) idempotent pour 5 tables Steam + wishlist + trigger `updated_at`.
- [x] ~~`sessions` toujours 0 dans top_alltime~~ — **fixé** : colonne retirée de l'UI (5 cols au lieu de 6), label "plateforme · depuis" remplacé par "plateforme" (depuis=null).
- [x] ~~Zero telemetry~~ — **fixé** : 4 events `gaming_wishlist_added|updated|deleted|veille_link_clicked` + `error_shown` dans tous les handlers d'erreur.
- [x] ~~NaN dans GmActivityChart si data.length=1~~ — **fixé en marge** : guard `data.length > 1` sur la fonction `x(i)`.
- [ ] **`steam_game_details` à 2/918** : taux d'enrichissement catastrophique (cap `MAX_ENRICH_PER_RUN = 20`). Soit lever le cap, soit prioriser les jeux joués 14j, soit tolérer un catch-up lent (année). Vérifier pourquoi 2 seulement alors que le pipeline tourne depuis plusieurs jours.
- [ ] **Achievements à 0 depuis release** : phase D --force dans le workflow est censée déclencher à chaque run, mais zéro achievement importé. Bug probable dans `GetUserStatsForGame` ou `GetPlayerAchievements`.
- [ ] **`hltb_main` / `progress_pct` tous null** : UI supporte ces champs mais aucune source HLTB. Intégrer l'API HowLongToBeat (non-officielle) OU retirer les champs de l'UI (comme fait pour sessions).
- [ ] **`shame_years`, `acquired_how`, `acquired`** hardcoded à `null` / `"—"` / `"Steam · jamais lancé"` pour le backlog. Steam API ne fournit pas la date d'achat. Retirer les colonnes ou brancher sur Steam store history (login requis).
- [ ] **Slices hardcoded** : `in_progress.slice(0, 4)`, `backlog.slice(0, 8)`, `abandoned.slice(0, 12)`, `top_alltime.slice(0, 10)`, `recent_achievements.slice(0, 6)`. Pas de "Load more", pas de config.
- [ ] **PSN / Xbox placeholders permanents** : si l'utilisateur ne compte pas brancher un jour, masquer les cards au lieu d'afficher "pipeline non branché".
- [ ] **`milestones` hardcoded** : 6 entrées toujours affichées, dont "Jeux terminés" à 0 faute de signal "done". Pas de config par utilisateur.
- [ ] **Chart range limité à 30/90** : toggle "180j" absent même si le fetch récupère 180 jours (`limit=180`). Juste un ajout de bouton à faire.
- [ ] **Cross-nav unique vers gaming_news** : pas de bouton "Ouvrir sur Steam" par jeu, pas de copie vers Carnet d'idées. Panel très figé.
- [ ] **Moyenne mobile 7j "centrée"** : la fenêtre est `[i-3, i+4]` — inclut le futur sur les 3 derniers jours, causant un artefact de lissage près de "aujourd'hui".
- [ ] **`data-gaming.js` ≠ `data-gaming-perso.js`** : deux fichiers similaires dans index.html. Le premier alimente `GAMING_DATA` (veille gaming/gaming_news), le second `GAMING_PERSO_DATA` (ce panel). Confusion potentielle.

## Dernière MAJ
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — rétro-doc + 7 correctifs appliqués (empty state dédié, fake data purgée, section heatmap supprimée, wishlist CRUD UI, migration 013 versionnée, télémétrie, NaN fix GmActivityChart) — commit `c456ac9` (base).
