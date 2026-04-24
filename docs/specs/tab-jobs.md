# Jobs Radar

> Feed d'offres LinkedIn scorées par fit (0-10) via un scan Cowork externe quotidien, décomposées en "hot leads" (score ≥ 7) + liste dense filtrée/triable, avec statut (new/to_apply/applied/snoozed/archived) et notes perso persistés en DB, et rafraîchissement temps-réel via Supabase channels.

## Scope
pro

## Finalité fonctionnelle
Panel de **tri d'offres LinkedIn** — un agent Cowork externe (hors repo) scanne LinkedIn chaque jour, enrichit 15-40 offres pertinentes avec un score `seniority + sector + impact + bonus` (rubric 0-10), un intel parfois deep (signaux boîte, lead identifié, réseau warm, angle d'approche, maturité SAFe), et une reco CV (PDF vs DOCX). Les résultats atterrissent dans la table `jobs` (174 lignes actuellement) + un récap quotidien dans `job_scans` (4 scans). Le panel hydratate depuis ces deux tables, affiche les offres ≥7 en "Hot leads" avec intel déplié, et le reste en liste dense filtrable. L'utilisateur édite **uniquement** le statut (postuler / snoozer / archiver) et les notes perso — toutes les autres colonnes sont propriété du scan Cowork. Subscribe Supabase Realtime : un nouveau scan pendant que le panel est ouvert recharge le feed transparently.

