# Jobs Radar

> Feed d'offres scorées par fit (0-10) via un scan automatisé 3×/semaine (routine Claude Code distante sur API jobs structurée), réparti en trois zones — « À décider » (hot leads des 7 derniers jours pas encore triés), « Tes candidatures » (suivi et issues) et le reste du scan en liste dense filtrable —, avec un tri en un geste (lire / j'ai postulé / pas pour moi) persisté en DB et un rafraîchissement temps réel via Supabase channels.

## Scope
pro

## Finalité fonctionnelle
Panel de **tri d'offres d'emploi** — une **routine Claude Code distante** (claude.ai, 3×/semaine) interroge une **API jobs structurée (JSearch)**, score 15-40 offres pertinentes avec une rubric `seniority + sector + impact + bonus` (0-10) puis un **calibrage chiffré** (ADR-33/ADR-50), extrait les **skills attendus** de chaque annonce (scindés « tu as déjà » / « à acquérir » via match au profil) et estime le **salaire** (`intel.salary_estimate`). Les résultats atterrissent dans la table `jobs` + un récap par run dans `job_scans`. Le panel hydrate depuis ces deux tables, affiche en tête les offres ≥7 **à décider** (entrées depuis moins de 7 jours, pas encore triées), puis la zone **« Tes candidatures »** (suivi, issues entretien / refus / sans réponse), puis le reste en liste dense filtrable. L'utilisateur agit par **gestes de tri** — lire l'annonce, « J'ai postulé », « Pas pour moi » avec une raison, lien mort, snoozer, clôturer — et édite ses notes perso ; toutes les autres colonnes sont propriété de la routine. Depuis ADR-52, lire une annonce n'est plus postuler. Subscribe Supabase Realtime : un nouveau scan pendant que le panel est ouvert recharge le feed transparently. Seules les offres **temps plein** sont inscrites (filtre en amont) ; le flag **remote** et le **logo** de la boîte viennent de l'API, et les skills sont extraits en priorité de la section qualifications de l'annonce quand elle est structurée (ADR-20). (Intel warm et reco CV — abandonnés avec la migration vers l'API structurée, ADR-19.)

## Parcours utilisateur
1. Clic sidebar "Jobs Radar" (groupe Business) — le panel charge les offres et le scan de la semaine.
2. Lecture du header : eyebrow "Jobs Radar · date du jour" + stats inline ("N à décider · M candidatures en cours · T au total dans le radar") + titre descriptif.
3. Scan du banner en trois blocs : volumes sur 7 jours en barres Lun→Dim, répartition par catégorie de rôle (Produit / RTE / PgM / PjM / CoS / EM), actions du jour (relances + entretiens à préparer).
4. Lecture de la zone « À décider » : les offres notées 7+ entrées dans le radar depuis moins de 7 jours et pas encore triées, en grandes cartes avec logo de la boîte, score survolable, rubric par axe (Séniorité / Secteur / Impact), skills attendus scindés « tu as déjà » / « à acquérir », salaire estimé pour toi et badge « Remote » le cas échéant. Sans offre à trier, une ligne le dit.
5. Tri d'une carte en un geste — « Lire l'annonce » ouvre l'annonce sans rien enregistrer ; « J'ai postulé » enregistre la candidature ; « Pas pour moi » propose trois raisons en un clic (pas crédible pour moi, trop junior, boîte ou secteur) avec une précision libre facultative, ou « Lien mort / offre fermée ». La carte quitte la zone et un toast permet d'annuler pendant 5 secondes.
6. Dépliage de « Tes candidatures » — les candidatures envoyées avec leur ancienneté, entretiens d'abord ; « Entretien » / « Refus » / « Sans réponse » en un clic (re-cliquer retire l'issue) et un menu (Relancer, Lire l'annonce, Éditer les notes, Pas candidaté en fait). Les candidatures d'avant le 17 août, sans date connue, sont repliées dessous.
7. Utilisation des filtres : recherche texte + cinq groupes de filtres (score hot/mid/low / rôle / lieu / fraîcheur / statut) + tri (score ou récence). Rôle, lieu et recherche filtrent aussi la zone « À décider » ; statut et fraîcheur ne filtrent que la liste. Filtre statut "Actives" par défaut, qui masque les snoozées et archivées. La **fraîcheur** et le tri **récence** se mesurent sur la date d'entrée de l'offre dans le radar, pas la date de publication LinkedIn.
8. Liste dense en dessous : une ligne par offre avec score compact, titre / boîte, tags (catégorie / stage / statut, et la raison d'un « Pas pour moi »), pitch, rubric condensée, les mêmes gestes de tri en icônes et un menu kebab. Les candidatures n'y figurent plus.
9. Menu kebab par offre : "Snoozer 7 jours", "Éditer les notes" (zone de texte inline avec bouton Enregistrer), "Marquer clôturée".
10. Rafraîchissement temps réel : quand le scan automatisé pousse de nouvelles offres pendant que le panel est ouvert, le feed se met à jour automatiquement sans recharger la page.

## Fonctionnalités
- **Score sur 10 décomposé** : chaque offre reçoit un score synthèse, survolable pour voir le détail par axe (Séniorité / Secteur / Impact / Bonus).
- **Trois bandes de score** : Hot (≥ 7) / Moyen (5-7) / Faible (< 5) colorées différemment pour repérer les opportunités en un clin d'œil.
- **Zone « À décider »** : en tête de page, les offres notées 7+ entrées dans le radar depuis moins de 7 jours et pas encore triées, en grandes cartes avec logo de la boîte, rubric par axe, skills attendus, salaire estimé et badge « Remote ». Une offre non triée en sort d'elle-même au bout de 7 jours et rejoint la liste : pas de file qui grossit. Les filtres rôle, lieu et recherche s'y appliquent, et une ligne signale quand il n'y a rien à trier. Le compteur « à décider » de l'en-tête reste un total global.
- **Salaire estimé pour toi** : sur les hot leads enrichis, un encart dédié coloré affiche un target chiffré ("~132k€") dans la fourchette de l'offre. Le détail du calcul (fourchette publiée vs inférée du marché, raison du positionnement) est accessible en survolant un petit "i". L'encart se code visuellement « dans ta fourchette cible » (vert) ou « hors fourchette » (gris) selon la fourchette de salaire renseignée dans ton profil ; sans fourchette définie il s'affiche en orange brand neutre.
- **Skills attendus par offre** : extraits de l'annonce (en priorité depuis sa section qualifications quand elle est structurée) et scindés en deux colonnes — « tu as déjà » (présents sur ton profil) et « à acquérir » — pour situer l'écart de compétences d'un coup d'œil. Un discret « d'après l'annonce » indique quand les skills viennent de la section qualifications plutôt que d'une lecture du texte. Affiché sur les hot leads enrichis.
- **Badge & filtre Remote** : les offres en télétravail portent un badge « Remote » (carte et ligne) ; un filtre « lieu » dédié permet de n'afficher que celles-ci.
- **Scan banner** : trois blocs de synthèse en haut de page — volumes sur 7 jours en barres Lun→Dim, répartition par catégorie de rôle, actions du jour (relances des candidatures datées + entretiens à préparer).
- **Liste dense filtrable** : une ligne par offre avec recherche texte + cinq groupes de filtres (score / rôle / lieu / fraîcheur / statut) + tri (score ou récence). Filtre statut « Actives » par défaut qui masque les snoozées et archivées. Les candidatures n'y figurent plus : elles vivent dans « Tes candidatures ».
- **Barre de filtres collante** : les filtres restent accessibles en haut de page quand on fait défiler — un bandeau résume les filtres actifs sous forme d'étiquettes (retirables d'un clic) et se déplie pour tout régler (recherche, score, rôle, lieu, fraîcheur, statut, tri). Un filtre de **fraîcheur** permet de n'afficher que les offres **repérées** (entrées dans le radar, `first_seen_date`) il y a moins de 24 h ou moins d'une semaine — et non selon leur date de publication LinkedIn (`posted_date`), souvent antidatée et absente, qui rendait le filtre quasi vide. L'âge affiché se lit « Repérée il y a Xj » (+ « publiée il y a Yj » en secondaire quand l'annonce porte une date). Rôle, lieu et recherche pilotent à la fois la zone « À décider » et la liste ; statut et fraîcheur ne pilotent que la liste, et un filtre de score « moyen » ou « faible » masque la zone. Les filtres sont **mémorisés** d'une visite à l'autre (sauf la recherche texte, qui repart vide).
- **Tri en un geste** : chaque offre propose « Lire l'annonce » (ouvre l'annonce, n'enregistre rien), « J'ai postulé » (enregistre la candidature) et « Pas pour moi », plus un menu (Snoozer 7 jours / Éditer les notes / Marquer clôturée). Lire une annonce n'est plus postuler : le radar distingue enfin une offre lue d'une candidature envoyée.
- **Tes candidatures** : une section repliable (son état est mémorisé) liste les candidatures envoyées avec leur ancienneté — entretiens d'abord, puis en attente, puis refus et sans réponse — et permet de poser l'issue en un clic (Entretien / Refus / Sans réponse, re-cliquer pour la retirer), de relancer, de lire l'annonce ou de corriger une offre marquée par erreur (« Pas candidaté en fait »). Son en-tête compte les candidatures par issue ; celles d'avant le 17 août, sans date connue, sont repliées à part.
- **Gestes sauvegardés, annulables** : chaque geste est sauvegardé en base avec un toast de confirmation qui propose « Annuler » pendant 5 secondes ; si la sauvegarde échoue, le geste est annulé à l'écran et un toast d'erreur le signale. Les notes perso sont sauvegardées en base.
- **Archivage durable face aux republications LinkedIn** : quand LinkedIn republie une offre déjà archivée (même titre + même boîte) sous une nouvelle annonce, la décision d'archivage est conservée — l'offre ne réapparaît pas dans la liste le lendemain. Idem pour une offre snoozée tant que le snooze n'est pas expiré. Les notes perso de la version archivée sont aussi récupérées si la nouvelle annonce n'en a pas. Une candidature, quelle que soit son issue (entretien, refus, sans réponse), n'est jamais reproposée comme nouvelle.
- **« Pas pour moi » en un clic** : trois raisons à un clic — pas crédible pour moi (compétences, domaine), trop junior, boîte ou secteur — avec une précision libre facultative ; l'offre est écartée et sa raison nourrit le recalibrage du radar. « Lien mort / offre fermée » clôture l'offre sans compter comme un avis. Dans la liste, une offre écartée affiche sa raison en étiquette.
- **Rafraîchissement temps réel** : quand le scan automatisé pousse de nouvelles offres pendant que le panel est ouvert, le feed se met à jour automatiquement sans reload.
- **Message vide après filtres** : quand aucune offre ne correspond aux filtres, un message explicite suggère de relâcher un critère ou de revenir le lendemain matin.
- **Encart calibrage** : en haut du panel, un profil de préférences repliable — « Tes règles » (éditable, stocké dans `user_profile.job_pref_rules`, verrouillé côté scan) et « Observé par le radar » (lecture seule, `job_pref_observed` maintenu par la routine Jobs Radar). Permet de voir et corriger ce que le radar a compris des goûts de l'utilisateur.
- **Masquage des offres clôturées** : quand une offre passe en "ne recrute plus", tu la masques **à la main** via le menu kebab « Marquer clôturée » ou « Pas pour moi › Lien mort / offre fermée » (la détection automatique a été retirée avec le passage à l'API structurée), elle est retirée du feed actif et des hot leads. Un filtre « Clôturées » permet de les revoir et de **« Rouvrir »** une offre masquée à tort. Un compteur dans l'en-tête indique combien sont masquées. Une candidature reste visible dans « Tes candidatures », quelle que soit son issue.

## Front — structure UI
Fichier : [cockpit/panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) — 782 lignes, monté par [app.jsx:404](cockpit/app.jsx:404). CSS dédié : [cockpit/styles-jobs-radar.css](cockpit/styles-jobs-radar.css) — 1156 lignes, scope `jr-*`. Ressources incluses dans [index.html:32, 73, 98](index.html:32).

Structure DOM :
- `.panel.panel-jobs-radar`
  - `.jr-header` — kicker + stats + h1 (title-main + title-sub)
  - `<ScanBanner>` → `.jr-scan > .jr-scan-grid` 3 colonnes :
    - `.jr-scan-block` volumes 7j (7 `.jr-sparkbar`)
    - `.jr-scan-block` répartition catégories (6 `.jr-ratbar`)
    - `.jr-scan-block--actions` actions du jour (liste `.jr-action-item`)
  - `<JrFilterBar>` → `.jr-filterbar` (toolbar collant `position:sticky;top:0;z-index:30` rendu au-dessus de la zone « À décider ») : ligne repliée (badge `🔥 N à décider` global + `.jr-fb-chips` puces des filtres actifs `.jr-chip` retirables + compteur filtré + bouton « Filtres ») et panneau dépliable `.jr-filterbar-panel` (recherche + 6 `<FilterGroup>` score/rôle/lieu/fraîcheur/statut/tri + « Tout réinitialiser »)
  - `.jr-hot-section` — zone « À décider » (rendue si le filtre score autorise « hot ») → `.jr-hot-grid` avec `<HotLeadCard>` (pied : `<JrTriageActions>` + `<JrActionsMenu>` ; intègre `<JrSkills>` et `<SalaryEstimate>`) ou `.jr-decide-empty`
  - `<JrApplications>` → `.jr-apps` : en-tête repliable (compteurs par issue) + `.jr-apps-body` avec des `<JrApplicationRow>` (`.jr-app`, issues + `<JrAppMenu>`) et le groupe replié `.jr-apps-undated`
  - `.jr-list-section`
    - `.jr-section-head` → kicker + titre (les filtres ont migré dans `<JrFilterBar>`)
    - `.jr-list` OR `.jr-empty` avec liste de `<OfferRow>`
  - `<JrToast>` (conditionnel, action « Annuler » optionnelle)

Route id = `"jobs"`. **Panel Tier 2** ([data-loader.js:4528](cockpit/lib/data-loader.js:4528)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelJobsRadar({ data, onNavigate })` | Composant racine — state local `offers[]` mirror de `window.JOBS_DATA.offers`, prédicats `passesFacets` (rôle/lieu/recherche/écart — zone « À décider » + liste) et `passesFilters` (+ statut/fraîcheur — liste), 5 facettes + recherche, persistées dans `localStorage["jr.filters.v1"]` (hors recherche) | [panel-jobs-radar.jsx:498](cockpit/panel-jobs-radar.jsx:498) |
| `HotLeadCard({ offer, rank, ... })` | Card large : rubric + skills (`<JrSkills>`) + salaire + CTAs ; lit `window.PROFILE_DATA._values.target_salary_range` pour calibrer le badge in/out de l'estimation salaire | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `SalaryEstimate({ estimate, targetRange })` | Encart "Salaire estimé" — affiche `target` + `range` issus de `intel.salary_estimate`, badge "dans/hors fourchette cible" en parsant `targetRange` ("90-130k€"). 3 tones de couleur : `--in` (vert positif), `--out` (gris pâle), `--neutral` (orange brand-tint, par défaut sans fourchette user). Le `rationale` + label de source sont exposés via un bouton `(i)` au hover : tooltip CSS custom 300px qui affiche "SOURCE LABEL" + rationale sur fond `--tx` avec flèche pointant vers le bouton (même pattern que `.jr-score-tip`). | [panel-jobs-radar.jsx:184](cockpit/panel-jobs-radar.jsx:184) |
| `OfferRow({ offer, ... })` | Ligne dense pour mid/low — score + titre + rubric condensée | [panel-jobs-radar.jsx:340](cockpit/panel-jobs-radar.jsx:340) |
| `ScanBanner({ scan })` | 4 blocs header (volumes/ratios/CV/actions) | [panel-jobs-radar.jsx:416](cockpit/panel-jobs-radar.jsx:416) |
| `ScoreChip({ offer, big })` | SVG-less score "N,N/10" avec tooltip `.jr-score-tip` décomposition 4 axes | [panel-jobs-radar.jsx:152](cockpit/panel-jobs-radar.jsx:152) |
| `RubricBlock({ offer })` | Liste de lignes axis/text (Séniorité/Secteur/Impact + Bonus/Calibrage si présents) | [panel-jobs-radar.jsx:184](cockpit/panel-jobs-radar.jsx:184) |
| `JrSkills({ skills })` | Skills attendus scindés en deux colonnes « tu as déjà » (`on_cv`) / « à acquérir », depuis `intel.skills_required` | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `JrActionsMenu({ offer, open, onToggle, ... })` | Kebab popover (Snoozer/Éditer notes/Marquer clôturée/Rouvrir) | [panel-jobs-radar.jsx:82](cockpit/panel-jobs-radar.jsx:82) |
| `JrNotesEditor({ offer, onSave, onCancel })` | Textarea 3 lignes + boutons save/cancel | [panel-jobs-radar.jsx:130](cockpit/panel-jobs-radar.jsx:130) |
| `JrToast({ message, tone, action })` | Toast aria-live, 5 s avec « Annuler », 2,4 s sinon | [panel-jobs-radar.jsx:71](cockpit/panel-jobs-radar.jsx:71) |
| `FilterGroup({ value, onChange, options })` | Segmented buttons | [panel-jobs-radar.jsx:768](cockpit/panel-jobs-radar.jsx:768) |
| `JrFilterBar({ decideCount, filteredCount, activeChips, ... })` | Toolbar collant : badge « à décider » global + puces des filtres actifs (retirables) + compteur filtré + panneau dépliable des `<FilterGroup>` (score/rôle/lieu/fraîcheur/statut/tri) + « Tout réinitialiser » | [cockpit/panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `patchJobSupabase(id, patch)` | Whitelist stricte (statut, notes, verdict, clôture, dates de candidature et de relance) puis `PATCH /rest/v1/jobs?id=eq.X` | [panel-jobs-radar.jsx:15](cockpit/panel-jobs-radar.jsx:15) |
| `updateJob(id, patch, toastMsg)` | Optimistic mute state + mute global + track + PATCH + toast | [panel-jobs-radar.jsx:545](cockpit/panel-jobs-radar.jsx:545) |
| `runGesture(offer, patch, { label, gesture, emit })` / `undoGesture(...)` | Geste de tri : état optimiste → PATCH → event + toast « Annuler » ; échec → inverse local, aucun event (ADR-52) | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `readOffer(offer, zone)` / `markApplied` / `notForMe` / `deadLink` | Handlers de tri ; `readOffer` n'écrit rien en base | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `JrTriageActions({ offer, zone, compact, ... })` / `JrNotForMe` | Lire / J'ai postulé / Pas pour moi (variantes carte et ligne) ; popover précision libre + 3 raisons + lien mort | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `useJrDismiss(ref, open, close)` | Ferme un popover au clic extérieur ou sur Échap | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `snoozeJob` / `saveNotes` / `closeJob` / `reopenJob` / `followUpJob` | Handlers PATCH hors tri | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `window.jobsView` | Logique pure : zones, écritures des gestes et leurs inverses, raisons — testée par `tests/test_jobs_view.mjs` | [cockpit/lib/jobs-view.js](cockpit/lib/jobs-view.js) |
| `JrApplications({ offers, handlers })` / `JrApplicationRow` / `JrAppMenu` | Zone « Tes candidatures » : datées / non datées (`splitApplications`), issues à un clic, menu Relancer / Lire / Notes / Pas candidaté ; état plié mémorisé (`jr.apps.open.v1`) | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| `setOutcome(offer, outcome)` / `notApplied(offer)` | Issue de candidature (re-clic = retrait) et correction d'un faux « applied », via `runGesture` | [panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) |
| Effet realtime Supabase channel | Subscribe `jobs_radar_sub` sur `jobs` + `job_scans` puis invalide cache + reload sur event | [panel-jobs-radar.jsx:519-537](cockpit/panel-jobs-radar.jsx:519) |
| `scoreBand(s)`, `dayLabel(n)`, `numberFmt(n)` | Helpers | [panel-jobs-radar.jsx:54-68](cockpit/panel-jobs-radar.jsx:54) |
| `T2.jobs_all()` | `GET jobs?select=*&order=score_total.desc.nullslast&limit=300` | [data-loader.js:1330](cockpit/lib/data-loader.js:1330) |
| `T2.jobs_scan_today()` | `GET job_scans?scan_date=eq.{today}&select=*` — retourne la 1e ligne ou null | [data-loader.js:1337](cockpit/lib/data-loader.js:1337) |
| `T2.jobs_scans_7d()` | `GET job_scans?scan_date=gte.{today-7}&select=*&order=scan_date.desc&limit=14` | [data-loader.js:1344](cockpit/lib/data-loader.js:1344) |
| `transformJobRow(row)` | DB row → panel shape (intel + rubric normalisés) | [data-loader.js:1585](cockpit/lib/data-loader.js:1585) |
| `transformJobIntel(intel)` | Normalise `intel` → `{ salary_estimate, skills_required:[{name,on_cv}] }` ; valide bornes/currency/basis du salaire ; tolère des skills en strings nues | [data-loader.js](cockpit/lib/data-loader.js) |
| `transformJobRubric(rubric)` | Array ou objet → array `[{axis, text}]` | [data-loader.js:1545](cockpit/lib/data-loader.js:1545) |
| `transformJobScan(todayScan, last7Scans, allJobs)` | Banner shape (volumes Mon→Sun, ratios catégorie, actions auto si vides) | [data-loader.js](cockpit/lib/data-loader.js) |
| `loadPanel("jobs")` case | `Promise.all` des 3 fetchs + transform + mute `JOBS_DATA.offers/scan/_raw` | [data-loader.js:4500-4513](cockpit/lib/data-loader.js:4500) |
| `daysSinceDate(dateStr)` | Age en jours depuis une date ISO | [data-loader.js:1539](cockpit/lib/data-loader.js:1539) |

## Back — sources de données

| Table | Colonnes lues / écrites | Volumétrie |
|-------|--------------------------|------------|
| `jobs` | **Read** : `id, linkedin_job_id, first_seen_date, last_seen_date, title, company, url, posted_date, role_category (produit/rte/pgm/pjm/cos/em), company_stage (seed/A/B/C/scale/grand_groupe), pitch, compensation, is_remote (boolean — remote-friendly, NULL=inconnu, ADR-20), score_seniority, score_sector, score_impact, score_bonus, score_total, rubric_justif (jsonb), intel (jsonb — `salary_estimate { min, max, target, currency, basis: 'published'\|'inferred', rationale }` + `skills_required [{ name, on_cv }]` (extraits en priorité de `job_highlights`, ADR-20) + `skills_source` ('highlights'|'description') + `employer_logo` (url affichage) ; `cv_recommended`/`cv_reason` ne sont plus lus par le front ni écrits par la routine — ADR-19), intel_depth (none/light — plus de 'deep' depuis ADR-19), status (new/to_apply/applied/interview/rejected/ghosted/snoozed/archived — les trois issues de candidature ouvertes par sql/030), user_notes, created_at, updated_at, closed_at (timestamptz — posé par le front via « Marquer clôturée » (ADR-18) ; la routine ne le pose plus, détection auto retirée — ADR-19)`. **Write (front PATCH whitelist)** : `status`, `user_notes`, `user_verdict`, `user_verdict_reason`, `user_verdict_at`, `closed_at`. | **554 lignes** (4 status distincts, dont 399 archived). Triggers DB : `jobs_updated_at` sur UPDATE (bumpe `updated_at`), `jobs_inherit_user_status` sur INSERT (hérite du `status` d'une **décision utilisateur** — snooze ≤14j, verdict 👎, `archived` à score ≥ 5 ≤90j, `applied` **et les issues `interview` / `rejected` / `ghosted`** (migration 035, ADR-52), et **`closed_at` sans péremption** — pour la même **`logical_key`** et non plus la paire (titre, boîte) exacte ; les auto-archivages de vieillissement sont **exclus** via le marqueur `auto-archive vieillissement` de `user_notes`, ce qui neutralise les republications **sans** enterrer les offres re-scorées à la hausse — migrations 018/026, ADR-23 + ADR-32). Colonne **générée** `logical_key` = `jobs_logical_key(company, title)` (normalisation ADR-25 devenue du code : accents, parenthèses et mentions H/F retirés) — source **unique** de la dédup, lue par la routine et le trigger, jamais écrite (un INSERT qui la vise échoue). Index `jobs_status_score_idx` + `jobs_first_seen_idx` + `jobs_logical_key_idx`. RLS : policy `jobs_read_public` (SELECT public — pas restreint `authenticated` comme le reste du repo !) + `jobs_user_update` (UPDATE public). |
| `user_profile` | **Read** : key `target_salary_range` (text, ex: "90-130k€") — utilisée par `<SalaryEstimate>` pour matcher le target estimé contre la fourchette cible et basculer le badge "dans/hors fourchette". Édité depuis le panel Profil. | Optionnelle. Si absente, l'encart affiche le target sans badge in/out. |
| `job_scans` | **Read** : `id, scan_date (unique), raw_count, dedup_strict_count, processed_count, hot_leads_count, tendances (jsonb), actions (jsonb), created_at` (le front ne lit plus `signal_cv`). **Write** : aucun côté front (écriture par la routine Jobs Radar distante via le connecteur MCP Supabase, service_role). | **4 scans**. `dedup_strict_count` jamais consommé par le front. RLS : `job_scans_read_public` (SELECT public). |

**⚠ Écart RLS** : contrairement à la migration `006_rls_authenticated.sql` qui force `authenticated` partout, `jobs` + `job_scans` ont des policies `using (true)` sans clause `TO authenticated`. Anon peut donc lire les offres (mais nécessite quand même la `apikey` header).

## Back — pipelines qui alimentent
- **Routine Claude Code distante** (claude.ai, hors repo GitHub Actions — ADR-19) — responsable de :
  1. Fetch JSearch (RapidAPI) 3×/semaine — **10 requêtes/run** (socle 6 + rotation 4 par `jour_de_l_année mod 3`), **18 formulations distinctes** couvrant le cap produit IA *et* le socle pilotage en boîte tech (ADR-50 ; catégorie EM depuis ADR-22 ; liste complète dans la routine : `docs/cowork-routines/jobs-radar.md`), `num_pages=1`, `country=fr`
  2. Dédup **logique** via la colonne générée `logical_key` (= `jobs_logical_key(company, title)`), **sans fenêtre temporelle**, `linkedin_job_id` en repli (ADR-25 + ADR-32)
  3. Scoring 10 points + `rubric_justif` à clés plates par axe. Depuis ADR-50 : `seniority` doit **chiffrer les deux compteurs** de l'utilisateur (8 ans pilotage / 3 ans produit) face à l'exigence de la JD ; `calibrage` porte le **bonus +1.5 « boîte tech désirable »** et, pour un rôle de pilotage sans angle IA, le **plafond 6.9** qui le laisse visible sans jamais le faire passer hot lead
  4. **Extraction des skills** — en priorité depuis `job_highlights.Qualifications`/`Responsibilities` (sinon `job_description`) + match au profil (`skill_radar` + `user_profile`) → `intel.skills_required [{ name, on_cv }]` (+ `intel.skills_source`) — ADR-20
  5. **Estimation salaire calibrée** : `intel.salary_estimate { min, max, target, currency, basis, rationale }` — bornes lues depuis la JD si publiées (`basis: "published"`) ou inférées du marché (`basis: "inferred"`)
  6. Écriture dans `jobs` (`intel_depth = 'light'`, colonne `is_remote`, `intel.employer_logo`) et `job_scans` (1 ligne/run) via le connecteur **MCP Supabase** (service_role)

  Pré-filtre **FULLTIME** : les offres non temps-plein (`job_employment_types` ≠ FULLTIME) sont écartées avant dédup/scoring — gardées si le champ est absent (ADR-20). Plus de navigateur ni de session LinkedIn ; couverture élargie (liens « Postuler » parfois Indeed/WTTJ). **Abandonnés vs l'ère Cowork** : intel warm (signaux boîte / lead / réseau / angle / maturité SAFe), reco CV (`cv_recommended`/`cv_reason`), détection auto de clôture. Pas de workflow `.github/workflows/jobs-*.yml` : l'orchestration tourne sur claude.ai. Le repo ne contient que :
  - Migration DDL : [jarvis/migrations/008_jobs_radar.sql](jarvis/migrations/008_jobs_radar.sql)
  - Seed mock : [jarvis/seed/jobs_radar_mock.sql](jarvis/seed/jobs_radar_mock.sql) (7 offres + 1 scan pour dev local)
  - README : [README-jobs-radar.md](README-jobs-radar.md)
  - Prompt de la routine (miroir versionné) : [docs/cowork-routines/jobs-radar.md](docs/cowork-routines/jobs-radar.md) — éditable via le skill `schedule` / l'outil `RemoteTrigger`
- **Daily pipeline** (main.py) : aucune interaction.
- **Weekly pipeline** (weekly_analysis.py) : aucune interaction.
- **Jarvis (local)** : pas indexé (absent de `indexer.py`). Les offres ne sont pas dans `memories_vectors`.
- **Front** : seul writer pour `status` et `user_notes` (whitelisté).

## Appels externes
- **Supabase REST (lecture)** :
  - `GET /rest/v1/jobs?select=*&order=score_total.desc.nullslast&limit=300`
  - `GET /rest/v1/job_scans?scan_date=eq.{today}&select=*`
  - `GET /rest/v1/job_scans?scan_date=gte.{today-7}&select=*&order=scan_date.desc&limit=14`
- **Supabase REST (écriture)** : `PATCH /rest/v1/jobs?id=eq.{id}` avec `{status?, user_notes?}`.
- **Supabase Realtime** : channel `jobs_radar_sub` subscribe `postgres_changes event=* schema=public table=jobs|job_scans`. Nécessite WebSocket.
- **`window.open(url, "_blank")`** : « Lire l'annonce » et « Relancer ».
- **Telemetry** : `window.track("jobs_action", { action, job_id, value })` — gestes de tri (`open`, `status`, `close`, `undo`), snooze, notes, relance. `window.track("jobs_feedback", { verdict, reason, job_id, score_at_vote })` — une décision « Pas pour moi ». Détail : `docs/telemetry.md`.

## Dépendances
- **Onglets in** : sidebar "Jobs Radar" (groupe Business). Aucun cross-nav entrant.
- **Onglets out** : aucun — pas de navigation vers d'autres panels.
- **Pipelines obligatoires** : **la routine Jobs Radar distante** (ADR-19). Sans elle, les tables restent vides et le panel affiche un état d'absence (les mocks de démo ont été retirés le 2026-04-29).
- **Tier 1 dépendances** : aucune — entièrement self-contained en Tier 2.
- **Variables d'env / secrets** :
  - Front : clé publishable Supabase + JWT Google OAuth (même si RLS policies ici sont `using(true)`, les headers `apikey` et `Authorization` sont quand même envoyés).
  - Backend (routine distante) : accès Supabase via le connecteur MCP (service_role) — pas de `SUPABASE_SERVICE_KEY` en env ; clé RapidAPI inline dans le prompt de la routine.

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant les 3 fetchs parallèles.
- **Tables vides** (migration non appliquée ou scan jamais tourné) : `allJobs?.length || todayScan` est false → `JOBS_DATA` reste à sa forme vide d'init (offers `[]`, scan `null`). Le panel affiche son état "Aucune offre" (filtres → `.jr-empty`) plutôt qu'un faux feed. Le mock `data-jobs.js` a été retiré le 2026-04-29.
- **Zone « À décider » vide** : aucune offre non triée ≥ 7 entrée depuis moins de 7 jours (ou aucune avec les filtres rôle / lieu / recherche) → `.jr-decide-empty` : « Rien de nouveau à trier sur les 7 derniers jours. » ou « Rien à décider avec ces filtres. »
- **Liste vide après filtres** : `.jr-empty` avec icône search + "Aucune offre avec ces filtres" + sub "Essaie de relâcher un critère — ou reviens demain matin."
- **PATCH échoue** : pour un geste de tri, l'inverse est réappliqué localement + toast « Écriture impossible — geste annulé », aucun event ne part. Pour snooze et notes (chemin `updateJob`), toast « Erreur de sync — changement local uniquement », sans rollback.
- **Annuler après un deuxième geste** : seul le dernier geste est annulable ; son inverse est calculé sur l'état juste avant lui.
- **Candidature clôturée** : reste dans « Tes candidatures », jamais masquée.
- **Candidature non datée qui reçoit une issue** : reste dans le groupe « Avant le 17/08 ».
- **Filtre mémorisé « Candidaté »** (version antérieure) : ramené à « Actives » au chargement.
- **Double-clic sur un geste** : le second clic est ignoré. Sans ce garde-fou, la ligne triée sortait ou se re-triait aussitôt, et le second clic touchait le bouton de la ligne voisine, glissé sous le pointeur.
- **Menu ouvert sur une ligne atténuée, ou en bas de liste** : la ligne qui porte le menu passe au-dessus de ses voisines, et ni la liste ni « Tes candidatures » ne rognent plus les menus (revue du 2026-09-24 ; vérifié dans Chrome par `tests/smoke_jobs_panel.mjs`).
- **Realtime indisponible** (WebSocket bloqué, `sb.client.channel` absent) : no-op silencieux → pas de rafraîchissement auto. L'utilisateur doit recharger la page pour voir un nouveau scan.
- **`sb.patchJSON` absent** : `patchJobSupabase` return sans erreur → l'optimistic update reste local, le toast "ok" s'affiche quand même (**bug** : toast trompeur, aucun appel DB émis).
- **`intel` null** sur hot lead : `intel && (...)` guard → les sections enrichies (skills, salaire) sont skippées, mais la card hot reste affichée avec score + rubric.
- **`intel.skills_required` vide/absent** (lignes historiques sans skills) : `<JrSkills>` renvoie `null` — la card reste score + rubric + salaire.
- **`intel.salary_estimate` absent** (salaire indéterminable côté routine) : encart `<SalaryEstimate>` ne se render pas — la card hot affiche `compensation` text dans la meta line uniquement.
- **`target_salary_range` absent du profil** : `targetRange = null` → estimation affichée sans badge in/out (tone neutre).
- **`target_salary_range` mal formaté** (ex: "100k", "90 à 130") : la regex `(\d+)\s*[-–—]\s*(\d+)` échoue → comportement identique à absent.
- **`salary_estimate.min` ou `max` null** : seul `target` est affiché. Si les trois sont null, l'encart est skip.
- **`offer.url` vide** : « Lire l'annonce » désactivé ; « J'ai postulé » reste possible (candidature par un autre canal).
- **`updated_at` jamais utilisé par le front** : colonne présente mais pas consommée.
- **Notes edit cancel** : `onCancel` ferme le textarea sans sauvegarder — le draft est perdu (pas de "sauve auto en brouillon").
- **Menu open sur une offre, scroll sur une autre** : le `ref.current.contains(e.target)` gère correctement le dismiss sur click outside.
- **Republication LinkedIn d'une offre archivée/snoozée** : quand la routine insère une nouvelle annonce (nouveau `linkedin_job_id`) avec le même `(lower(trim(title)), lower(trim(company)))` qu'une ligne récemment archivée (≤30j) ou snoozée (≤7j, durée du snooze), un trigger Postgres `BEFORE INSERT` (`jobs_inherit_user_status`, migration `sql/013_jobs_inherit_status.sql`) hérite du `status` et copie les `user_notes` si la nouvelle ligne en est dépourvue. Les autres colonnes (score, intel, dates, url) restent celles du nouveau scan. Au-delà des fenêtres temporelles, la nouvelle ligne repart en `status='new'`.

## Écart de compétences et relance (2026-08-17)

Deux ajouts de la vague 2 de l'audit du 2026-08-15 (ADR-39), tous deux dans
Jobs Radar plutôt que dans un nouvel onglet.

### « Ce que le marché te reproche »

Bloc posé sous le ScanBanner. Il agrège `jobs.intel->skills_required`, que la
routine remplit offre par offre avec un drapeau `on_cv`, et que le front
n'affichait jusqu'ici que carte par carte — soit 2 156 paires dont aucun verdict
n'était tiré. L'agrégat vit dans la vue SQL `market_skill_gap`
([sql/031](sql/031_market_skill_gap.sql)), pas côté client.

Verdict au 2026-08-17 : **Profondeur technique ML / MLOps, absente sur 91 des
93 offres qui l'exigent (98 %)**, loin devant tout le reste.

Cliquer un axe filtre la liste sur ses offres et force le filtre de statut à
« Tout » — sinon le défaut « actives » masquerait la majorité des offres
concernées et le compteur du bloc ne correspondrait plus à la liste affichée.
Le filtre n'est **pas** persisté en `localStorage`, contrairement à ceux de la
toolbar : c'est une exploration ponctuelle, la retrouver au chargement suivant
donnerait une liste mystérieusement tronquée.

Ce bloc ne ressuscite pas le groupe Apprentissage. Celui-ci reposait sur un
auto-diagnostic déclaratif (`skill_radar` figé au 2026-04-04) et du contenu
poussé que personne n'ouvrait ; ici c'est le marché qui parle, le calcul existe
déjà, et l'affichage est dans un onglet réellement fréquenté.

### Bouton « Relancer »

Le calcul des candidatures en souffrance existait déjà dans `data-loader.js` ;
le bouton qui les affichait n'avait aucun `onClick`, et 30 candidatures sur 32
attendaient depuis plus de dix jours (la plus ancienne : 2026-04-28).

Trois correctifs indissociables :

1. **Le bouton écrit.** `last_followup_at` + `followup_count`, via la whitelist
   de `patchJobSupabase` — qu'il fallait élargir, sinon le patch était avalé
   en silence. L'offre sort alors de la liste : la file se vide au lieu de
   réafficher éternellement les mêmes lignes.
2. **Le plafond passe de 2 à 6**, trié du plus ancien au plus récent. À 2, une
   file de 30 se serait vidée à deux par jour au mieux.
3. **La date de référence ne ment plus.** L'ancien libellé disait « candidaté
   il y a N j » à partir de `last_seen_date`, qui est la dernière fois que
   JSearch a re-listé l'offre. `applied_at` est désormais horodaté au clic sur
   « Postuler », mais reste **NULL sur les 32 candidatures antérieures** : aucune
   date fiable n'existait et `updated_at` bouge à chaque rescan de la routine
   (vérifié le 2026-08-17 sur l'offre Accor). Pour ces lignes-là, le libellé
   dégrade honnêtement en « vue il y a N j — date de candidature inconnue ».

Le schéma `job_scans.actions` écrit par la routine (`{note, job_id, company,
priority}`) est aussi normalisé vers celui que lit le panel (`{id, kind, label,
cta}`) : les deux divergeaient en silence et les lignes se rendaient **vides**
quand la routine en produisait vraiment.

Statuts de funnel ajoutés : `interview`, `rejected`, `ghosted`
([sql/030](sql/030_jobs_followup.sql)). Trois valeurs, pas un CRM.

## Limitations connues / TODO
- [x] **Mock toujours affiché si tables vides** — résolu le 2026-04-29 (commit `5e83774`) : `data-jobs.js` supprimé, le panel utilise désormais l'état vide légitime quand Supabase ne remonte rien.
- [ ] **RLS permissive** : `jobs_read_public` + `jobs_user_update` utilisent `using(true)` sans `TO authenticated`. Anon avec juste l'apikey lit toutes les offres + peut PATCH n'importe quoi. À aligner sur migration 006.
- [ ] **Toast ok trompeur si `sb.patchJSON` absent** : l'update reste purement local mais le toast affiche "Postulé · statut mis à jour". Devrait être un toast "Synchro indisponible — local only".
- [ ] **Pas de rollback sur PATCH échoué** — corrigé pour les gestes de tri (ADR-52) ; reste vrai pour snooze et notes : l'offre garde son état local, la DB l'écrase au reload.
- [x] **Bouton « Enrichir l'Intel → » retiré** (2026-05-28) — l'enrichissement intel warm est abandonné (migration vers API structurée).
- [ ] **Pas de pagination** : `limit=300` (archivées uniquement depuis le 2026-08-17 ; les offres actives sont chargées sans plafond utile — cf. ADR-39) dans `jobs_all`. Passé ce seuil les offres plus anciennes disparaissent du feed — dédup cross-jours, pas de mécanisme "Charger plus". Le README le mentionne.
- [ ] **`tendances.ratios_category` jsonb ignoré** : la routine peut pré-calculer des ratios plus fins (pondérés, secteurs), mais `transformJobScan` les recalcule systématiquement depuis `activeJobs`. Idem `volumes_7d` qui pourrait être lu depuis `tendances.volumes_7d` si présent.
- [ ] **`dedup_strict_count` jamais affiché** : colonne calculée par le scan, présente dans `job_scans`, jamais consommée. Info perdue.
- [ ] **Pas de cross-nav vers Jarvis** : contrairement à `opps` qui a un bouton "Plan d'action" + stash, Jobs Radar n'offre pas "Demande à Jarvis de prépare ton pitch pour cette offre". Manque évident.
- [x] **Reco CV retirée du front** (2026-05-28) — badge CV, `cv_reason` et bloc « Signal CV » du banner supprimés.
- [ ] **Pas de filtre "deep intel only"** : impossible de trier pour ne voir que les hot leads avec intel déplié — potentiellement utile pour le matin du job search.
- [ ] **`status="to_apply"` jamais écrit par le front** : l'enum existe DB mais aucun chemin UI ne le set (postuler passe direct à `applied`). Reliquat du design initial ?
- [ ] **Pas d'indexation Jarvis** : absent de `indexer.py`. Jarvis ne peut pas raisonner sur "quelles offres correspondent à mon profil" via RAG.
- [ ] **`rubric_justif` legacy non normalisé en base** — les lignes historiques portent jusqu'à 17 formes distinctes (légacy strings, short-form `sen/sec/imp`, FR `seniorite/secteur`, structurée `{max, just, score}`, single-line `redflag/reason/note/gap/reject`, hybride `{total, reason, verdict}`). La routine actuelle écrit désormais la **forme à clés plates figée** (`seniority`/`sector`/`impact`/`bonus`/`calibrage` — ADR-19, prompt versionné) ; le front continue de tout tolérer via `transformJobRubric`. Reste à migrer les anciennes lignes en base.
- [ ] **Realtime reload sans debounce** : un batch de N inserts de la routine déclenche N `loadPanel("jobs")`. Le cache `once("jobs_all")` est volontairement busté à chaque event.
- [ ] **`window.JOBS_DATA.offers[idx] = { ...old, ...patch }` en mute direct** : potentiellement problématique si un re-render React lit la ref tout en la mutant. Ici l'effet est secondaire mais pas idiomatique.

## Dernière MAJ
2026-09-24 — **Zone « Tes candidatures » (ADR-52)** : les candidatures quittent la liste dense pour une section repliable qui pose l'issue en un clic (entretien / refus / sans réponse — statuts ouverts par `sql/030`, jamais écrits jusqu'ici) et corrige les faux positifs (« Pas candidaté en fait »). Les 30 candidatures d'avant le 2026-08-17 (sans date de candidature) y sont repliées ; aucune donnée corrigée automatiquement. Les relances d'« Actions du jour » ne portent plus que sur les candidatures datées. En-tête : « N à décider · N candidatures en cours ». L'option de filtre « Candidaté » disparaît.
2026-09-24 — **Lire ≠ postuler, tri en un geste (ADR-52)** : « Postuler sur LinkedIn » était le seul moyen de lire l'annonce et marquait l'offre `applied` — le statut voulait dire « ouvert ». Remplacé par « Lire l'annonce » (aucune écriture) + « J'ai postulé ». Le vote 👍/👎 et « Archiver » cèdent la place à « Pas pour moi » : trois raisons à un clic + précision libre, ou « Lien mort » (clôture, pas un avis). Toast « Annuler » 5 s, rollback local si l'écriture échoue. La zone du haut devient « À décider » : hot leads non triés entrés depuis moins de 7 jours (8 cartes au lieu de 82 le 2026-09-24). Logique pure dans `cockpit/lib/jobs-view.js`, testée par `tests/test_jobs_view.mjs` ; smoke de rendu `tests/smoke_jobs_panel.mjs`.
2026-09-24 — **Les issues de candidature survivent aux republications (ADR-52)** : le trigger `jobs_inherit_user_status` hérite désormais `interview`, `rejected` et `ghosted` comme `applied` — sans péremption, jamais forcés en `archived` par une clôture. Migration `sql/035_jobs_inherit_outcomes.sql`, vérifiée par un bloc `DO` qui lève son verdict. Prépare la zone « Tes candidatures ».
2026-08-27 — **Le pilotage devient une cible de premier rang (ADR-50)** : sur 60 jours, `produit` sortait 77 offres en `new` quand `pgm` en sortait 12, `em` 3 et `pjm` **0** — le pilotage était collecté puis systématiquement enterré, et alimenté par du conseil et de l'industrie (Safran, Capgemini, Wavestone, Accenture) plutôt que par des boîtes tech. Sourcing porté à **10 requêtes/run / 18 distinctes** (les variantes `in France` remplacées par leurs variantes Paris, validées contre JSearch avant écriture) ; rubric refondue — deux rangs de rôles cibles, bonus **+1.5 « boîte tech désirable »**, **plafond 6.9** pour un pilotage sans angle IA, `score_seniority` sur deux compteurs, pénalité TPM relue sur la substance. Le feed devrait donc faire remonter du PgM/TPM/CoS en scale-up et GAFAM en bande **Moyen (5-7)**, les hot leads restant réservés aux rôles à angle IA. **Aucun re-scoring du stock** : la routine ne re-score jamais une offre connue et `jobs` ne stocke pas la description de l'annonce.
2026-06-26 — **Filtre « fraîcheur » + tri « récence » réparés (base = entrée radar)** : la fraîcheur se mesurait sur `posted_date` (date de publication LinkedIn, antidatée et NULL ~30 % du temps) — le filtre « < 7j » ne remontait qu'1 offre sur 158 actives. Bascule sur `first_seen_date` (date d'entrée dans le radar, jamais NULL) : nouveau champ `seen_days_ago` dans `transformJobRow`, `posted_days_ago` devient strict (NULL si pas de date LinkedIn) et n'alimente plus que l'affichage secondaire « publiée il y a Yj ». Âge affiché « Repérée il y a Xj ». Borne « < 7j » gardée stricte. Iso-archi (pas d'ADR). NB : le symptôme dominant était la **panne du fetch JSearch** (`raw_count` 110→0 depuis le 21/06, cf. ADR-21) — hors périmètre front.
2026-05-31 — **Barre de filtres collante + filtre fraîcheur + persistance** : les filtres remontent dans un bandeau collant (étiquettes des filtres actifs + dépliage à la demande), un nouveau filtre « fraîcheur » isole les offres de moins de 24 h / moins d'une semaine, et les réglages sont mémorisés entre visites (hors recherche). Iso-archi (pas d'ADR).
2026-05-31 — **Trigger d'héritage de statut corrigé (ADR-23)** : `jobs_inherit_user_status` n'hérite plus que des décisions utilisateur (snooze, verdict 👎, ou archived à score ≥ 5) ; les archivages automatiques (score < 5) n'enterrent plus une offre re-scorée à la hausse lors d'une republication (cas AI6 « Head of Delivery » re-scoré 9.5 puis re-archivé à tort). Migration `sql/018_jobs_inherit_status_userdriven.sql`.
2026-05-31 — **Filtres appliqués au hero « hot leads »** : le bloc hot leads (offres ≥ 7) suit désormais les filtres catégorie/lieu/statut/score/recherche (avant : toujours toutes catégories) et se masque s'il ne reste aucune offre correspondante. Compteur « hot leads » du header gardé global. Fix UX iso-archi (pas d'ADR).
2026-05-31 — **Engagement Manager = rôle cible (ADR-22)** : la routine suit désormais les postes d'engagement / delivery / transformation manager en boîte tech/produit/IA crédible — 2 requêtes ajoutées, scoring qui ne les pénalise plus comme du « RUN », nouvelle catégorie « EM » (filtre + répartition du scan banner). Exclusion conseil/ESN inchangée. Migration `sql/017_jobs_em_category.sql`. Voir ADR-22.
2026-05-29 — **réorientation IA (ADR-21)** : routine passe à 8 requêtes-rôles (+ `AI product manager`, `AI program manager`, `head of AI product`, `generative AI product manager`) ; ÉTAPE 3 « Roles cibles »/« Secteurs chauds » réorientées IA ; `user_profile.job_pref_rules` de Jean créée en base (pivot IA, CDI senior, plancher 80k fixe + 10k variable, exclusions conseil/ESN + expertise verticale manquante). Prompt live mis à jour via `RemoteTrigger`. Voir ADR-21.
2026-05-28 — **Jobs Radar v2.1 (ADR-20)** : exploitation des champs JSearch — filtre FULLTIME pré-scoring, skills extraits en priorité de `job_highlights` (provenance `intel.skills_source`), nouvelle colonne `is_remote` (badge « Remote » + filtre lieu), logo employeur (`intel.employer_logo`). Migration `sql/016_jobs_is_remote.sql`. Front : carte (logo + badge Remote), filtre lieu, label « d'après l'annonce » sur les skills.
2026-05-28 — **réconciliation back/routine (le « plan 2 »)** : le moteur est désormais une **routine Claude Code distante** (JSearch + Sonnet 4.6 + connecteur MCP Supabase, 4×/sem — ADR-19) en remplacement de l'agent Cowork LinkedIn. MAJ Finalité + sections back (pipeline, écriture via MCP, `intel_depth` none/light, `closed_at` front-only) + suppression des mentions intel warm / reco CV / détection auto de clôture. Routine activée (`enabled: true`) après test concluant. Voir ADR-19 + docs/cowork-routines/jobs-radar.md.
2026-05-28 — refonte carte (fiche éditoriale) : bloc skills attendus « tu as déjà » / « à acquérir » (`intel.skills_required[{name,on_cv}]`, normalisé dans `transformJobIntel`) ; abandon de l'intel warm (signaux boîte/lead/réseau/angle/SAFe) et de la reco CV (badge CV, `cv_reason`, bloc « Signal CV » du banner → 3 colonnes). Les sections back/routine seront réconciliées au plan 2 (migration API structurée). Voir docs/superpowers/plans/2026-05-27-jobs-radar-front-card.md.
2026-05-27 — fiabilisation Tier 1 : bouton « Marquer clôturée »/« Rouvrir » (le front écrit `closed_at`, ADR-18) ; affichage de l'axe `calibrage` dans la rubric. Côté routine (v3.2, hors repo) : schéma `rubric_justif` figé, passe de clôture re-priorisée, fenêtre de scan dynamique. Voir docs/superpowers/plans/2026-05-27-jobs-radar-routine-hardening.md.
2026-05-21 — masquage des offres clôturées : colonne `closed_at` (migration 015) posée par Cowork, masquage front + filtre « Clôturées » + compteur. Voir docs/superpowers/plans/2026-05-21-jobs-radar-closed-offers.md.
2026-05-21 — redesign UI de vote : popover multi-sélection des raisons + alignement sur les tokens du thème (fix contraste du champ custom). Voir docs/superpowers/plans/2026-05-21-jobs-radar-vote-ui-redesign.md.
2026-05-21 — encart calibrage (Lot 2) : profil de préférences éditable (job_pref_rules) + observé (job_pref_observed) en haut du Jobs Radar.
2026-05-21 — ajout du vote 👍/👎 + raison (calibrage par feedback, Lot 1). Colonnes user_verdict* + héritage 180j (migration 014, sql/014_jobs_feedback.sql). Event jobs_feedback. Voir docs/superpowers/plans/2026-05-21-jobs-radar-calibrage-feedback.md.
2026-05-12 — fix crash React "Objects are not valid as a React child (keys {max, just, score})". Cause : la routine Cowork upstream a fait dériver `rubric_justif` vers 17 formes distinctes en DB (formes courtes `sen/sec/imp`, FR `seniorite/secteur`, single-line `redflag/reason/note/gap/reject`, structurée `{max, just, score}` par axe, hybride `{total, reason, verdict}`, etc.). Le code initial faisait `text: rubric.seniority || ""` — quand `rubric.seniority` est devenu un objet `{max, just, score}`, il était assigné tel quel à `r.text` et React crashait au render. Refonte de `transformJobRubric` en normalizer défensif qui aplatit toutes les formes vers `[{axis: string, text: string}]` strictement (extraction `just/justification/reason/note` + préfixe `score/max` quand dispo). Garde anti-crash en ceinture-bretelles : `safeRubricText()` coerce tout au render dans `RubricBlock` + `OfferRow`. Validé sur les 17 formes observées (+ edge cases null/undefined/array). À surveiller : aligner la routine Cowork sur une forme stable et documentée pour ne plus dépendre de cette normalisation.
2026-05-01 — sync spec ↔ code après audit : retire les mentions du mock `data-jobs.js` (Dépendances, États & edge cases, Limitations) — le fichier a été supprimé le 2026-04-29 (commit `5e83774`), `data-loader.js` n'initialise plus `JOBS_DATA` en fallback. Le panel affiche désormais un état vide légitime quand Supabase ne remonte rien.
2026-04-30 — fix "offres archivées qui réapparaissent le lendemain". Cause : LinkedIn republie certaines offres avec un nouveau `linkedin_job_id` tous les 1-3 jours, donc la dédup unique sur cette clé ne tient pas. Ajout d'un trigger Postgres `BEFORE INSERT` (`jobs_inherit_user_status`, migration `sql/013_jobs_inherit_status.sql`) qui hérite du `status` archived (≤30j) ou snoozed (≤7j) et des `user_notes` quand une paire `(lower(trim(title)), lower(trim(company)))` matche une ligne précédente.
2026-04-26 — tooltip CSS custom au hover du `(i)` (au lieu du `title=` natif lent et non stylable). Affiche source + rationale sur fond `--tx`, flèche pointant vers le bouton, 300px max. Pattern réutilisé depuis `.jr-score-tip`.
2026-04-26 — encart "Salaire estimé pour toi" : refonte UX sur retour user. Code couleur orange brand-tint en mode neutral (au lieu d'un gris discret) pour que le chiffre ressorte. Le `rationale` part dans un tooltip natif via un bouton `(i)` au lieu d'un paragraphe — encart 2x plus compact. Backfill manuel de 30 hot leads existants en DB via UPDATE jsonb_set (la routine Cowork V3.1 ne re-traite pas le stock historique).
2026-04-26 — ajout encart "Salaire estimé pour toi" sur les hot leads. Nouveau composant `<SalaryEstimate>` consomme `intel.salary_estimate` (alimenté par l'Étape 4.5 de la routine Cowork versionnée dans [docs/cowork-routines/jobs-radar.md](docs/cowork-routines/jobs-radar.md)). Lit `user_profile.target_salary_range` pour basculer le badge in/out. Mock data-jobs.js enrichi sur les 3 hot leads.
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — rétro-doc depuis code réel — commit `c456ac9` (feature shippée le `1bd0fb0`)
