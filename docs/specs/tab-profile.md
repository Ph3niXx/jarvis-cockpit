# Mon profil

> Centre de contrôle du contexte personnel injecté dans les prompts LLM — 7 zones empilées affichent et éditent 6 tables (user_profile, profile_facts, entities, commitments, uncomfortable_questions, user_profile_history), avec triangulation déclaré vs observé, score de complétude, export JSON et copie du payload Claude.

## Scope
mixte

## Finalité fonctionnelle
Panel "back-office" du profil utilisateur utilisé par **tous les pipelines LLM** du cockpit :
- `get_user_context()` dans [weekly_analysis.py](weekly_analysis.py) lit `user_profile` pour injecter le contexte dans chaque prompt Claude (weekly).
- `jarvis/server.py` lit `profile_facts` pour enrichir le system prompt de chaque conversation Jarvis.
- `nightly_learner.py` écrit automatiquement dans `profile_facts` + `entities` depuis les conversations + activité Outlook.

Le panel sert à : (1) **voir** ce que Claude voit de toi (payload exact + tokens estimés), (2) **éditer** les 15 champs user_profile avec sauvegarde directe en base + historique append-only, (3) **vérifier** la cohérence entre déclaré (`user_profile`) et observé (`profile_facts`) via triangulation, (4) **gérer** une table actionnable `commitments` (objectifs + deadlines + dernier mouvement), (5) **répondre** aux "questions inconfortables" générées quand un drift est détecté, (6) **explorer** les 35 entités (gens/outils/projets) extraites automatiquement. Export JSON intégral + copie payload Claude en un clic.

## Parcours utilisateur
1. Clic sidebar "Mon profil" — le panel charge les six sources en parallèle (profil, faits appris, entités, commitments, questions inconfortables, historique).
2. Lecture du header : nom et rôle + cinq compteurs inline (dernière MAJ, faits, entités, commitments, questions) + jauge de complétude du profil.
3. Utilisation de la toolbar : recherche globale (filtre simultanément faits, entités et commitments) + trois boutons (Éditer mon profil, Copier payload Claude, Exporter JSON).
4. Si des champs utiles du profil sont manquants, une pastille liste les cinq premiers manquants cliquables pour ouvrir le drawer directement sur le champ concerné.
5. Si une question inconfortable n'est pas résolue, un bloc dédié apparaît en haut avec zone de réponse et champ de résolution à remplir.
6. Parcours vertical des sept zones numérotées :
   - **Zone 01 · Contexte Claude** : terminal listant tous les champs du profil injectés dans les prompts, avec toggle "Général / Mission". Clic sur une ligne pour éditer le champ.
   - **Zone 02 · Faits appris** : faits groupés par type (contexte / préférence / objectif / compétence / opinion / contrainte / intérêt) avec bouton "Faux" pour retirer un fait des prompts futurs.
   - **Zone 03 · Entités** : pills de filtre par type + grille des personnes, outils, projets et entreprises mentionnés, avec compteur de mentions.
   - **Zone 04 · Commitments** : table d'objectifs avec deadline, prochaine action, dernier mouvement, statut, tri stale-first ou deadline. Ajout / édition inline + bouton Archiver.
   - **Zone 05 · Triangulation** : pour chaque champ du profil, affichage des faits qui le confirment (aligné), l'infirment (drift) ou alerte de régression critique, avec top trois faits reliés.
   - **Zone 06 · Questions inconfortables** : liste triée par date, questions ouvertes avec zone de réponse, questions résolues en cartes compactées.
   - **Zone 07 · Éditeur + Historique** : drawer avec tous les champs du profil en édition inline + formulaire pour ajouter un champ custom, et à droite les vingt derniers changements avec diff before/après au clic.