## Parcours utilisateur
1. Clic sidebar "Jobs Radar" (dans groupe Business) → Tier 2 `loadPanel("jobs")` → hydrate `window.JOBS_DATA.offers` + `.scan` depuis `jobs` + `job_scans` de la semaine.
2. **Header** : kicker "Jobs Radar · {date FR}" + stats inline ("N nouvelles · M hot leads · T au total dans le radar") + H1 descriptif.
3. **Scan banner** (4 blocs) : volumes 7j en sparkbars L→D, répartition catégorie (Produit/RTE/PgM/PjM/CoS) en barres horizontales, signal CV (split PDF/DOCX 30j avec insight textuel), actions du jour (relances auto + prep entretiens).
4. **Hot leads hero** : grid de cards larges pour les offres avec `score_total ≥ 7`. Chaque card affiche rank, score big avec tooltip décomposition, titre/boîte/meta, pitch, rubric (3 axes : Séniorité/Secteur/Impact), intel (signaux boîte + lead + réseau warm + angle d'approche), CV badge, boutons "Ouvrir le lead" (LinkedIn du contact) + "Postuler" (url offre).
5. **Filtres** : recherche texte + 3 filter groups (score hot/mid/low, rôle, statut) + tri (score / récence). Statut par défaut = "Actives" (masque archived + snoozed).
6. **Liste dense** : une offre = une ligne — score compact, titre/boîte, tags catégorie/stage/statut, pitch, rubric condensée, CV badge, kebab actions, bouton flèche pour postuler.
7. Clic sur bouton "Postuler" → `window.open(url, "_blank")` + PATCH `status=applied` + toast "Postulé · statut mis à jour". L'offre reste affichée, retagguée.
8. Menu kebab : "Snoozer 7 jours" → `status=snoozed` ; "Archiver" → `status=archived` ; "Éditer les notes" → textarea inline + bouton Enregistrer → PATCH `user_notes`.
9. **Temps réel** : si Cowork écrit un nouveau scan ou une nouvelle offre pendant que le panel est ouvert, le channel Supabase `jobs_radar_sub` déclenche un `loadPanel("jobs")` transparent + `setOffers(fresh)`.

## Fonctionnalités
- **Score 10 points décomposé** : `score_total = score_seniority (max 3) + score_sector (max 3) + score_impact (max 4) + score_bonus (0 ou 1)`. Tooltip `.jr-score-tip` sur le score hover, affiche les 4 composantes ([panel-jobs-radar.jsx:152](cockpit/panel-jobs-radar.jsx:152)).
- **Bandes de score** : `scoreBand(s) → hot (≥7) | mid (5-7) | low (<5)` piloteles couleurs (`.jr-score--hot/mid/low`) et la variante de ligne (`.jr-row--hot/mid/low`) ([panel-jobs-radar.jsx:54](cockpit/panel-jobs-radar.jsx:54)).
- **Intel à 3 niveaux de profondeur** : `intel_depth = none | light | deep`. Seul `deep` affiche la section intel complète (signaux boîte, lead, warm network, SAFe, angle). `light` affiche un bouton "Enrichir l'Intel →" disabled dans le kebab (feature V2 jamais implémentée).
- **Transform intel multi-format** : `transformJobIntel` accepte à la fois les clés Supabase (`signaux_boite`, `lead_identifie`, `reseau_warm`, `angle_approche`, `maturite_safe`) et les clés panel (`company_signals`, `lead`, `warm_network`, `angle`, `safe_maturity`) — permet d'utiliser le mock sans re-mapper ([data-loader.js:1555-1583](cockpit/lib/data-loader.js:1555)).
- **Rubric justif flexible** : `rubric_justif` peut être un array `[{axis, text}]` direct, OU un objet `{seniority, sector, impact}` (transformé en array) ([data-loader.js:1545-1553](cockpit/lib/data-loader.js:1545)).
- **Garde-fou sur patch** : `patchJobSupabase` filtre côté client pour n'envoyer QUE `status` et `user_notes`, même si le caller passe autre chose. Garde-fou front — la RLS DB `jobs_user_update` est plus permissive (`using(true) with check(true)`) ([panel-jobs-radar.jsx:15-24](cockpit/panel-jobs-radar.jsx:15)).
- **Optimistic update** : `updateJob(id, patch)` → mute `offers[]` + mute `window.JOBS_DATA.offers[idx]` + `track("jobs_action")` + PATCH async. En cas d'échec : toast "Erreur de sync — changement local uniquement" (l'override local reste, pas de rollback).
- **Realtime via Supabase channels** : `client.channel("jobs_radar_sub").on("postgres_changes", { event: "*", schema: "public", table: "jobs"/"job_scans" }, refresh)` — unique parmi les panels du cockpit. Nécessite `sb.client.channel`, no-op sinon.
- **Volumes 7j ISO-week** : `transformJobScan` calcule lundi → dimanche de la semaine courante à partir de `today`, indexe les 7 scans par `scan_date` ISO, produit le sparkbar. Si un jour manque → 0 ([data-loader.js:1617-1628](cockpit/lib/data-loader.js:1617)).
- **Actions du jour auto-calculées si scan vide** : si `todayScan.actions` est absent ou vide, le loader génère jusqu'à 2 actions "Relancer" pour les offres `applied` dont `last_seen_date >= 10j` ([data-loader.js:1658-1668](cockpit/lib/data-loader.js:1658)).
- **Ratios catégorie depuis offres actives** (pas depuis `tendances.ratios_category` du jsonb scan) — si le scan a un jsonb plus fin, il est ignoré. Décision délibérée ([data-loader.js:1630-1643](cockpit/lib/data-loader.js:1630)).
- **Signal CV bi-source** : `todayScan.signal_cv` (objet JSONB) override les calculs PDF/DOCX du loader. Sinon : ratio des 30 derniers jours d'offres par `cv_recommended` + insight textuel calculé.
- **Toast discret** : `JrToast` (role="status", aria-live="polite"), 2.4s timeout, tone ok/error ([panel-jobs-radar.jsx:71-79](cockpit/panel-jobs-radar.jsx:71)).
- **Kebab popover dismiss** : click outside + Escape fermeture via `useEffect` sur `document` mousedown/keydown ([panel-jobs-radar.jsx:84-91](cockpit/panel-jobs-radar.jsx:84)).

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
  - `.jr-hot-section` (conditionnel si `hotLeads.length > 0`) → `.jr-hot-grid` avec `<HotLeadCard>`
  - `.jr-list-section`
    - `.jr-section-head--list` → kicker + titre + `.jr-filters` (search + 3 `<FilterGroup>` + `.jr-sort`)
    - `.jr-list` OR `.jr-empty` avec liste de `<OfferRow>`
  - `<JrToast>` (conditionnel)

