# GitHub Secrets

Liste des secrets injectés dans les GitHub Actions et utilisés par les pipelines / le module Jarvis.

> **Écriture côté Supabase** : tous les pipelines backend utilisent `SUPABASE_SERVICE_KEY` pour bypass la RLS. Le front consomme uniquement la publishable key (hardcodée dans `cockpit/lib/supabase.js`).

## Cockpit core

| Secret | Usage |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio — `main.py` (RSS + web search + brief Flash-Lite gratuit) |
| `ANTHROPIC_API_KEY` | Claude API — `weekly_analysis.py` (Haiku 4.5, budget 1$/run) + mode Cloud de Jarvis |
| `SUPABASE_URL` | `https://mrmgptqpflzyavdfqwwv.supabase.co` |
| `SUPABASE_KEY` | Publishable key (`sb_publishable_...`) — usage lecture front |
| `SUPABASE_SERVICE_KEY` | Service role key — bypass RLS pour les pipelines backend (Jarvis refuse de démarrer sans) ; aussi utilisée par `pipelines/backup_supabase.py` (sauvegarde hebdo, ADR-37) |
| `SUPABASE_USER_ID` | UUID de l'utilisateur Supabase auth (injecté dans certaines requêtes RPC) |

## Email

| Secret | Usage |
|---|---|
| `GMAIL_ADDRESS` | Email expéditeur (SMTP daily) |
| `GMAIL_APP_PASSWORD` | Mot de passe d'app Gmail |
| `RECIPIENT_EMAIL` | Email destinataire |

## TFT