## Fonctionnalités
- **Score de complétude** : pour 10 champs utiles du profil (identité, rôle, contexte entreprise, ambitions, intérêts, projets en cours, motivations, frustrations, secteurs, style d'apprentissage), une jauge en tête affiche le nombre rempli sur dix avec pourcentage et liste des premiers champs manquants cliquables pour ouvrir le drawer directement sur le champ.
- **Zone Contexte Claude** : terminal qui liste tout ce que Jarvis/Claude voit de toi quand il répond, avec un toggle « Contexte général » / « Mission · weekly » pour voir les deux payloads séparément, comptage des tokens estimés et badge fraîcheur (FRESH / STABLE / STALE) par ligne. Clic sur une ligne ouvre l'édition du champ.
- **Zone Faits appris** : tous les faits que Jarvis a extraits la nuit depuis les conversations + activité, groupés par type (contexte / préférence / objectif / compétence / opinion / contrainte / intérêt). Bouton « Faux » sur chaque fait pour le retirer des prompts futurs.
- **Zone Entités** : personnes, outils, projets et entreprises mentionnés dans les conversations, filtrables par type, avec compteur de mentions et dernière trace.
- **Zone Commitments** : table d'objectifs actionnables avec deadline, prochaine action, dernier mouvement, statut, triable par ancienneté ou deadline. Ajout / édition inline / archivage.
- **Zone Triangulation déclaré vs observé** : pour chaque champ du profil, affiche les faits extraits qui le confirment (aligné) ou l'infirment (drift / régression critique), avec top trois faits reliés.
- **Zone Questions inconfortables** : quand un drift majeur est détecté, une question challenge est posée (« ton rôle déclaré ne matche plus ce qu'on observe — qu'est-ce qui a changé ? »). Textarea de réponse + résolution qui se clôt en un clic.
- **Zone Éditeur + Historique** : drawer avec tous les champs du profil en édition inline, formulaire pour ajouter un champ custom, et à droite les vingt derniers changements du profil (avec diff before/after au clic) pour tracer l'évolution.
- **Recherche globale accent-insensitive** : un seul champ recherche qui filtre simultanément faits, entités et commitments (« prefere » matche « préfère »).
- **Copier le payload Claude** : bouton qui copie l'exact contexte envoyé aux LLM dans le presse-papiers, pour debug ou partage, avec feedback « ✓ Copié » temporaire.
- **Export JSON intégral** : bouton qui télécharge tout le profil (champs + faits + entités + commitments + questions + historique) au format JSON daté.

## Front — structure UI
Fichier : [cockpit/panel-profile.jsx](cockpit/panel-profile.jsx) — 1022 lignes, monté par [app.jsx:408](cockpit/app.jsx:408). CSS dédié : [cockpit/styles-profile.css](cockpit/styles-profile.css) — 1028 lignes, scope `pf2-*`. Ressources dans [index.html:26, 67, 92](index.html:26).

Structure DOM :
- `.pf2-wrap[data-screen-label="Profil"]`
  - `.pf2-head` — eyebrow + name + role + stats + `.pf2-head-energy` (score bar)
  - `.pf2-toolbar` — search + 3 CTAs
  - `.pf2-score-hint` (conditionnel si champs manquants)
  - `<UqBlock>` (conditionnel si `openUq` non résolu) OR `.pf2-last-uq` (identity déclarée)
  - 7 `<section class="pf2-zone">` numérotées 01-07 :
    - Zone 01 : `.pf2-toggle` (2 boutons) + `.pf2-terminal` avec `.pf2-term-line` cliquables + `.pf2-term-foot`
    - Zone 02 : `.pf2-facts` → `.pf2-fact-group` par type → `.pf2-fact-item` avec bouton Faux
    - Zone 03 : `.pf2-ent-filters` + `.pf2-ent-grid` → `.pf2-ent-card`
    - Zone 04 : `<CommitmentTable>` → `.pf2-cm-head` + `.pf2-cm` avec `<CommitmentRow>`
    - Zone 05 : `.pf2-tri-head` + `.pf2-tri` avec `.pf2-tri-row` (3 colonnes)
    - Zone 06 : `.pf2-uq-list` avec `<UqItem>`
    - Zone 07 : `.pf2-z4` grid 2 cols — drawer `.pf2-drawer` avec `.pf2-field-edit` + `<NewFieldForm>` / `.pf2-history` avec `.pf2-hist-item` expandables

Route id = `"profile"`. **Panel Tier 2** ([data-loader.js:4528](cockpit/lib/data-loader.js:4528)).

## Front — fonctions JS
| Fonction | Rôle | Fichier/ligne |
|----------|------|---------------|
| `PanelProfile({ data, onNavigate })` | Composant racine — state pour search / drawer / editing / saving / 4 listes locales | [panel-profile.jsx:148](cockpit/panel-profile.jsx:148) |
| `pfUpsertField(key, value)` | POST `/rest/v1/user_profile?on_conflict=key` avec `Prefer: resolution=merge-duplicates` | [panel-profile.jsx:83](cockpit/panel-profile.jsx:83) |
| `pfSupersedeFact(id)` | PATCH `/rest/v1/profile_facts?id=eq.X` avec `{superseded_by: id}` (auto-ref) | [panel-profile.jsx:95](cockpit/panel-profile.jsx:95) |
| `pfUpsertCommitment(payload, id)` | POST (new) ou PATCH (existing) `/rest/v1/commitments` | [panel-profile.jsx:106](cockpit/panel-profile.jsx:106) |
| `pfAnswerUQ(id, answer, resolution)` | PATCH `uncomfortable_questions` avec `{answer, resolution, resolved:true, answered_at}` | [panel-profile.jsx:118](cockpit/panel-profile.jsx:118) |
| `pfBuildClaudePayload(rows, missionMode)` | Concat `key: value\n` filtré hidden + optionnel mission_excluded | [panel-profile.jsx:134](cockpit/panel-profile.jsx:134) |
| `pfEstTokens(v)` / `pfRelTime` / `pfDaysSince` / `pfFreshness` / `pfDaysUntil` / `pfNormalize` / `pfStripAccents` | Helpers format + triangulation matching + search normalization | [panel-profile.jsx:30-91](cockpit/panel-profile.jsx:30) |
| `triangulation` useMemo | Pour chaque `contractRow`, matching mots-clés contre `localFacts` → level aligned/drift/critical | [panel-profile.jsx:229](cockpit/panel-profile.jsx:229) |
| `sortedCommits` useMemo | Calc `movement_days` + `days_to_deadline` + tri stale/deadline + filter recherche | [panel-profile.jsx:253](cockpit/panel-profile.jsx:253) |
| `factsByType` useMemo | Group `localFacts` par `fact_type`, filtre par recherche | [panel-profile.jsx:205](cockpit/panel-profile.jsx:205) |
| `startEditField(key, initialValue)` | Ouvre le drawer, seed l'editing, scroll + focus le textarea | [panel-profile.jsx:273](cockpit/panel-profile.jsx:273) |
| `handleSaveField(key)` | `pfUpsertField` + mute localRows + mute `window.PROFILE_DATA._values` + `track("profile_field_saved")` + alert si échec | [panel-profile.jsx:286](cockpit/panel-profile.jsx:286) |
| `handleAddField(key, value)` | Crée un nouveau champ via upsert | [panel-profile.jsx:312](cockpit/panel-profile.jsx:312) |
| `handleMarkFactFalse(factId)` | `confirm()` + `pfSupersedeFact` + remove du local state + mute global | [panel-profile.jsx:323](cockpit/panel-profile.jsx:323) |
| `handleSaveCommit` / `handleDeleteCommit` / `handleAnswerUQ` | Handlers wrappers autour des `pfXxx` | [panel-profile.jsx:336-366](cockpit/panel-profile.jsx:336) |
| `handleExportJSON` | Blob download des 6 tables + track | [panel-profile.jsx:368](cockpit/panel-profile.jsx:368) |
| `handleCopyPayload` | Payload Claude → clipboard + track + flash "✓ Copié" | [panel-profile.jsx:388](cockpit/panel-profile.jsx:388) |
| `UqBlock({ uq, onAnswer })` | Question inconfortable ouverte en haut | [panel-profile.jsx:798](cockpit/panel-profile.jsx:798) |
| `UqItem({ uq, onAnswer })` | Item dans zone 06, 2 variants résolu/non résolu | [panel-profile.jsx:833](cockpit/panel-profile.jsx:833) |
| `CommitmentTable({ commits, onSave, onDelete })` | Table + bouton Ajouter + gestion `creating` | [panel-profile.jsx:877](cockpit/panel-profile.jsx:877) |
| `CommitmentRow({ commit, isNew, onSave, onDelete, onCancel })` | Ligne read + form édition inline | [panel-profile.jsx:915](cockpit/panel-profile.jsx:915) |
| `NewFieldForm({ onSave, existingKeys })` | Ajoute un champ custom au drawer avec validation | [panel-profile.jsx:983](cockpit/panel-profile.jsx:983) |
| `transformProfile(rows)` | DB rows → `{key: value}` map pour `PROFILE_DATA._values` | [data-loader.js:1531](cockpit/lib/data-loader.js:1531) |
| `loadPanel("profile")` case | `Promise.all` de 6 requêtes + assign dans `PROFILE_DATA._raw/_facts/_entities/_history/_commitments/_uqs/_lastUpdated` | [data-loader.js:4383-4406](cockpit/lib/data-loader.js:4383) |
| `hydrateGlobalsFromTier1` | Pré-remplit `PROFILE_DATA._values` + `_raw` depuis les Tier 1 profileRows | [data-loader.js:4545-4555](cockpit/lib/data-loader.js:4545) |

## Back — sources de données

| Table | Colonnes lues / écrites | Volumétrie |
|-------|--------------------------|------------|
| `user_profile` | **Read** : `key, value, updated_at`. **Write (front upsert)** : POST `{key, value, updated_at}` avec `on_conflict=key`. | **15 lignes**. PK `key`. RLS : `auth_select`, `auth_insert`, `auth_update`. Trigger `trg_user_profile_history` logue chaque INSERT/UPDATE (sauf si value inchangée). |
| `profile_facts` | **Read** : `id, fact_type, fact_text, confidence, source, created_at, session_id, superseded_by` (filtré `superseded_by IS NULL`, limit 200). **Write (front PATCH)** : `superseded_by = id` (auto-ref). | **87 faits actifs**. RLS : `auth_select` + `auth_update_superseded`. Writer backend : [jarvis/nightly_learner.py:309](jarvis/nightly_learner.py:309) via `sb_post("profile_facts", rows, upsert=True)`. |
| `entities` | **Read** : `id, entity_type, name, description, mentions_count, first_mentioned, last_mentioned, metadata` (limit 80, order by mentions desc nulls last). **Write** : aucun côté front. | **35 entités**. RLS : `auth_select` seule. Writer backend : [jarvis/nightly_learner.py:313-347](jarvis/nightly_learner.py:313) (upsert avec increment de `mentions_count`). |
| `commitments` | **Read** : `id, label, deadline, next_action, last_movement, last_movement_at, status, notes, archived_at, updated_at` (filtré `archived_at IS NULL`, order by `last_movement_at` asc). **Write (front)** : POST (nouveau) / PATCH (update + champ `notes` désormais éditable) / PATCH `archived_at=now()` (archive). Pas de hard delete. | **4 commitments actifs**. RLS : `auth_select/insert/update/delete` (la policy DELETE reste installée par cohérence DB mais inutilisée). DDL versionné dans [sql/012_profile_extras.sql](sql/012_profile_extras.sql). |
| `uncomfortable_questions` | **Read** : `id, asked_at, field_target, question, triangulation (jsonb), answer, answered_at, resolution, resolved` (order by asked_at desc, limit 20). **Write (front PATCH)** : `{answer, resolution, answered_at, resolved: true}`. | **1 question** (seedée manuellement). RLS : `auth_select/insert/update`. DDL + policies désormais versionnés dans [sql/012_profile_extras.sql](sql/012_profile_extras.sql). Aucun writer Python : la copy UI a été corrigée pour refléter ça. |
| `user_profile_history` | **Read** : `id, field_key, value_before, value_after, changed_at, source, trigger_type` (order by changed_at desc, limit 60). **Write** : aucun côté front. | **19 entrées**. RLS : `auth_select` seule. Writer : **trigger DB** `trg_user_profile_history` via fonction SECURITY DEFINER `log_user_profile_change()`. DDL + trigger + function versionnés dans [sql/012_profile_extras.sql](sql/012_profile_extras.sql). |

## Back — pipelines qui alimentent
- **Jarvis nightly_learner** ([jarvis/nightly_learner.py](jarvis/nightly_learner.py)) — déclenché à minuit par scheduler asyncio dans `server.py`, OR au démarrage via `start_jarvis.bat`, OR manuellement via `POST /nightly-learner` (cf. CLAUDE.md). Sources : `jarvis_conversations`, `activity_*.jsonl` (window observer), `outlook_*.json`. Envoie chaque bloc à Qwen3-4B pour extraction JSON `{facts, entities}`, puis :
  - `save_facts(facts)` → upsert `profile_facts` avec `source`, `confidence`, `session_id`.
  - `save_entities(entities)` → upsert `entities` avec `mentions_count` incrémenté.
  - `reindex_memories_vectors` pour exposer facts+entities au RAG.
  - Checkpoint dans `jarvis_data/nightly_learner_state.json`.
- **DB trigger** : `trg_user_profile_history` sur `user_profile` → `user_profile_history`. Automatique, pas de code applicatif.
- **`weekly_analysis.py::get_user_context()`** lit `user_profile` (+ `skill_radar`) — **ne l'écrit pas**. Consumer only.
- **`jarvis/server.py`** : consumer de `profile_facts` pour injection prompt. Ne l'écrit pas directement.
- **Daily pipeline** : aucune interaction.
- **Front** : unique writer pour `user_profile` (upsert), `commitments` (CRUD), `uncomfortable_questions` (PATCH réponse), `profile_facts.superseded_by` (PATCH "Faux").

## Appels externes
- **Supabase REST (lecture)** — 6 requêtes parallèles en Tier 2 :
  - `GET /rest/v1/user_profile?order=key`
  - `GET /rest/v1/profile_facts?superseded_by=is.null&order=created_at.desc&limit=200`
  - `GET /rest/v1/entities?order=mentions_count.desc.nullslast&limit=80`
  - `GET /rest/v1/user_profile_history?order=changed_at.desc&limit=60`
  - `GET /rest/v1/commitments?archived_at=is.null&order=last_movement_at.asc`
  - `GET /rest/v1/uncomfortable_questions?order=asked_at.desc&limit=20`
- **Supabase REST (écriture)** :
  - `POST /rest/v1/user_profile?on_conflict=key` (upsert merge-duplicates).
  - `PATCH /rest/v1/profile_facts?id=eq.X` `{superseded_by}`.
  - `POST/PATCH /rest/v1/commitments` + PATCH `archived_at` pour archivage.
  - `PATCH /rest/v1/uncomfortable_questions?id=eq.X` `{answer, resolution, resolved, answered_at}`.
- **`navigator.clipboard.writeText`** : copie payload Claude.
- **Blob download** : export JSON via `URL.createObjectURL`.
- **Telemetry** : 5 events côté profil :
  - `profile_field_saved` `{key}`
  - `profile_exported` `{fields}`
  - `profile_payload_copied` `{mission}`
  - `profile_fact_superseded` `{fact_id}` — ajouté par le fix
  - `error_shown` `{context, message}` — émis systématiquement avant chaque `alert()` (6 handlers instrumentés)

## Dépendances
- **Onglets in** : sidebar "Mon profil". Aucun cross-nav entrant explicite.
- **Onglets out** : aucune navigation vers d'autres panels — le bouton "Éditer mon profil" scroll vers le drawer local.
- **Pipelines obligatoires** :
  - `nightly_learner.py` pour peupler `profile_facts` + `entities` (sinon zones 02, 03, 05 sont vides/dégradées).
  - DB trigger `trg_user_profile_history` pour peupler l'historique (installé une seule fois).
- **Tier 1 dépendances** : `raw.profileRows` pré-hydraté, sinon `loadPanel` refait le `GET user_profile`.
- **Variables d'env / secrets** :
  - Front : JWT Google OAuth + publishable key.
  - Backend : `SUPABASE_SERVICE_KEY` (nightly_learner), LM Studio endpoint local (inference Qwen3-4B).

## États & edge cases
- **Loading** : `<PanelLoader>` Tier 2 pendant les 6 fetchs. En pratique rapide (tables petites).
- **`user_profile` vide** : zone 01 affiche `<div style={{color:"#e0a05a"}}>Aucun champ user_profile. Remplis le drawer en zone 07.</div>` — pointe vers la solution.
- **`profile_facts` vide** : zone 02 affiche "Aucun fait extrait. Lance `python jarvis/nightly_learner.py`." — instruction CLI explicite.
- **Recherche ne matche rien** : zone 02 "Aucun fait ne correspond à la recherche." + zone 03 "Aucune entité ne correspond aux filtres." + commitments filtrés vides.
- **Aucun commitment** : message "Aucun commitment. [+ Ajouter]" centré avec CTA d'amorce.
- **Aucune UQ** : "Aucune question ouverte. Insère-en une directement dans la table `uncomfortable_questions` quand tu veux te challenger sur un champ." — la copy reflète désormais l'absence de pipeline auto.
- **Aucun historique** : "Aucun changement enregistré." — ne devrait jamais arriver si le trigger est installé.
- **Conflit de clé au `NewFieldForm`** : validation côté client ("Clé existe déjà") + normalisation `trim().toLowerCase().replace(/\s+/g, "_")`.
- **Upsert conflict sur update_at trigger** : `updated_at` est envoyé par le front mais le trigger DB ne le touche pas (la colonne pourrait être gérée par un trigger touch séparé, absent ici — la valeur arrive telle quelle depuis le front).
- **PATCH supersede échoue** : `track("error_shown", { context: "profile:supersede_fact", ... })` + `alert("Échec : ...")` (fix). Le fact reste visible localement au prochain reload.
- **Clé `learning_style` triangulée contre le fact existant** : match via mots-clés >3 chars — "vide" matche rarement, "build" matche "build-heavy". Suffisant pour les tests actuels.
- **`pfDeleteCommitment` jamais appelé** : hard delete disponible en policy DB + fonction JS, mais UI utilise toujours archive (PATCH `archived_at`).
- **Clipboard permission denied** : `alert("Impossible de copier : ...")`.
- **Export JSON ≥100 Mo hypothétique** : blob en mémoire, pas de stream. En pratique le payload reste <1 Mo pour 15+87+35+4+1+19 lignes.
- **Triangulation sur champ court** (ex: `location="Paris"`) : `pfNormalize` filtre les mots <4 chars donc "Paris" → `["paris"]`, mais la triangulation manquera si facts disent "basé en FR". Faux négatifs fréquents sur champs courts.
- **Erreur réseau Tier 2** : `PanelError` avec bouton Réessayer.

## Limitations connues / TODO
- [x] ~~UQ auto-générées jamais implémentées~~ — **copy corrigée** : l'intro zone 06 admet maintenant "À ajouter manuellement pour l'instant — la génération auto par le pipeline hebdo n'est pas encore branchée". L'implémentation backend reste à faire si on veut vraiment générer les UQ automatiquement (scope à part).
- [x] ~~Pas de migration SQL pour 3 tables~~ — **fixé** : [sql/012_profile_extras.sql](sql/012_profile_extras.sql) versionne `commitments` + `uncomfortable_questions` + `user_profile_history` + fonction `log_user_profile_change()` + trigger `trg_user_profile_history`. Idempotent.
- [x] ~~`alert()` sans télémétrie~~ — **fixé** : `track("error_shown", { context: "profile:<handler>", message })` systématique dans 6 handlers (`save_field`, `add_field`, `supersede_fact`, `save_commit`, `archive_commit`, `answer_uq`, `copy_payload`).
- [x] ~~Recherche asymétrique~~ — **fixé** : nouveau helper `pfStripAccents(s)` + `matchesSearch` passe les 2 côtés dans le même filtre. "prefere" matche "préfère" (vérifié preview).
- [x] ~~`pfDeleteCommitment` dead code~~ — **fixé** : fonction supprimée. La policy DB `auth_delete` reste (cohérence avec l'état prod, documentée dans 012).
- [x] ~~Champ `notes` jamais éditable~~ — **fixé** : textarea ajoutée dans `CommitmentRow` mode edit, rendu read-only `.pf2-cm-notes` en mode lecture si non-vide.
- [x] ~~`handleMarkFactFalse` ne track rien~~ — **fixé** : event `profile_fact_superseded { fact_id }` émis avant le remove local.
- [ ] **Triangulation naïve mots-clés >3 chars** : faux positif ("mcp" matche si présent comme substring), faux négatif sur synonymes ("RTE" vs "Release Train Engineer"). Pas d'embeddings même si `memories_vectors` est juste à côté.
- [ ] **History limite 60 mais affichage 20** : le fetch récupère 60 entrées, le panel n'en affiche que 20. Pas de pagination "Voir plus". Les 40 autres sont chargées pour rien. Intentionnel si on veut afficher plus au clic future.
- [ ] **`updated_at` envoyé par front** : `pfUpsertField` passe `updated_at: new Date().toISOString()` en même temps que `value`. Pas de trigger DB qui pourrait override. Si le front a un décalage horloge, timestamp faux. Fixable via trigger touch BEFORE UPDATE.
- [ ] **Score complétude hardcodé** : 10 clés dans `PF_SCORE_FIELDS`. Si l'utilisateur ajoute `hobbies` ou `constraints_health` via `NewFieldForm`, ça ne compte pas. Pas de config-driven.
- [ ] **Payload Claude sans section** : juste `key: value\n`. Ne reflète pas la structure de `get_user_context()` (qui groupe skill_radar à part, préfixe avec headers, etc.).
- [ ] **Entités : tri unique par `mentions_count` desc** — pas d'option "most recent" via `last_mentioned`.
- [ ] **Zone 03 hardcoded limit 80** : pas de "Load more" pour les entités >80.
- [ ] **Commitments sans sync temps réel** : contrairement à Jobs Radar, pas de Supabase channel. Si Jarvis devait un jour auto-pousser un commitment, le front ne le verra qu'au reload.
- [ ] **`mentions_count` des entités jamais décrémenté** : si un fact est marqué "Faux" et référençait une entité, le compteur reste stale.
- [ ] **UQ auto-gen pipeline (scope backend)** : si on veut vraiment livrer la promesse retirée, ajouter un step dans `weekly_analysis.py` qui recalcule la triangulation côté Python et insère dans `uncomfortable_questions` quand `level === "stale-critical"`. Alignement avec la logique front dans `triangulation` useMemo.

## Dernière MAJ
2026-04-24 — réécriture Parcours utilisateur en vocabulaire produit.
2026-04-24 — réécriture Fonctionnalités en vocabulaire produit.
2026-04-24 — rétro-doc + 7 correctifs appliqués (migration 012 versionnée, télémétrie `error_shown` partout, `profile_fact_superseded` tracé, recherche accent-insensitive, `notes` éditable dans commitments, copy UQ corrigée, dead code `pfDeleteCommitment` supprimé) — commit `c456ac9` (base).