Route id = `"jobs"`. **Panel Tier 2** ([data-loader.js:4528](cockpit/lib/data-loader.js:4528)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelJobsRadar({ data, onNavigate })` | Composant racine — state local `offers[]` mirror de `window.JOBS_DATA.offers`, split hot/rest, 4 filtres | [panel-jobs-radar.jsx:498](cockpit/panel-jobs-radar.jsx:498) |
| `HotLeadCard({ offer, rank, ... })` | Card large avec intel déplié + angle + CTAs | [panel-jobs-radar.jsx:198](cockpit/panel-jobs-radar.jsx:198) |
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
| `transformJobIntel(intel)` | Normalise clés FR/EN (signaux_boite ↔ company_signals, etc.) | [data-loader.js:1555](cockpit/lib/data-loader.js:1555) |
| `transformJobRubric(rubric)` | Array ou objet → array `[{axis, text}]` | [data-loader.js:1545](cockpit/lib/data-loader.js:1545) |
| `transformJobScan(todayScan, last7Scans, allJobs)` | Banner shape (volumes Mon→Sun, ratios catégorie, signal CV, actions auto si vides) | [data-loader.js:1613](cockpit/lib/data-loader.js:1613) |
| `loadPanel("jobs")` case | `Promise.all` des 3 fetchs + transform + mute `JOBS_DATA.offers/scan/_raw` | [data-loader.js:4500-4513](cockpit/lib/data-loader.js:4500) |
| `daysSinceDate(dateStr)` | Age en jours depuis une date ISO | [data-loader.js:1539](cockpit/lib/data-loader.js:1539) |

## Back — sources de données

| Table | Colonnes lues / écrites | Volumétrie |
|-------|--------------------------|------------|
| `jobs` | **Read** : `id, linkedin_job_id, first_seen_date, last_seen_date, title, company, url, posted_date, role_category (produit/rte/pgm/pjm/cos), company_stage (seed/A/B/C/scale/grand_groupe), pitch, compensation, score_seniority, score_sector, score_impact, score_bonus, score_total, rubric_justif (jsonb), cv_recommended (pdf/docx), cv_reason, intel (jsonb), intel_depth (none/light/deep), status (new/to_apply/applied/snoozed/archived), user_notes, created_at, updated_at`. **Write (front PATCH whitelist)** : `status`, `user_notes`. | **174 lignes**, 3 status distincts actuellement. Trigger DB `jobs_touch_updated_at` sur UPDATE. Index `jobs_status_score_idx` + `jobs_first_seen_idx`. RLS : policy `jobs_read_public` (SELECT public — pas restreint `authenticated` comme le reste du repo !) + `jobs_user_update` (UPDATE public). |
| `job_scans` | **Read** : `id, scan_date (unique), raw_count, dedup_strict_count, processed_count, hot_leads_count, tendances (jsonb), signal_cv (jsonb), actions (jsonb), created_at`. **Write** : aucun côté front (écriture via Cowork en service_role). | **4 scans**. `dedup_strict_count` jamais consommé par le front. RLS : `job_scans_read_public` (SELECT public). |

**⚠ Écart RLS** : contrairement à la migration `006_rls_authenticated.sql` qui force `authenticated` partout, `jobs` + `job_scans` ont des policies `using (true)` sans clause `TO authenticated`. Anon peut donc lire les offres (mais nécessite quand même la `apikey` header).

## Back — pipelines qui alimentent
- **Pipeline Cowork externe** (hors repo GitHub Actions) — responsable de :
  1. Scan LinkedIn quotidien (142 offres brutes typiques → 28 pertinentes)
  2. Dedup strict via `linkedin_job_id` (UNIQUE, upsert côté scan)
  3. Scoring 10 points + rubric text par axe
  4. Enrichissement intel (boîte, lead, réseau warm via graph LinkedIn) à profondeur variable
  5. Reco CV PDF/DOCX + reason
  6. Écriture dans `jobs` (service_role key, bypass RLS) et `job_scans` (1 ligne/jour).

  Pas de workflow `.github/workflows/jobs-*.yml` : l'orchestration tourne ailleurs. Le repo ne contient que :
  - Migration DDL : [jarvis/migrations/008_jobs_radar.sql](jarvis/migrations/008_jobs_radar.sql)
  - Seed mock : [jarvis/seed/jobs_radar_mock.sql](jarvis/seed/jobs_radar_mock.sql) (7 offres + 1 scan pour dev local)
  - README : [README-jobs-radar.md](README-jobs-radar.md)
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
- **Pipelines obligatoires** : **pipeline Cowork externe**. Sans lui, les tables restent vides et le panel retombe sur le mock `data-jobs.js` (24 offres fictives).
- **Tier 1 dépendances** : aucune — entièrement self-contained en Tier 2.
- **Variables d'env / secrets** :
  - Front : clé publishable Supabase + JWT Google OAuth (même si RLS policies ici sont `using(true)`, les headers `apikey` et `Authorization` sont quand même envoyés).
  - Backend (Cowork) : `SUPABASE_SERVICE_KEY` (écriture service_role).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant les 3 fetchs parallèles.
- **Tables vides** (migration non appliquée ou scan jamais tourné) : `allJobs?.length || todayScan` est false → la condition [data-loader.js:4507](cockpit/lib/data-loader.js:4507) empêche l'assign → **le mock de `data-jobs.js` reste visible**. 24 offres fictives Alan/Qonto/etc. Contrairement à la demande "plus de fake data" appliquée à `opps`, ici le fallback est toujours actif.
- **Tous les hot leads masqués** (tous `archived` / `snoozed` ou 0 score ≥ 7) : `hotLeads.length === 0` → la section `.jr-hot-section` ne se render pas. Pas de message dédié — le hero disparaît silencieusement.
- **Liste vide après filtres** : `.jr-empty` avec icône search + "Aucune offre avec ces filtres" + sub "Essaie de relâcher un critère — ou reviens demain matin."
- **PATCH échoue** : toast `"Erreur de sync — changement local uniquement"` tone error. **Pas de rollback** — l'override local reste visible, la DB reste cohérente avec la vraie valeur. L'utilisateur peut être induit en erreur.
- **Realtime indisponible** (WebSocket bloqué, `sb.client.channel` absent) : no-op silencieux → pas de rafraîchissement auto. L'utilisateur doit recharger la page pour voir un nouveau scan.
- **`sb.patchJSON` absent** : `patchJobSupabase` return sans erreur → l'optimistic update reste local, le toast "ok" s'affiche quand même (**bug** : toast trompeur, aucun appel DB émis).
- **`intel` null** sur hot lead : `intel && (...)` guard → la section intel complète est skippée, mais la card hot reste affichée avec score + rubric.
- **`intel_depth === "light"`** : bouton "Enrichir l'Intel →" visible dans kebab mais disabled avec tooltip "Feature à venir".
- **`offer.url` vide** : bouton "Postuler" disabled. `applyToJob` return early.
- **`updated_at` jamais utilisé par le front** : colonne présente mais pas consommée.
- **Notes edit cancel** : `onCancel` ferme le textarea sans sauvegarder — le draft est perdu (pas de "sauve auto en brouillon").
- **Menu open sur une offre, scroll sur une autre** : le `ref.current.contains(e.target)` gère correctement le dismiss sur click outside.
- **Aucune reco CV calculable** (`pdfCount + docxCount === 0`) : insight "Pas encore assez d'offres pour tirer un signal CV."

## Limitations connues / TODO
- [ ] **Mock toujours affiché si tables vides** : contra-pattern vs `opps` (qui a un empty state dédié). `data-jobs.js` expose 24 offres de démo réalistes qui survivent si le scan Cowork n'a jamais tourné — risque de croire que le cockpit fonctionne alors qu'il affiche de la démo.
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
2026-04-24 — rétro-doc depuis code réel — commit `c456ac9` (feature shippée le `1bd0fb0`)