| Secret | Usage |
|---|---|
| `RIOT_API_KEY` | Riot Games Developer API (https://developer.riotgames.com) |
| `RIOT_PUUID` | PUUID du joueur TFT à tracker |

## Strava (pipeline `pipelines/strava_sync.py`)

Setup : voir [strava-setup.md](strava-setup.md).

| Secret | Usage |
|---|---|
| `STRAVA_CLIENT_ID` | Strava API app client ID |
| `STRAVA_CLIENT_SECRET` | Strava API app client secret |
| `STRAVA_REFRESH_TOKEN` | OAuth2 refresh token (obtenu via `scripts/strava_oauth_init.py`) |

## Withings (pipeline `pipelines/withings_sync.py`)

Setup : voir [withings-setup.md](withings-setup.md).

| Secret | Usage |
|---|---|
| `WITHINGS_CLIENT_ID` | Withings API app client ID |
| `WITHINGS_CLIENT_SECRET` | Withings API app consumer secret |
| `WITHINGS_REFRESH_TOKEN` | OAuth2 refresh token (via `scripts/withings_oauth_init.py`). **Usage unique** : le premier run le consomme, ensuite la source de vérité est `user_profile.withings_refresh_token` — il est normal qu'il devienne périmé (ADR-49) |

## Last.fm (pipeline `pipelines/lastfm_sync.py`)

Setup : voir [lastfm-setup.md](lastfm-setup.md).

| Secret | Usage |
|---|---|
| `LASTFM_API_KEY` | Last.fm API key (https://www.last.fm/api/account/create) |
| `LASTFM_USERNAME` | Last.fm username |

## Steam (pipeline `pipelines/steam_sync.py`)

Setup : voir [steam-setup.md](steam-setup.md).

| Secret | Usage |
|---|---|
| `STEAM_API_KEY` | Steam Web API key (https://steamcommunity.com/dev/apikey) |
| `STEAM_ID` | Steam ID 64-bit (17 chiffres) |

## TMDB (pipeline `pipelines/tmdb_tracker_sync.py`)

Clé gratuite à demander sur https://developer.themoviedb.org/ (compte + formulaire, validation immédiate pour un usage perso).

| Secret | Usage |
|---|---|
| `TMDB_API_KEY` | TMDB REST v3 — `pipelines/tmdb_tracker_sync.py` (sync quotidien des films et séries de la médiathèque) et `pipelines/tmdb_sync.py` (calendrier de l'onglet Veille, dormant) |

⚠️ **Doublon assumé côté front** : la recherche de la médiathèque interroge TMDB depuis le navigateur et ne peut pas lire un secret GitHub. La même clé est donc **aussi** stockée dans `user_profile.tmdb_api_key`, lue via `window.PROFILE_DATA._values` — même pattern que `lastfm_api_key`. Elle est masquée de l'éditeur de profil via `window.PROFILE_HIDDEN_KEYS` ([cockpit/data-profile.js](../cockpit/data-profile.js)). **Rotation : penser aux deux endroits.**

Sans le secret, `tmdb_tracker_sync.py` sort en `[skip]` avec le code 0 — le workflow reste vert. Sans la clé en base, la recherche n'interroge qu'AniList et le signale en pied de liste.

## Twitch / IGDB (pipeline `pipelines/igdb_tracker_sync.py`)

IGDB v4 s'authentifie via OAuth `client_credentials` Twitch (IGDB appartient à Twitch/Amazon). Créer une application sur https://dev.twitch.tv/console/apps (compte Twitch requis) pour obtenir le couple client ID / client secret.

| Secret | Usage |
|---|---|
| `TWITCH_CLIENT_ID` | Twitch Developer Console — `pipelines/igdb_tracker_sync.py` (OAuth `client_credentials` vers IGDB v4) |
| `TWITCH_CLIENT_SECRET` | Twitch Developer Console — idem |

**Posés le 2026-08-13 (12:35 UTC)** : les deux secrets ont été ajoutés à GitHub Actions et le pipeline a tourné en écriture pour de bon — au 2026-08-13, la base porte 451 titres, dont 86 rattachés à un jeu Steam, et 24 licences surveillées. Sans ces secrets, `igdb_tracker_sync.py` sort en `[skip]` avec le code 0 dès la première ligne (avant tout appel réseau) : le workflow reste vert, zéro écriture, comportement nominal documenté dans `docs/architecture/pipelines.yaml::igdb_tracker_sync.health`.

**Deux endroits distincts depuis le lot 2 (2026-08-13)** : ces mêmes deux secrets vivent désormais à la fois dans GitHub Actions (pipeline `igdb_tracker_sync.py`, ci-dessus) **et** dans les secrets Supabase du projet (`mrmgptqpflzyavdfqwwv`), posés via `supabase secrets set` pour l'Edge Function `igdb-proxy` (recherche IGDB depuis le front — voir section dédiée ci-dessous). Une Edge Function ne lit pas les secrets GitHub Actions : la rotation de `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` doit donc se faire **aux deux endroits**, sous peine de casser silencieusement l'un des deux consommateurs.

### Edge Function `igdb-proxy`

Proxy IGDB pour l'onglet Gaming ([supabase/functions/igdb-proxy/index.ts](../supabase/functions/igdb-proxy/index.ts)) : IGDB refuse les requêtes navigateur (CORS) et exige un client secret, le front ne peut donc pas l'appeler directement. Deux modes : `?q=<texte>` (recherche, ajout d'un jeu console) et `?collection=<id>` (les titres pas encore sortis d'une licence, pour le rattrapage immédiat du rail « À venir » — ADR-36).

- Secrets lus via `Deno.env.get("TWITCH_CLIENT_ID")` / `Deno.env.get("TWITCH_CLIENT_SECRET")` — jamais en dur dans le source (ce dépôt est public).
- `verify_jwt: true` au déploiement — obligatoire, voir la leçon `jsearch-proxy` ci-dessous. ⚠️ **`verify_jwt` ne suffit pas** : il garantit que la *signature* du jeton a été validée par la passerelle, pas que l'appelant est un utilisateur connecté. La publishable key du projet — publique, en dur dans [cockpit/lib/supabase.js](../cockpit/lib/supabase.js), dans un dépôt public — passe ce filtre. Vérifié en live le 2026-08-14 : elle seule suffisait à obtenir une réponse complète. La fonction contrôle donc elle-même le rôle porté par le jeton (`isAuthenticatedUser()`, refus en 403 si ≠ `authenticated`). Décoder la charge utile sans revalider la signature est sûr **à cet endroit précis** parce que la passerelle l'a déjà fait en amont — un jeton forgé prétendant `role: authenticated` est rejeté en 401 avant d'atteindre le code (vérifié). **Toute future Edge Function doit reprendre ce contrôle** : `verify_jwt` seul laisse la porte ouverte à quiconque lit le dépôt.
- CORS borné à `https://ph3nixx.github.io` (pas `*`).
- Token applicatif Twitch (`client_credentials`) mis en cache en mémoire (~60 j) pour ne pas brûler de quota à chaque requête.
- **Lecture seule** : la fonction n'écrit rien en base et n'utilise aucune clé Supabase. Les insertions déclenchées par le mode `?collection=` sont faites par le front avec le JWT de l'utilisateur, donc soumises à la RLS — la fonction ne détient pas de pouvoir d'écriture à détourner.

## Once Upon a Nerd (pipeline `pipelines/creator_sync.py`)

Clé d'API Buffer de la chaîne Once Upon a Nerd (https://publish.buffer.com/settings/api). La même clé sert au dépôt privé `youtuber`, qui programme les posts : elle vit aussi dans `~/.config/onceuponanerd/secrets.json` sur le PC.

| Secret | Usage |
|---|---|
| `BUFFER_API_KEY` | Buffer GraphQL API — `pipelines/creator_sync.py` lit les posts et leurs métriques (ADR-54) |

⚠️ **La clé a aussi le droit d'écrire** : l'API Buffer n'a pas de clé en lecture seule, celle-ci peut créer et supprimer des posts. Le pipeline n'appelle que des requêtes de lecture (`posts`, `channels`, `account`). Régénérer une clé dans Buffer invalide l'ancienne : mettre à jour **les deux endroits** (secret GitHub et fichier du PC), sinon la publication ou la collecte casse en silence.

## Jobs Radar — routine Claude Code distante (aucun secret GitHub)

La routine Jobs Radar ([cowork-routines/jobs-radar.md](cowork-routines/jobs-radar.md), ADR-19) **ne consomme aucun secret GitHub Actions** — elle tourne en remote sur claude.ai, pas dans un workflow.

- **Clé RapidAPI (JSearch)** : portée **en clair dans le prompt de la routine** (config claude.ai privée), jamais dans `secrets`. Un agent distant ne peut pas lire les secrets GitHub. ⚠️ Si cette clé fuite (transcript, partage), la régénérer sur RapidAPI et mettre à jour le prompt de la routine.
- **Supabase** : accès via le **connecteur MCP Supabase** (auth propre), pas via `SUPABASE_SERVICE_KEY` en env.
- **LLM** : pas d'`ANTHROPIC_API_KEY` — la routine est couverte par le plan Max.

> Ne pas ajouter de secret `RAPIDAPI_KEY` aux GitHub Actions : aucun workflow ne l'utilise (le plan GH Actions + Gemini a été abandonné, cf. ADR-19).

### Edge Function `jsearch-proxy` — supprimée le 2026-08-13

Une Edge Function Supabase `jsearch-proxy` (déployée le 2026-05-28, vestige de la migration JSearch) portait une **seconde copie de la clé RapidAPI en clair dans son source**, en contradiction avec la règle ci-dessus, et tournait en `verify_jwt: false` — donc appelable sans authentification par quiconque devinait son slug, l'URL de base du projet étant publique ([cockpit/lib/supabase.js](../cockpit/lib/supabase.js)). Chaque appel aurait puisé dans le quota de **200 requêtes/mois** qui a déjà mis le radar en panne deux fois (juin 2026, puis 10-27 juillet 2026).

Aucun appelant : rien dans le repo, zéro `functions/v1` côté front, 0 invocation sur 24 h — la routine interroge JSearch en `curl` direct. Fonction supprimée plutôt que verrouillée, la clé RapidAPI ne devant vivre qu'à **un** endroit.

**Leçon** : une clé peut avoir des copies hors du repo. `git grep` ne les voit pas — vérifier aussi les Edge Functions (`supabase functions list`) et les prompts de routines distantes.

Si un proxy redevient nécessaire (IGDB l'exige, cf. [spec tracker jeux](superpowers/specs/2026-08-12-gaming-tracker-igdb-design.md)) : secret via `Deno.env.get()`, jamais en dur, et `verify_jwt: true`.

## Règle de maintenance

Tout nouveau secret ajouté à GitHub Actions doit :

1. Apparaître dans ce fichier sous la section correspondante (existante ou nouvelle)
2. Avoir une entrée dans [architecture/decisions.md](architecture/decisions.md) si son introduction implique une décision structurante (nouveau pipeline, nouveau service)
3. Être consommé dans le workflow correspondant uniquement via `secrets.NOM_DU_SECRET` (jamais en dur)
