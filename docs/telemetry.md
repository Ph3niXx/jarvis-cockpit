# Télémétrie cockpit

Table Supabase `usage_events` — append-only (RLS bloque UPDATE/DELETE).

Le front envoie les events via `track(eventType, payload)` (cf. [`cockpit/lib/telemetry.js`](../cockpit/lib/telemetry.js)) qui réutilise `postJSON()`. Best-effort : un échec de télémétrie ne casse jamais le cockpit.

Migration : [`jarvis/migrations/005_usage_events.sql`](../jarvis/migrations/005_usage_events.sql).

## Events instrumentés

> **`surface`** — tous les events émis par `panel-mediatheque.jsx` (`mediatheque_*` et
> `jp_*`, ci-dessous) portent depuis le 2026-07-27 un champ `surface` valant `"pwa"`
> (application installée sur l'écran d'accueil, détectée par `display-mode: standalone`)
> ou `"cockpit"` (onglet du cockpit) — via le wrapper `mdtTrack()` que tout appel de ce
> panel doit utiliser, pour qu'aucun nouvel event n'échappe à la règle. C'est la sonde de
> survie de la page d'entrée mobile : trois semaines sans `mediatheque_progress` en
> `surface:"pwa"` signifie que le portage n'a pas trouvé son usage — voir
> `docs/superpowers/specs/2026-07-27-mediatheque-pwa-ios-design.md`.

> **`viewport`** — depuis le 2026-08-21, **tous** les events portent un champ `viewport`
> valant `"mobile"` (largeur ≤ 760 px) ou `"desktop"`, estampillé dans `track()`
> (`cockpit/lib/telemetry.js`) et nulle part ailleurs : un point d'instrumentation unique
> interdit qu'un event futur y échappe. Un appelant qui fournit explicitement `viewport`
> garde sa valeur. C'est la mesure d'usage du portage iPhone — elle dit quels onglets sont
> ouverts depuis le téléphone, et le critère d'arrêt du programme s'y adosse (voir
> `docs/superpowers/specs/2026-08-21-cockpit-mobile-design.md`). Comme pour `surface`
> ci-dessus, ce champ n'est **volontairement pas répété** dans la colonne payload de
> chaque ligne du tableau ci-dessous : `viewport` s'ajoute au payload documenté de
> **chaque** event, sans exception, même là où la ligne ne le montre pas — sinon ce
> tableau se lirait à l'envers dès la prochaine ligne éditée.
>
> **Limite connue, à ne pas oublier en la lisant :** `usage_events` n'accepte les `INSERT`
> que du rôle `authenticated`. Un démarrage qui meurt avant l'authentification n'écrit
> rien. `viewport` ne verra donc jamais une panne de démarrage — « pas utilisé » et
> « cassé » restent indiscernables dans cette table. C'est le délai de garde du loader
> (`cockpit/lib/bootstrap.js`) qui couvre cette classe de panne, pas la télémétrie.

