# Jobs Radar

> Feed d'offres LinkedIn scorées par fit (0-10) via un scan Cowork externe quotidien, décomposées en "hot leads" (score ≥ 7) + liste dense filtrée/triable, avec statut (new/to_apply/applied/snoozed/archived) et notes perso persistés en DB, et rafraîchissement temps-réel via Supabase channels.

## Scope
pro

## Finalité fonctionnelle
Panel de **tri d'offres LinkedIn** — un agent Cowork externe (hors repo) scanne LinkedIn chaque jour, enrichit 15-40 offres pertinentes avec un score `seniority + sector + impact + bonus` (rubric 0-10), un intel parfois deep (signaux boîte, lead identifié, réseau warm, angle d'approche, maturité SAFe), et une reco CV (PDF vs DOCX). Les résultats atterrissent dans la table `jobs` (174 lignes actuellement) + un récap quotidien dans `job_scans` (4 scans). Le panel hydratate depuis ces deux tables, affiche les offres ≥7 en "Hot leads" avec intel déplié, et le reste en liste dense filtrable. L'utilisateur édite **uniquement** le statut (postuler / snoozer / archiver) et les notes perso — toutes les autres colonnes sont propriété du scan Cowork. Subscribe Supabase Realtime : un nouveau scan pendant que le panel est ouvert recharge le feed transparently.

## Parcours utilisateur
1. Clic sidebar "Jobs Radar" (groupe Business) — le panel charge les offres et le scan de la semaine.
2. Lecture du header : eyebrow "Jobs Radar · date du jour" + stats inline ("N nouvelles · M hot leads · T au total dans le radar") + titre descriptif.
3. Scan du banner en quatre blocs : volumes sur 7 jours en barres Lun→Dim, répartition par catégorie de rôle (Produit / RTE / PgM / PjM / CoS), signal CV (quelle version envoyer en ce moment avec insight textuel), actions du jour (relances + entretiens à préparer).
4. Lecture des hot leads en hero : cartes larges pour les offres notées 7+ avec score survolable, rubric par axe (Séniorité / Secteur / Impact), salaire estimé pour toi (target chiffré dans la fourchette + indicateur "dans ta fourchette cible"), intel (signaux boîte + lead identifié + réseau warm + angle d'approche), badge CV recommandé, boutons "Ouvrir le lead" (profil LinkedIn du contact) et "Postuler" (annonce).
5. Utilisation des filtres : recherche texte + trois groupes de filtres (score hot/mid/low / rôle / statut) + tri (score ou récence). Filtre statut "Actives" par défaut, qui masque les snoozées et archivées.
6. Liste dense en dessous : une ligne par offre avec score compact, titre / boîte, tags (catégorie / stage / statut), pitch, rubric condensée, badge CV, menu kebab d'actions et bouton pour postuler.
7. Clic sur "Postuler" ouvre l'annonce LinkedIn, passe l'offre en "appliquée" et affiche un toast de confirmation.
8. Menu kebab par offre : "Snoozer 7 jours", "Archiver", "Éditer les notes" (zone de texte inline avec bouton Enregistrer).
9. Rafraîchissement temps réel : quand le scan Cowork pousse de nouvelles offres pendant que le panel est ouvert, le feed se met à jour automatiquement sans recharger la page.

## Fonctionnalités
- **Score sur 10 décomposé** : chaque offre reçoit un score synthèse, survolable pour voir le détail par axe (Séniorité / Secteur / Impact / Bonus).
- **Trois bandes de score** : Hot (≥ 7) / Moyen (5-7) / Faible (< 5) colorées différemment pour repérer les opportunités en un clin d'œil.
- **Hot leads en hero** : les offres Hot mises en avant en grandes cartes avec rubric par axe, intel (signaux boîte, lead identifié, réseau warm, angle d'approche), badge CV recommandé (PDF vs DOCX) et boutons « Ouvrir le lead » + « Postuler ».
- **Salaire estimé pour toi** : sur les hot leads enrichis, un encart dédié coloré affiche un target chiffré ("~132k€") dans la fourchette de l'offre. Le détail du calcul (fourchette publiée vs inférée du marché, raison du positionnement) est accessible en survolant un petit "i". L'encart se code visuellement « dans ta fourchette cible » (vert) ou « hors fourchette » (gris) selon la fourchette de salaire renseignée dans ton profil ; sans fourchette définie il s'affiche en orange brand neutre.
- **Scan banner** : quatre blocs de synthèse en haut de page — volumes sur 7 jours en barres Lun→Dim, répartition par catégorie de rôle, signal CV (quelle version envoyer en ce moment avec insight textuel), actions du jour (relances + entretiens à préparer).
- **Liste dense filtrable** : une ligne par offre avec recherche texte + trois groupes de filtres (score / rôle / statut) + tri (score ou récence). Filtre statut « Actives » par défaut qui masque les snoozées et archivées.
- **Actions rapides par offre** : bouton Postuler (ouvre LinkedIn + marque appliquée + toast de confirmation), menu kebab (Snoozer 7 jours / Archiver / Éditer les notes) et zone de notes perso inline.
- **Statuts + notes persistés** : passage en appliquée/snoozée/archivée et notes perso sauvegardés en base, avec mise à jour instantanée et toast de confirmation (ou toast d'erreur en cas de souci de synchro).
- **Archivage durable face aux republications LinkedIn** : quand LinkedIn republie une offre déjà archivée (même titre + même boîte) sous une nouvelle annonce, la décision d'archivage est conservée — l'offre ne réapparaît pas dans la liste le lendemain. Idem pour une offre snoozée tant que le snooze n'est pas expiré. Les notes perso de la version archivée sont aussi récupérées si la nouvelle annonce n'en a pas.
- **Rafraîchissement temps réel** : quand le scan Cowork pousse de nouvelles offres pendant que le panel est ouvert, le feed se met à jour automatiquement sans reload.
- **Message vide après filtres** : quand aucune offre ne correspond aux filtres, un message explicite suggère de relâcher un critère ou de revenir le lendemain matin.

## Front — structure UI
Fichier : [cockpit/panel-jobs-radar.jsx](cockpit/panel-jobs-radar.jsx) — 782 lignes, monté par [app.jsx:404](cockpit/app.jsx:404). CSS dédié : [cockpit/styles-jobs-radar.css](cockpit/styles-jobs-radar.css) — 1156 lignes, scope `jr-*`. Ressources incluses dans [index.html:32, 73, 98](index.html:32).

Structure DOM :
- `.panel.panel-jobs-radar`
  - `.jr-header` — kicker + stats + h1 (title-main + title-sub)
  - `<ScanBanner>` → `.jr-scan > .jr-scan-grid` 4 colonnes :
    - `.jr-scan-block` volumes 7j (7 `.jr-sparkbar`)
    - `.jr-scan-block` répartition catégories (5 `.jr-ratbar`)
    - `.jr-scan-block--cv` signal CV (split horizontal + insight)
    - `.jr-scan-block--actions` actions du jour (liste `.jr-action-item`)
  - `.jr-hot-section` (conditionnel si `hotLeads.length > 0`) → `.jr-hot-grid` avec `<HotLeadCard>` (intègre `<SalaryEstimate>` entre rubric et intel quand `intel.salary_estimate` est présent)
  - `.jr-list-section`
    - `.jr-section-head--list` → kicker + titre + `.jr-filters` (search + 3 `<FilterGroup>` + `.jr-sort`)
    - `.jr-list` OR `.jr-empty` avec liste de `<OfferRow>`
  - `<JrToast>` (conditionnel)

Route id = `"jobs"`. **Panel Tier 2** ([data-loader.js:4528](cockpit/lib/data-loader.js:4528)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelJobsRadar({ data, onNavigate })` | Composant racine — state local `offers[]` mirror de `window.JOBS_DATA.offers`, split hot/rest, 4 filtres | [panel-jobs-radar.jsx:498](cockpit/panel-jobs-radar.jsx:498) |
| `HotLeadCard({ offer, rank, ... })` | Card large avec intel déplié + angle + CTAs ; lit `window.PROFILE_DATA._values.target_salary_range` pour calibrer le badge in/out de l'estimation salaire | [panel-jobs-radar.jsx:198](cockpit/panel-jobs-radar.jsx:198) |
| `SalaryEstimate({ estimate, targetRange })` | Encart "Salaire estimé" — affiche `target` + `range` issus de `intel.salary_estimate`, badge "dans/hors fourchette cible" en parsant `targetRange` ("90-130k€"). 3 tones de couleur : `--in` (vert positif), `--out` (gris pâle), `--neutral` (orange brand-tint, par défaut sans fourchette user). Le `rationale` + label de source sont exposés via un bouton `(i)` au hover : tooltip CSS custom 300px qui affiche "SOURCE LABEL" + rationale sur fond `--tx` avec flèche pointant vers le bouton (même pattern que `.jr-score-tip`). | [panel-jobs-radar.jsx:184](cockpit/panel-jobs-radar.jsx:184) |
| `OfferRow({ offer, ... })` | Ligne dense pour mid/low — score + titre + rubric condensée | [panel-jobs-radar.jsx:340](cockpit/panel-jobs-radar.jsx:340) |
| `ScanBanner({ scan })` | 4 blocs header (volumes/ratios/CV/actions) | [panel-jobs-radar.jsx:416](cockpit/panel-jobs-radar.jsx:416) |
| `ScoreChip({ offer, big })` | SVG-less score "N,N/10" avec tooltip `.jr-score-tip` décomposition 4 axes | [panel-jobs-radar.jsx:152](cockpit/panel-jobs-radar.jsx:152) |
| `RubricBlock({ offer })` | Liste de 3 lignes axis/text | [panel-jobs-radar.jsx:184](cockpit/panel-jobs-radar.jsx:184) |
| `JrActionsMenu({ offer, open, onToggle, ... })` | Kebab popover (Snoozer/Archiver/Éditer notes/Enrichir Intel-disabled) | [panel-jobs-radar.jsx:82](cockpit/panel-jobs-radar.jsx:82) |
| `JrNotesEditor({ offer, onSave, onCancel })` | Textarea 3 lignes + boutons save/cancel | [panel-jobs-radar.jsx:130](cockpit/panel-jobs-radar.jsx:130) |
| `JrToast({ message, tone })` | Toast aria-live 2.4s | [panel-jobs-radar.jsx:71](cockpit/panel-jobs-radar.jsx:71) |
| `FilterGroup({ value, onChange, options })` | Segmented buttons | [panel-jobs-radar.jsx:768](cockpit/panel-jobs-radar.jsx:768) |
| `patchJobSupabase(id, patch)` | Whitelist `{status, user_notes}` puis `PATCH /rest/v1/jobs?id=eq.X` | [panel-jobs-radar.jsx:15](cockpit/panel-jobs-radar.jsx:15) |
| `updateJob(id, patch, toastMsg)` | Optimistic mute state + mute global + track + PATCH + toast | [panel-jobs-radar.jsx:545](cockpit/panel-jobs-radar.jsx:545) |
| `applyToJob(offer)` / `snoozeJob` / `archiveJob` / `saveNotes` | Handlers PATCH | [panel-jobs-radar.jsx:567-579](cockpit/panel-jobs-radar.jsx:567) |
| Effet realtime Supabase channel | Subscribe `jobs_radar_sub` sur `jobs` + `job_scans` puis invalide cache + reload sur event | [panel-jobs-radar.jsx:519-537](cockpit/panel-jobs-radar.jsx:519) |
| `scoreBand(s)`, `dayLabel(n)`, `numberFmt(n)` | Helpers | [panel-jobs-radar.jsx:54-68](cockpit/panel-jobs-radar.jsx:54) |
| `T2.jobs_all()` | `GET jobs?select=*&order=score_total.desc.nullslast&limit=300` | [data-loader.js:1330](cockpit/lib/data-loader.js:1330) |
| `T2.jobs_scan_today()` | `GET job_scans?scan_date=eq.{today}&select=*` — retourne la 1e ligne ou null | [data-loader.js:1337](cockpit/lib/data-loader.js:1337) |
| `T2.jobs_scans_7d()` | `GET job_scans?scan_date=gte.{today-7}&select=*&order=scan_date.desc&limit=14` | [data-loader.js:1344](cockpit/lib/data-loader.js:1344) |
| `transformJobRow(row)` | DB row → panel shape (intel + rubric normalisés) | [data-loader.js:1585](cockpit/lib/data-loader.js:1585) |
| `transformJobIntel(intel)` | Normalise clés FR/EN (signaux_boite ↔ company_signals, salary_estimate ↔ estimation_salaire, etc.) ; valide les bornes numériques + currency + basis | [data-loader.js:1555](cockpit/lib/data-loader.js:1555) |
| `transformJobRubric(rubric)` | Array ou objet → array `[{axis, text}]` | [data-loader.js:1545](cockpit/lib/data-loader.js:1545) |
| `transformJobScan(todayScan, last7Scans, allJobs)` | Banner shape (volumes Mon→Sun, ratios catégorie, signal CV, actions auto si vides) | [data-loader.js:1613](cockpit/lib/data-loader.js:1613) |
| `loadPanel("jobs")` case | `Promise.all` des 3 fetchs + transform + mute `JOBS_DATA.offers/scan/_raw` | [data-loader.js:4500-4513](cockpit/lib/data-loader.js:4500) |
| `daysSinceDate(dateStr)` | Age en jours depuis une date ISO | [data-loader.js:1539](cockpit/lib/data-loader.js:1539) |

## Back — sources de données

| Table | Colonnes lues / écrites | Volumétrie |
|-------|--------------------------|------------|
| `jobs` | **Read** : `id, linkedin_job_id, first_seen_date, last_seen_date, title, company, url, posted_date, role_category (produit/rte/pgm/pjm/cos), company_stage (seed/A/B/C/scale/grand_groupe), pitch, compensation, score_seniority, score_sector, score_impact, score_bonus, score_total, rubric_justif (jsonb), cv_recommended (pdf/docx), cv_reason, intel (jsonb — inclut désormais une clé optionnelle `salary_estimate { min, max, target, currency, basis: 'published'\|'inferred', rationale }` calculée par la routine Cowork pour le Top 3), intel_depth (none/light/deep), status (new/to_apply/applied/snoozed/archived), user_notes, created_at, updated_at`. **Write (front PATCH whitelist)** : `status`, `user_notes`. | **554 lignes** (4 status distincts, dont 399 archived). Triggers DB : `jobs_updated_at` sur UPDATE (bumpe `updated_at`), `jobs_inherit_user_status` sur INSERT (hérite du `status` archived/snoozed récent pour la même paire (titre, boîte) — neutralise les republications LinkedIn). Index `jobs_status_score_idx` + `jobs_first_seen_idx`. RLS : policy `jobs_read_public` (SELECT public — pas restreint `authenticated` comme le reste du repo !) + `jobs_user_update` (UPDATE public). |
| `user_profile` | **Read** : key `target_salary_range` (text, ex: "90-130k€") — utilisée par `<SalaryEstimate>` pour matcher le target estimé contre la fourchette cible et basculer le badge "dans/hors fourchette". Édité depuis le panel Profil. | Optionnelle. Si absente, l'encart affiche le target sans badge in/out. |
| `job_scans` | **Read** : `id, scan_date (unique), raw_count, dedup_strict_count, processed_count, hot_leads_count, tendances (jsonb), signal_cv (jsonb), actions (jsonb), created_at`. **Write** : aucun côté front (écriture via Cowork en service_role). | **4 scans**. `dedup_strict_count` jamais consommé par le front. RLS : `job_scans_read_public` (SELECT public). |

**⚠ Écart RLS** : contrairement à la migration `006_rls_authenticated.sql` qui force `authenticated` partout, `jobs` + `job_scans` ont des policies `using (true)` sans clause `TO authenticated`. Anon peut donc lire les offres (mais nécessite quand même la `apikey` header).

## Back — pipelines qui alimentent
- **Pipeline Cowork externe** (hors repo GitHub Actions) — responsable de :
  1. Scan LinkedIn quotidien (142 offres brutes typiques → 28 pertinentes)
  2. Dedup strict via `linkedin_job_id` (UNIQUE, upsert côté scan)
  3. Scoring 10 points + rubric text par axe
  4. Enrichissement intel (boîte, lead, réseau warm via graph LinkedIn) à profondeur variable
  5. Reco CV PDF/DOCX + reason
  6. **Estimation salaire calibrée** sur le Top 3 (Étape 4.5 de la routine) : `intel.salary_estimate { min, max, target, currency, basis, rationale }` — bornes lues depuis la JD si publiées (`basis: "published"`) ou inférées du marché (`basis: "inferred"`), `target` positionné dans la fourchette en fonction du fit séniorité + warm intro disponible.
  7. Écriture dans `jobs` (service_role key, bypass RLS) et `job_scans` (1 ligne/jour).

  Pas de workflow `.github/workflows/jobs-*.yml` : l'orchestration tourne ailleurs. Le repo ne contient que :
  - Migration DDL : [jarvis/migrations/008_jobs_radar.sql](jarvis/migrations/008_jobs_radar.sql)
  - Seed mock : [jarvis/seed/jobs_radar_mock.sql](jarvis/seed/jobs_radar_mock.sql) (7 offres + 1 scan pour dev local)
  - README : [README-jobs-radar.md](README-jobs-radar.md)
  - Routine Cowork versionnée : [docs/cowork-routines/jobs-radar.md](docs/cowork-routines/jobs-radar.md) (à copier/coller dans Cowork lors d'une mise à jour du prompt)
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
- **`window.open(url, "_blank")`** : ouverture offres LinkedIn + LinkedIn du lead.
- **Telemetry** : `window.track("jobs_action", { action, job_id, value })` — un seul event type, couvre toutes les mutations.

## Dépendances
- **Onglets in** : sidebar "Jobs Radar" (groupe Business). Aucun cross-nav entrant.
- **Onglets out** : aucun — pas de navigation vers d'autres panels.
- **Pipelines obligatoires** : **pipeline Cowork externe**. Sans lui, les tables restent vides et le panel affiche un état d'absence (les mocks de démo ont été retirés le 2026-04-29).
- **Tier 1 dépendances** : aucune — entièrement self-contained en Tier 2.
- **Variables d'env / secrets** :
  - Front : clé publishable Supabase + JWT Google OAuth (même si RLS policies ici sont `using(true)`, les headers `apikey` et `Authorization` sont quand même envoyés).
  - Backend (Cowork) : `SUPABASE_SERVICE_KEY` (écriture service_role).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant les 3 fetchs parallèles.
- **Tables vides** (migration non appliquée ou scan jamais tourné) : `allJobs?.length || todayScan` est false → `JOBS_DATA` reste à sa forme vide d'init (offers `[]`, scan `null`). Le panel affiche son état "Aucune offre" (filtres → `.jr-empty`) plutôt qu'un faux feed. Le mock `data-jobs.js` a été retiré le 2026-04-29.
- **Tous les hot leads masqués** (tous `archived` / `snoozed` ou 0 score ≥ 7) : `hotLeads.length === 0` → la section `.jr-hot-section` ne se render pas. Pas de message dédié — le hero disparaît silencieusement.
- **Liste vide après filtres** : `.jr-empty` avec icône search + "Aucune offre avec ces filtres" + sub "Essaie de relâcher un critère — ou reviens demain matin."
- **PATCH échoue** : toast `"Erreur de sync — changement local uniquement"` tone error. **Pas de rollback** — l'override local reste visible, la DB reste cohérente avec la vraie valeur. L'utilisateur peut être induit en erreur.
- **Realtime indisponible** (WebSocket bloqué, `sb.client.channel` absent) : no-op silencieux → pas de rafraîchissement auto. L'utilisateur doit recharger la page pour voir un nouveau scan.
- **`sb.patchJSON` absent** : `patchJobSupabase` return sans erreur → l'optimistic update reste local, le toast "ok" s'affiche quand même (**bug** : toast trompeur, aucun appel DB émis).
- **`intel` null** sur hot lead : `intel && (...)` guard → la section intel complète est skippée, mais la card hot reste affichée avec score + rubric.
- **`intel.salary_estimate` absent** (Top 3 light, ou rationale impossible côté Cowork) : encart `<SalaryEstimate>` ne se render pas — la card hot affiche `compensation` text dans la meta line uniquement.
- **`target_salary_range` absent du profil** : `targetRange = null` → estimation affichée sans badge in/out (tone neutre).
- **`target_salary_range` mal formaté** (ex: "100k", "90 à 130") : la regex `(\d+)\s*[-–—]\s*(\d+)` échoue → comportement identique à absent.
- **`salary_estimate.min` ou `max` null** : seul `target` est affiché. Si les trois sont null, l'encart est skip.
- **`intel_depth === "light"`** : bouton "Enrichir l'Intel →" visible dans kebab mais disabled avec tooltip "Feature à venir".
- **`offer.url` vide** : bouton "Postuler" disabled. `applyToJob` return early.
- **`updated_at` jamais utilisé par le front** : colonne présente mais pas consommée.
- **Notes edit cancel** : `onCancel` ferme le textarea sans sauvegarder — le draft est perdu (pas de "sauve auto en brouillon").
- **Menu open sur une offre, scroll sur une autre** : le `ref.current.contains(e.target)` gère correctement le dismiss sur click outside.
- **Aucune reco CV calculable** (`pdfCount + docxCount === 0`) : insight "Pas encore assez d'offres pour tirer un signal CV."
- **Republication LinkedIn d'une offre archivée/snoozée** : quand le scan Cowork insère une nouvelle annonce (nouveau `linkedin_job_id`) avec le même `(lower(trim(title)), lower(trim(company)))` qu'une ligne récemment archivée (≤30j) ou snoozée (≤7j, durée du snooze), un trigger Postgres `BEFORE INSERT` (`jobs_inherit_user_status`, migration `sql/013_jobs_inherit_status.sql`) hérite du `status` et copie les `user_notes` si la nouvelle ligne en est dépourvue. Les autres colonnes (score, intel, dates, url) restent celles du nouveau scan. Au-delà des fenêtres temporelles, la nouvelle ligne repart en `status='new'`.

## Limitations connues / TODO
- [x] **Mock toujours affiché si tables vides** — résolu le 2026-04-29 (commit `5e83774`) : `data-jobs.js` supprimé, le panel utilise désormais l'état vide légitime quand Supabase ne remonte rien.
- [ ] **RLS permissive** : `jobs_read_public` + `jobs_user_update` utilisent `using(true)` sans `TO authenticated`. Anon avec juste l'apikey lit toutes les offres + peut PATCH n'importe quoi. À aligner sur migration 006.
- [ ] **Toast ok trompeur si `sb.patchJSON` absent** : l'update reste purement local mais le toast affiche "Postulé · statut mis à jour". Devrait être un toast "Synchro indisponible — local only".
- [ ] **Pas de rollback sur PATCH échoué** : juste un toast erreur, l'offre garde son statut mis à jour localement. Au prochain reload, la DB écrase — perte silencieuse.
- [ ] **Bouton "Enrichir l'Intel →" disabled** (V2) — jamais implémenté depuis la release (commit `1bd0fb0`).
- [ ] **Pas de pagination** : `limit=300` dans `jobs_all`. Passé ce seuil les offres plus anciennes disparaissent du feed — dédup cross-jours, pas de mécanisme "Charger plus". Le README le mentionne.
- [ ] **`tendances.ratios_category` jsonb ignoré** : le scan Cowork peut pré-calculer des ratios plus fins (pondérés, secteurs), mais `transformJobScan` les recalcule systématiquement depuis `activeJobs`. Idem `volumes_7d` qui pourrait être lu depuis `tendances.volumes_7d` si présent.
- [ ] **`dedup_strict_count` jamais affiché** : colonne calculée par le scan, présente dans `job_scans`, jamais consommée. Info perdue.
- [ ] **Pas de cross-nav vers Jarvis** : contrairement à `opps` qui a un bouton "Plan d'action" + stash, Jobs Radar n'offre pas "Demande à Jarvis de prépare ton pitch pour cette offre". Manque évident.
- [ ] **`cv_reason` affiché sans contexte** : texte brut à côté du badge CV, peut être long et casser la mise en page sur les cards mobiles.
- [ ] **Pas de filtre "deep intel only"** : impossible de trier pour ne voir que les hot leads avec intel déplié — potentiellement utile pour le matin du job search.
- [ ] **`status="to_apply"` jamais écrit par le front** : l'enum existe DB mais aucun chemin UI ne le set (postuler passe direct à `applied`). Reliquat du design initial ?
- [ ] **Pas d'indexation Jarvis** : absent de `indexer.py`. Jarvis ne peut pas raisonner sur "quelles offres correspondent à mon profil" via RAG.
- [ ] **Realtime reload sans debounce** : un batch de N inserts Cowork déclenche N `loadPanel("jobs")`. Le cache `once("jobs_all")` est volontairement busté à chaque event.
- [ ] **`window.JOBS_DATA.offers[idx] = { ...old, ...patch }` en mute direct** : potentiellement problématique si un re-render React lit la ref tout en la mutant. Ici l'effet est secondaire mais pas idiomatique.

## Dernière MAJ
2026-05-01 — sync spec ↔ code après audit : retire les mentions du mock `data-jobs.js` (Dépendances, États & edge cases, Limitations) — le fichier a été supprimé le 2026-04-29 (commit `5e83774`), `data-loader.js` n'initialise plus `JOBS_DATA` en fallback. Le panel affiche désormais un état vide légitime quand Supabase ne remonte rien.
2026-04-30 — fix "offres archivées qui réapparaissent le lendemain". Cause : LinkedIn republie certaines offres avec un nouveau `linkedin_job_id` tous les 1-3 jours, donc la dédup unique sur cette clé ne tient pas. Ajout d'un trigger Postgres `BEFORE INSERT` (`jobs_inherit_user_status`, migration `sql/013_jobs_inherit_status.sql`) qui hérite du `status` archived (≤30j) ou snoozed (≤7j) et des `user_notes` quand une paire `(lower(trim(title)), lower(trim(company)))` matche une ligne précédente.
2026-04-26 — tooltip CSS custom au hover du `(i)` (au lieu du `title=` natif lent et non stylable). Affiche source + rationale sur fond `--tx`, flèche pointant vers le bouton, 300px max. Pattern réutilisé depuis `.jr-score-tip`.
2026-04-26 — encart "Salaire estimé pour toi" : refonte UX sur retour user. Code couleur orange brand-tint en mode neutral (au lieu d'un gris discret) pour que le chiffre ressorte. Le `rationale` part dans un tooltip natif via un bouton `(i)` au lieu d'un paragraphe — encart 2x plus compact. Backfill manuel de 30 hot leads existants en DB via UPDATE jsonb_set (la routine Cowork V3.1 ne re-traite pas le stock historique).
2026-04-26 — ajout encart "Salaire estimé pour toi" sur les hot leads. Nouveau composant `<SalaryEstimate>` consomme `intel.salary_estimate` (alimenté par l'Étape 4.5 de la routine Cowork versionnée dans [docs/cowork-routines/jobs-radar.md](docs/cowork-routines/jobs-radar.md)). Lit `user_profile.target_salary_range` pour basculer le badge in/out. Mock data-jobs.js enrichi sur les 3 hot leads.
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — rétro-doc depuis code réel — commit `c456ac9` (feature shippée le `1bd0fb0`)