| event_type | payload | Point d'instrumentation |
|---|---|---|
| `section_opened` | `{section, entry}` | Effet sur `[activePanel]` dans `cockpit/app.jsx` + `cockpit/lib/boot-mediatheque.js` |
| `search_performed` | `{query_length, results_count}` | `cockpit/panel-search.jsx` après fetch |
| `link_clicked` | `{url, section}` | Event delegation globale `a[target="_blank"]` dans `app.jsx` |
| `pipeline_triggered` | `{pipeline, mode}` | `cockpit/panel-jarvis.jsx` avant `jarvisSend()` |
| `error_shown` | `{context, message}` | Wrapper `showError()` dans `cockpit/lib/` |
| `profile_field_saved` | `{key}` | `cockpit/panel-profile.jsx` après PATCH + `cockpit/panel-jobs-radar.jsx::JrCalibrage` (édition de job_pref_rules) |
| `profile_payload_copied` | `{size}` | `cockpit/panel-profile.jsx` export |
| `skill_radar_bumped` | `{axis, delta}` | `cockpit/panel-radar.jsx` après bump manuel |
| `challenge_completed` | `{challenge_id, mode}` | `cockpit/panel-challenges.jsx` post-submit |
| `idea_moved` | `{id, from_status, to_status}` | `cockpit/panel-ideas.jsx` drag&drop |
| `wiki_shared` | `{slug}` | `cockpit/panel-wiki.jsx` partage |
| `jobs_action` | `{action, job_id, value}` | `cockpit/panel-jobs-radar.jsx` — statut (snooze/archive/apply) + notes + clôture manuelle (`action:"close"`/`"reopen"`, écrit `closed_at`). Depuis le 2026-08-17 (ADR-39) : `action:"followup"` — relance envoyée, `value` = rang de la relance (1 = première), écrit `last_followup_at` + `followup_count` ; et `action:"skill_gap_filter"` — un axe du bloc « Ce que le marché te reproche » a été cliqué, `value` = l'axe, `job_id` vide. **Sonde de valeur du lot** : si `followup` reste à zéro alors que 30 candidatures sont en souffrance, le bouton ne suffisait pas et le problème est ailleurs. **Depuis le 2026-09-24 (ADR-52) — lire ≠ postuler** : `action:"open"` = annonce ouverte, `value` = zone (`decide` / `list`), sans écriture en base ; `action:"status"` + `value:"applied"` = candidature **envoyée** (avant cette date, ce couple voulait dire « annonce ouverte » : Postuler était le seul moyen de la lire) ; `action:"close"` + `value:"dead_link"` = lien mort signalé depuis « Pas pour moi » ; `action:"undo"`, `value` = geste annulé (`applied` / `not_for_me` / `dead_link`). Ces events partent **après** confirmation de l'écriture. Zone « Tes candidatures » : `action:"open"` avec `value:"applications"` ; `action:"status"` + `value` ∈ `interview` / `rejected` / `ghosted` = issue posée, `value:"applied"` depuis une issue = issue retirée ; `action:"not_applied"` = une candidature corrigée en « pas candidaté » ; `action:"undo"` peut aussi valoir `outcome` / `not_applied`. |
| `jobs_feedback` | `{verdict, reason, job_id, score_at_vote}` | `cockpit/panel-jobs-radar.jsx::notForMe()` — décision « Pas pour moi » : `verdict:"down"`, `reason` = raison sérialisée (`pas crédible` / `trop junior` / `boîte ou secteur`, suivie de ` — précision libre`). **Un event par décision depuis le 2026-09-24 (ADR-52)** ; avant, `voteJob()` en émettait un par case cochée et portait aussi des `up`. `score_at_vote` mesure le désaccord avec le score (doit décroître). **Sonde de valeur, à lire le 2026-10-22** : part des hot leads entrés dans la fenêtre de 7 jours qui reçoivent une décision (postulé, pas pour moi, snooze, lien mort, clôturée) avant d'en sortir ; point de départ ≈ un tiers d'ouverture, aucune décision visible après lecture depuis juin. |
| `history_pin_toggled` | `{iso, pinned}` | `cockpit/panel-history.jsx::handleTogglePin()` |
| `review_action` | `{action, id}` | `cockpit/panel-review.jsx::markReadAndAdvance()` |
| `hero_delta_shown` | `{newSinceVisit, hours}` | `cockpit/home.jsx` useEffect quand le hero bascule en mode "nouveautés depuis Xh" |
| `recent_filter_auto_on` | `{reason}` | `cockpit/app.jsx` useState init du toggle "Récent · 24h" quand l'auto-on kick in (visite récurrente 30min-18h) |
| `zero_state_shown` | `{ideas_count}` | `cockpit/home.jsx` useEffect quand le hero bascule en mode "Tu as fait le tour. Bravo." (tout lu/snoozé + unread global = 0) |
| `top_card_collapsed` | `{rank}` | `cockpit/home.jsx` `toggleRead()` quand une card du Top du jour passe en `is-read` (collapsed à 56px) |
| `hero_compact_toggled` | `{state}` (`"compact"` / `"full"`) | `cockpit/home.jsx::toggleHeroCompact()` quand l'utilisateur clique le toggle compact/plein du hero (préférence persistée dans `localStorage.cockpit-hero-compact`) |
| `mediatheque_search` | `{q_len, results, sources}` | `cockpit/panel-mediatheque.jsx` après réponse des deux sources en parallèle (debounce 400 ms). `sources` = nombre de sources ayant répondu avec au moins un résultat (0, 1 ou 2) — permet de repérer une source durablement muette |
| `mediatheque_add` | `{franchise_root_id, entries, source}` | `cockpit/panel-mediatheque.jsx::addFranchise()` après persistance. `source` = `anilist` / `tmdb_tv` / `tmdb_movie` |
| `mediatheque_progress` | `{entry_kind, delta, completed}` | `cockpit/panel-mediatheque.jsx::writeProgress()` après upsert réussi |
| `mediatheque_remove` | `{franchise_root_id}` | `cockpit/panel-mediatheque.jsx::removeFranchise()` après DELETE |
| `mediatheque_release_ack` | `{event_type}` | `cockpit/panel-mediatheque.jsx::ackRelease()` après PATCH |
| `mediatheque_shelve` | `{shelved, franchise_root_id}` | `cockpit/panel-mediatheque.jsx::toggleShelved()` après PATCH réussi |
| `mediatheque_rate` | `{entry_kind, rating, cleared}` | `cockpit/panel-mediatheque.jsx::writeRating()` après upsert réussi |
| `mediatheque_hero_action` | `{action, status}` | `cockpit/panel-mediatheque.jsx::MdtHero` clic CTA primaire (`action:"resume"/"start"/"open"`) |
| `mediatheque_week_click` | `{days_ahead, entry_kind}` | `cockpit/panel-mediatheque.jsx::MdtWeek` clic sur une diffusion de l'agenda « Cette semaine » ou de sa ligne « plus tard » (`days_ahead` = 0 pour aujourd'hui, `null` pour une entrée sans date) |
| `mediatheque_collection_toggle` | `{open, count}` | `cockpit/panel-mediatheque.jsx::MdtCollection` pli/dépli manuel de la section « Ma collection » |
| `mediatheque_filter_local` | `{q_len, matches}` | `cockpit/panel-mediatheque.jsx::PanelMediatheque` requête locale stabilisée (debounce 400 ms), avant tout appel AniList |
| `mediatheque_tonight_budget` | `{budget_min, candidates}` | `cockpit/panel-mediatheque.jsx::pickBudget()` au tap sur une pastille de temps dispo (`budget_min` = `30`, `60` ou `null` pour « 2 h+ ») |
| `mediatheque_tonight_pick` | `{role, media_type, runtime_minutes, budget_min}` | `cockpit/panel-mediatheque.jsx::MdtTonight` clic sur le CTA d'une proposition (`role` = `fresh` / `resume` / `discover`) |
| `mediatheque_tonight_empty` | `{budget_min, hour}` | `cockpit/panel-mediatheque.jsx::PanelMediatheque` rendu d'une bande « Ce soir » sans aucune proposition — signal produit : budget trop serré ou bibliothèque à jour |
| `mediatheque_section` | `{section, count}` | `cockpit/panel-mediatheque.jsx::pickSection()` changement d'onglet de section (`anime` / `tv` / `movie` / `manga` depuis ADR-43, valeur admise sans changement de schéma). `count` = nombre de franchises non mises de côté de la section ouverte, pour distinguer « je visite un rayon plein » de « je regarde un rayon vide ». **Sonde d'adoption** : ce sont les séries et les films qui étaient invisibles derrière un chip décoché — un volume durablement nul sur `section:"tv"` dirait que le problème n'était pas la visibilité. **Sonde de survie de la section Manga** (ADR-43) : aucun `mediatheque_progress` sur une entrée `kind:'manga'` pendant six semaines alors que la section a été ouverte = déclarer sa progression de lecture n'est pas un geste que l'utilisateur fait, et la section se retire |
| ~~`mediatheque_type_filter`~~ | `{types, count}` | **Retiré le 2026-08-20** — les chips de type multi-sélection ont été remplacés par les onglets de section ci-dessus. Les événements historiques restent en base ; ne pas réutiliser ce nom |
| `veille_feedback` | `{verdict, reason}` | `cockpit/home.jsx::sendVote()` après upsert réussi dans `article_feedback` — vote 👍/👎 sur la sélection du jour. `reason` n'est renseigné que sur un 👎 (`seen` / `off_topic` / `shallow` / `not_actionable`). Pendant exact de `jobs_feedback`. **À suivre comme signal de reprise** : `link_clicked` est à 24 événements au total depuis avril, la sélection n'aura servi à rien si ce compteur reste plat |
| `jp_band_shown` | `{words, evening}` | `cockpit/panel-mediatheque.jsx` useEffect, **une fois par montage**, quand la bande « Avant l'épisode » s'affiche avec au moins un mot non connu. C'est le **dénominateur** de la sonde ci-dessous : sans lui, « 0 marquage » ne distingue pas « jamais affiché » de « affiché et ignoré » |
| `jp_word_marked` | `{status, first_time}` | `cockpit/panel-mediatheque.jsx::markWord()` après upsert réussi dans `jp_seen` — bande « Avant l'épisode ». `first_time` distingue un premier marquage d'un changement d'avis. **Sonde de survie** : à lire comme un ratio sur `jp_band_shown`. Si la bande est affichée régulièrement et que le marquage reste à zéro pendant trois semaines, elle ne sert pas et doit être retirée plutôt que maintenue par principe |
| `games_brief_shown` | `{count}` | `cockpit/home.jsx::GamesBriefCard` useEffect quand l'encart Jeux du Brief est rendu avec au moins un événement `game_releases` non acquitté |
| `games_release_ack` | `{event_type, surface}` | `cockpit/home.jsx::GamesBriefCard::ack()` **ou** `cockpit/panel-gaming.jsx::PanelGaming::ackRelease()`, après PATCH réussi sur `game_releases` (`acknowledged: true`) — l'utilisateur acquitte une annonce/date/sortie/annulation. `surface` vaut `brief` (encart Jeux du Brief) ou `gaming` (rail « À venir » de l'onglet Gaming) selon l'écran qui émet |
| `games_unwatch_franchise` | `{franchise, surface}` | `cockpit/home.jsx::GamesBriefCard::unwatch()` **ou** `cockpit/panel-gaming.jsx::PanelGaming::unwatchFranchise()`, après PATCH réussi sur `game_franchises` (`watched: false`) + acquittement des événements — l'utilisateur cesse de suivre la licence. `surface` vaut `brief` ou `gaming` selon l'écran. **Ex-sonde de survie du lot 1, devenue caduque** : elle devait conditionner le lancement du lot 2 (trois semaines sans un seul `games_release_ack` ni `games_unwatch_franchise` après le premier événement détecté ⇒ pas de lot 2, encart retiré), mais le lot 2 a été lancé le 2026-08-13 sans attendre ce verdict, sur décision explicite de l'utilisateur (ADR-35, `docs/architecture/decisions.md`). Ces deux compteurs restent une mesure réelle de l'usage de l'encart du Brief, mais ne gouvernent plus rien — c'est `games_status_set` (ci-dessous) qui porte désormais la sonde de survie, sur l'onglet Gaming refondu |
| `games_library_shown` | `{count}` | `cockpit/panel-gaming.jsx::PanelGaming` useEffect à dépendances vides, **une fois par montage du panel**, avec le nombre de jeux de la bibliothèque. C'est le **dénominateur** de la sonde ci-dessous : sans lui, « 0 statut posé » ne distingue pas « il ouvre l'onglet et n'écrit rien » de « il n'ouvre jamais l'onglet ». Même rôle que `jp_band_shown` pour la bande de vocabulaire japonais. **Compte des montages, pas des visites** : Gaming est un panel Tier 2, et un retour sur l'onglet dans une session déjà chargée le monte une première fois avec les données en mémoire, puis le remonte quand `loadPanel("gaming")` a résolu (`app.jsx` incrémente `dataVersion`, `panelKey` change) — soit deux événements pour une visite. À lire comme un ordre de grandeur (l'onglet est-il ouvert, oui ou non), jamais comme un compteur exact de visites |
| `games_status_set` | `{status}` | `cockpit/panel-gaming.jsx::PanelGaming::writeProgress()`, après écriture réussie (PATCH ou POST) sur `game_progress` — l'utilisateur pose ou change le statut d'un jeu depuis la fiche (`GmSheet`). **Sonde de survie du lot 2**, à lire comme un **ratio sur `games_library_shown`** et jamais en valeur absolue : la fiche jeu est le seul endroit du lot où l'utilisateur écrit, donc zéro écriture est le signal — mais un zéro sans dénominateur n'est pas interprétable. Verdict : si `games_library_shown` monte régulièrement (l'onglet est ouvert) et que `games_status_set` reste à zéro pendant trois semaines, une fois la phase de qualification initiale de la bibliothèque passée, la bibliothèque n'a pas trouvé son usage et doit être retirée plutôt que maintenue par principe. Si `games_library_shown` est lui aussi à zéro, ce n'est pas la bibliothèque qui a échoué mais l'onglet qui n'est pas vu — un problème d'exposition, pas de fonctionnalité (ADR-35) |
| `games_rate` | `{}` | `cockpit/panel-gaming.jsx::PanelGaming::writeProgress()`, après écriture réussie sur `game_progress` — l'utilisateur note un jeu (0–100) depuis la fiche, ou efface sa note |
| `games_watch_toggle` | `{watched}` | `cockpit/panel-gaming.jsx::PanelGaming::toggleWatch()`, après PATCH réussi sur `game_franchises` — l'utilisateur active ou coupe le suivi d'une licence depuis la fiche jeu |
| `games_search` | `{}` | `cockpit/panel-gaming.jsx::GmAddGame::run()`, après réponse réussie de l'Edge Function `igdb-proxy` (`gmSearchIgdb()`) — recherche IGDB pour ajouter un jeu console (PS/Xbox/Switch) à la bibliothèque, seul Steam étant tracké automatiquement |
| `games_add` | `{igdb_id}` | `cockpit/panel-gaming.jsx::PanelGaming::addConsoleGame()`, après écriture réussie de `game_titles` + `game_progress` (`status: "wishlist"`), et de `game_franchises` si la collection IGDB était encore inconnue — l'utilisateur ajoute un jeu console trouvé via `GmAddGame`. `bootstrapped_at` n'est jamais posé par cette écriture, seule la phase B du pipeline IGDB en a le droit |
| `games_upcoming_synced` | `{found}` | `cockpit/panel-gaming.jsx::PanelGaming::syncFranchiseUpcoming()`, après insertion réussie d'au moins un événement dans `game_releases` — le front a rattrapé les sorties à venir d'une licence tout juste suivie (ajout d'un jeu console, ou case « m'avertir » cochée) sans attendre le cron de 08:30 UTC (ADR-36). `found` = nombre d'événements **réellement créés** (l'upsert tourne en `ignore-duplicates`, un événement déjà connu ne compte pas). Émis uniquement quand quelque chose a été trouvé : un `0` n'est pas tracé, la licence sans suite annoncée étant le cas nominal. À lire comme la mesure de valeur du rattrapage — s'il ne se déclenche jamais, c'est que les licences suivies sont déjà parcourues par le pipeline au moment où l'utilisateur les suit, et le chemin front peut être retiré |
| `veille_outils_status_changed` | `{id, to}` | `cockpit/panel-veille-outils.jsx::patchItem()` — transition de statut sur un item de veille hebdo (`claude_veille`) |
| `veille_outils_notes_saved` | `{id}` | `cockpit/panel-veille-outils.jsx::patchItem()` — note perso sauvée au blur sur un item de veille hebdo |
| `ecosystem_pin_toggled` · `ecosystem_status_changed` · `ecosystem_priority_set` · `ecosystem_notes_saved` · `ecosystem_patched` | `{id}` | `cockpit/panel-veille-outils.jsx::patchEcoItem()` — l'event émis dépend de la clé patchée sur `claude_ecosystem` ; `ecosystem_patched` est le fallback quand aucune clé connue n'est reconnue |
| `ecosystem_added_manual` | `{slug}` | `cockpit/panel-veille-outils.jsx::addEcoManual()` — ajout manuel d'une intégration au catalogue, après POST réussi |
| `panorama_pin_toggled` · `panorama_status_changed` · `panorama_priority_set` · `panorama_notes_saved` · `panorama_patched` | `{id}` | `cockpit/panel-veille-outils.jsx::patchPanoItem()` — sous-onglet Panorama (`ai_landscape`, ADR-51), même schéma de dispatch que `patchEcoItem`. **Sonde de valeur du sous-onglet** : si `panorama_pin_toggled` et `panorama_status_changed` restent à zéro sur plusieurs semaines alors que `section_opened` sur `veille-outils` ne l'est pas, le Panorama est lu mais jamais trié — le tri par prix/terrain suffit et le workflow épinglage/écartement est du poids mort |

## Lire `section_opened` : un biais à connaître

Jusqu'au 2026-08-17, `section_opened` n'était émis que depuis `handleNavigate()`,
c'est-à-dire **uniquement sur un clic explicite** (sidebar, CTA, palette). Deux
surfaces majeures n'émettaient donc rien :

- **L'écran d'atterrissage.** Le panel initial est posé par un `useState` qui ne
  passe pas par `handleNavigate`. Comme cet écran est le Brief, le Brief
  paraissait mort alors qu'il est vu à chaque ouverture du cockpit. Ordre de
  grandeur mesuré sur août 2026 : **2** clics « brief » enregistrés contre **30**
  `recent_filter_auto_on`, qui ne peut se déclencher qu'une fois par chargement
  et seulement après un rendu de `Home`.
- **La PWA Médiathèque.** `boot-mediatheque.js` monte le panel directement ;
  aucune ouverture depuis `mediatheque.html` n'était comptée.

Le champ **`entry`** distingue désormais les régimes : `landing` (écran
d'atterrissage), `nav` (clic), `pwa` (ouverture de la PWA), `pwa-resume`
(retour au premier plan après plus de 5 min).

**Conséquence pour toute analyse d'usage :** les lignes **antérieures au
2026-08-17 n'ont pas de champ `entry`** et sous-comptent massivement le Brief et
la Médiathèque. Ne jamais conclure à la mort d'un onglet à partir de ces
lignes-là sans vérifier s'il peut être un écran d'atterrissage. Pour la période
antérieure, croiser avec un event émis au rendu (`recent_filter_auto_on`,
`zero_state_shown`, `hero_delta_shown`, `mediatheque_progress`).

## Règle de maintenance

Ajouter un nouvel `event_type` nécessite **dans le même commit** :

1. Une entrée dans le tableau ci-dessus (payload + point d'instrumentation)
2. L'appel `track('nouveau_type', payload)` dans le composant source
3. Pas de modification du schéma SQL : `usage_events` est append-only avec `payload JSONB` libre

Pas besoin de migration Supabase pour un nouveau type — le schéma `JSONB` est ouvert par design.
