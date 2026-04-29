# Prompt Claude Code — Onglet "Entraînement" (plan course adaptatif + muscu)

> Prompt généré le 2026-04-27. À coller dans une session Claude Code ouverte dans `C:\Users\johnb\jarvis-cockpit`.

---

## Contexte

Tu travailles dans le repo **jarvis-cockpit** (CLAUDE.md à la racine — lis-le d'abord). C'est un cockpit IA personnel React 18 + `@babel/standalone` (no build step) avec backend Supabase et plusieurs pipelines GitHub Actions (Strava, Withings, Last.fm, Steam, TFT, brief Gemini, weekly Claude). Auth Google OAuth + RLS `authenticated`. Conventions strictes : specs produit dans `docs/specs/` (CI bloquante `lint-specs`), architecture dans `docs/architecture/` (CI bloquante `validate-arch`), template de commit `.gitmessage`.

Ne suppose rien : lis CLAUDE.md, `cockpit/panel-forme.jsx`, `cockpit/lib/data-loader.js`, `cockpit/app.jsx`, `cockpit/nav.js`, `docs/specs/tab-perf.md`, `docs/architecture/dependencies.yaml`, et au moins une routine Cowork existante (`docs/cowork-routines/daily-mirror.md` ou `catalogue-ecosystem.md`) avant de toucher quoi que ce soit.

## Objectif

Ajouter un nouvel onglet **"Entraînement"** au cockpit. Cet onglet héberge le plan d'entraînement course (objectifs semi/marathon, séances avec assignation chaussure), le renforcement spécifique course, et la muscu. Le plan course évolue chaque semaine via une **routine Cowork scheduled** qui lit Strava et ajuste la programmation, plus un **bouton "Régénère mon plan"** côté front pour les déclenchements à la demande (test VMA, blessure, etc.).

Forme reste sur la donnée brute Strava + Withings, **inchangé**. Entraînement est un onglet sœur dans le même groupe sidebar "Personnel".

## Découpage en 3 commits successifs

Tu livres en **3 commits séparés** sur la branche courante. Stop net entre chaque commit, attends la validation utilisateur avant d'enchaîner. Chaque commit doit passer la CI locale (`scripts/lint_specs_produit.py`, `scripts/validate_architecture.py` si présents).

### Commit 1 — Fondations

1. **Migration SQL** `sql/0XX_training_tables.sql` (numéro = max(existant) + 1) avec les 5 tables ci-dessous, RLS `authenticated` (SELECT + INSERT + UPDATE, jamais DELETE côté front).
2. **Entrée nav** dans `cockpit/nav.js` : ajouter `{ id: "training", label: "Entraînement", icon: "dumbbell" /* ou équivalent */, group: "Personnel" }` à côté de l'entrée Forme.
3. **Routing** dans `cockpit/app.jsx` : ajouter la branche `else if (activePanel === "training") content = <PanelTraining ... />`.
4. **Panel** `cockpit/panel-training.jsx` avec les 3 sections (Plan course / Renforcement course / Muscu). Utilise des données mockées dans `cockpit/data-training.js` à ce stade (schéma de référence override à runtime, comme les autres `data-*.js`).
5. **Stylesheet** `cockpit/styles-training.css` (préfixe `.trn-*`, réutilise les CSS variables `--brand`, `--tx`, `--bd`, `--surface`, `--bg2` etc. pour respecter les 3 thèmes Dawn / Obsidian / Atlas).
6. **Saisie objectifs** : formulaire dans la section Plan course pour saisir `race_type` (10k/semi/marathon), `target_time_seconds`, `race_date`. Persiste dans `training_goals` via Supabase REST (auth JWT comme les autres panels).
7. **Spec produit** `docs/specs/tab-training.md` (copie `_template.md`, remplis Fonctionnalités/Parcours utilisateur en respectant la **règle éditoriale produit** de CLAUDE.md — pas de chemins de fichier, composants JSX, props, colonnes DB, jargon infra). Mets `last_updated` à la date du jour dans `docs/specs/index.json`.
8. **Architecture** `docs/architecture/dependencies.yaml` : ajouter une entrée `panels[]` pour `training` (file, reads = [training_goals, training_plans, training_sessions, strength_templates, strength_logs, strava_activities], writes = [training_goals, training_sessions, strength_templates, strength_logs]) et une entrée `tables[]` par nouvelle table avec `owner_pipeline` = `cowork_routine_plan_course` ou `manual` selon le cas, `rls = authenticated`.
9. **Télémétrie** : pas d'instrumentation au commit 1, on ajoute au commit 2.

Critère d'acceptation commit 1 : l'onglet est visible, navigable, on peut saisir un objectif semi+marathon qui persiste en base et reste après refresh. Les sections renfo/muscu affichent les mocks. CI verte.

### Commit 2 — Saisie & suivi

1. **Saisie programme muscu** : interface dans la section Muscu pour CRUD sur `strength_templates` (ajout/édition/réordonnancement d'exos par session_label). Pas de DELETE — toggle `active = false` à la place.
2. **Mode séance muscu** : bouton "Démarrer la séance" → vue avec liste d'exos cochables, pour chaque set : `reps`, `weight_kg`, optionnellement `rpe`. Submit → INSERT dans `strength_logs` avec `sets_completed` JSONB et `training_session_id` lié si une séance muscu est planifiée pour aujourd'hui.
3. **Saisie séance renfo course** : formulaire simple par séance type (gainage / PPG / mobilité) — checkbox "fait" qui POST une `training_sessions` row avec `session_type = 'renfo_course'` et `status = 'done'`.
4. **Branchement Tier 2** : dans `cockpit/lib/data-loader.js`, ajouter `case "training"` qui fetch en parallèle `training_goals` (active), `training_plans` (active), `training_sessions` 30j passés + 30j futurs, `strength_templates` (active), `strength_logs` 60j. Mute `window.TRAINING_DATA`. Wrap dans `once()` comme les autres loaders.
5. **Historique muscu** : 5 dernières séances + mini graph SVG progression sur les 3 exos avec le plus d'occurrences sur 90 jours.
6. **Télémétrie** : ajouter les events `training_session_logged` (`{ session_type, status, duration_min }`), `strength_set_logged` (`{ exercise_name, sets_count }`), `goal_saved` (`{ race_type, target_time_seconds }`). Mets à jour le tableau Télémétrie de CLAUDE.md.

Critère d'acceptation commit 2 : on peut saisir un programme muscu structuré, démarrer une séance, logger les sets, voir l'historique. Les renfo course se cochent et apparaissent dans la semaine. CI verte. Specs et `index.json` mis à jour.

### Commit 3 — Routine Cowork + intégration Strava

1. **Document routine** `docs/cowork-routines/plan-course-hebdo.md` au format des routines existantes (cadence, durée, coût estimé, enchaînement étapes en SQL/MCP, prompt de génération, contraintes de sortie, fail-safe). Cadence : hebdo dimanche 19h Europe/Paris. Modèle : Sonnet (analyse stratégique). Coût estimé < 0,10 €/run.
2. **Logique de la routine** :
   - Lit `training_goals` actifs.
   - Lit `training_plans` actif (ou décide d'en créer un si aucun).
   - Lit `training_sessions` 4 sem passées + 2 sem futures.
   - Lit `strava_activities` 30 jours (focus runs : `sport_type LIKE '%Run%'`).
   - Si pas de plan actif → crée plan macro **12 semaines** avec phases (développement / spécifique / affûtage), insère les `training_sessions` de toutes les semaines avec status=planned.
   - Sinon → analyse écart plan vs réel, ajuste les `training_sessions` de S+1 (allures cibles, distance, jour de repos, choix chaussure), met à jour `cowork_summary` + `cowork_recommendations` sur le plan courant.
   - **Règles dures** dans le prompt : `shoe = 'nimbus'` pour endurance/longue/récup, `shoe = 'megablast'` pour seuil/VMA. +10 % de volume max par semaine. Alternance dur/facile. 1 jour de repos minimum. Si charge récente trop haute (suffer_score moyen 30j > seuil) → semaine de décharge.
3. **Bouton "Régénère mon plan"** dans la section Plan course du panel : POST vers une edge function Supabase OU déclenchement manuel documenté ("ce bouton incrémente un flag, la prochaine routine Cowork lance immédiatement"). Au minimum, le bouton crée une row `training_plans` avec `generated_by = 'manual'` et `status = 'pending'` que la routine Cowork pourra picker au prochain run, OU déclenche une edge function dédiée si tu juges plus propre. Documente le choix dans la spec.
4. **Affichage Cowork** : dans la section Plan course, bloc "Analyse Cowork" qui rend `training_plans.cowork_summary` et `training_plans.cowork_recommendations` (champs `text` markdown-safe via DOMPurify si tu rends du HTML).
5. **Lien Strava → séance** : pour chaque `training_sessions` avec `status = 'planned'` et `scheduled_date <= today`, matche la `strava_activities` la plus proche en date+distance (heuristique simple : même jour, distance ±20 %, sport_type Run). Si match → renseigne `strava_activity_id` et passe `status = 'done'`. Cette logique peut tourner côté front au boot du panel OU dans la routine Cowork — choisis et documente.

Critère d'acceptation commit 3 : la routine est exécutable manuellement (depuis Cowork desktop), produit un plan macro 12 semaines cohérent quand on part de zéro, ajuste S+1 quand on relance avec un historique. Le bouton manuel fonctionne. Les séances faites sont liées à Strava automatiquement. Specs et architecture mis à jour. CI verte.

## Schéma DB complet (commit 1)

```sql
-- 0XX_training_tables.sql
-- Tables pour l'onglet Entraînement : objectifs course, plan macro, séances, programme muscu, logs muscu

-- 1. Objectifs course
CREATE TABLE training_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  race_type TEXT NOT NULL CHECK (race_type IN ('10k','semi','marathon','autre')),
  target_time_seconds INTEGER,           -- ex: 5400 = 1h30
  race_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','achieved','abandoned')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_training_goals_user_active ON training_goals(user_id, status);

-- 2. Plan macro (1 actif à la fois, historique conservé via status='archived')
CREATE TABLE training_plans (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id BIGINT REFERENCES training_goals(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  phases JSONB,                          -- [{name, weeks, focus, target_volume_km}, ...]
  cowork_summary TEXT,                   -- texte de la dernière analyse
  cowork_recommendations TEXT,           -- recommandations actionnables
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by TEXT NOT NULL DEFAULT 'manual'
    CHECK (generated_by IN ('manual','cowork')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_training_plans_user_active ON training_plans(user_id, status);

-- 3. Séances individuelles (course + renfo course + muscu unifiés)
CREATE TABLE training_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id BIGINT REFERENCES training_plans(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  session_type TEXT NOT NULL
    CHECK (session_type IN ('endurance','seuil','vma','longue','recup','renfo_course','muscu')),
  title TEXT,
  description TEXT,                      -- ex: "8x400m R200 / récup 1'"
  duration_min INTEGER,
  distance_km REAL,
  target_pace_seconds INTEGER,           -- secondes / km cible (course uniquement)
  shoe TEXT CHECK (shoe IN ('nimbus','megablast','none')),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','done','skipped','moved')),
  strava_activity_id BIGINT,             -- soft FK vers strava_activities
  perceived_effort INTEGER CHECK (perceived_effort BETWEEN 1 AND 10),
  completion_notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','cowork')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_training_sessions_user_date ON training_sessions(user_id, scheduled_date DESC);
CREATE INDEX idx_training_sessions_plan ON training_sessions(plan_id);
CREATE INDEX idx_training_sessions_status ON training_sessions(status);

-- 4. Templates muscu (programme actif)
CREATE TABLE strength_templates (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  session_label TEXT NOT NULL,           -- "Push", "Pull", "Legs", "Full body A", ...
  exercise_name TEXT NOT NULL,
  sets_target INTEGER,
  reps_target TEXT,                      -- "8-10" ou "12" (texte pour gérer les fourchettes)
  weight_target_kg REAL,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strength_templates_user_active ON strength_templates(user_id, active);

-- 5. Logs muscu (historique d'exécution)
CREATE TABLE strength_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  performed_on DATE NOT NULL,
  session_label TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  sets_completed JSONB NOT NULL,         -- [{set: 1, reps: 10, weight_kg: 60, rpe: 7}, ...]
  notes TEXT,
  training_session_id BIGINT REFERENCES training_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strength_logs_user_date ON strength_logs(user_id, performed_on DESC);
CREATE INDEX idx_strength_logs_exercise ON strength_logs(user_id, exercise_name, performed_on DESC);

-- RLS authenticated
ALTER TABLE training_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_logs ENABLE ROW LEVEL SECURITY;

-- Policies : SELECT/INSERT/UPDATE pour authenticated. Pas de DELETE exposé.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['training_goals','training_plans','training_sessions','strength_templates','strength_logs']) LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', 'auth_select_'||t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', 'auth_insert_'||t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', 'auth_update_'||t, t);
  END LOOP;
END$$;
```

> Si l'idiome du repo pour les policies diffère (ex : policies écrites une par une plutôt qu'en boucle), aligne-toi sur le style des migrations 011/012 existantes. Vérifie le pattern réel avant de coller.

## Spécifications front détaillées

### Section 1 — Plan course (priorité visuelle)

- **Bandeau objectifs** : 1 ou 2 cartes (semi, marathon) avec target time (formaté `1h30`), date de course, semaines restantes, allure cible projetée (target_time / distance_race) en min/km, et écart vs allure d'endurance Strava récente (dérivée de `strava_activities` sur 30j). Si pas d'objectif saisi → bouton "Définir un objectif".
- **Phase courante** : nom de la phase (développement / spécifique / affûtage), barre de progression sur les 12 semaines.
- **Semaine en cours (lundi → dimanche)** : grid 7 colonnes. Chaque jour montre la séance s'il y en a une : icône type, distance ou durée, allure cible, **chaussure assignée** (badge Nimbus orange / Megablast bleu, ou neutre pour muscu/renfo). Statut visuel : prévu (outline), fait (rempli + ✓), skip (barré), déplacé (icône flèche).
- **Aperçu 4 semaines suivantes** : compact, juste le total km/semaine + nom des grosses séances.
- **Bloc Analyse Cowork** : si `training_plans.cowork_summary` non vide, affiche le texte (markdown-safe). Sinon "Pas encore d'analyse, lance la routine ou clique sur Régénère".
- **Bouton "Régénère mon plan"** (commit 3) avec confirmation modale.

### Section 2 — Renforcement course

- Liste des séances types renfo (gainage, PPG, mobilité) saisies à la main par l'utilisateur. Au commit 1 : seed minimal "Gainage 15min" + "PPG runner 20min". Édition libre.
- Pour chaque séance : checkbox "fait aujourd'hui" → INSERT `training_sessions` (`session_type='renfo_course'`, `status='done'`, `scheduled_date=today`).
- Compteur de la semaine "X / Y séances faites".

### Section 3 — Muscu

- Onglets internes par `session_label` (Push / Pull / Legs ou ce que l'utilisateur définit) générés depuis `strength_templates` distincts.
- Liste des exos par session avec sets×reps×charge cible. Édition inline (ajout, modif, réordonnancement).
- Bouton "Démarrer la séance" → vue séance : pour chaque exo, 1 ligne par set avec champs `reps`, `weight_kg`, `rpe` (optionnel). Submit → INSERT dans `strength_logs`.
- Historique : 5 dernières séances avec date + label + nombre d'exos faits.
- Mini graph progression : sur les 3 exos avec le plus d'occurrences sur 90j, courbe de la `weight_kg` médiane par séance dans le temps.

## Routine Cowork — Spécification détaillée

Document à créer : `docs/cowork-routines/plan-course-hebdo.md`. Format : suis exactement la structure des routines existantes (`daily-mirror.md`, `catalogue-ecosystem.md`). Sections :

- **Cadence** : hebdomadaire dimanche 19h Europe/Paris. Première exécution : peut être déclenchée à la demande.
- **Durée estimée** : 5-8 minutes.
- **Coût** : ~0,05-0,10 € (Sonnet, ~10-20k tokens out).
- **Modèle** : Claude Sonnet 4.6.
- **Étapes** :
  1. Lire `training_goals` `WHERE status='active' AND user_id=:uid`.
  2. Lire `training_plans` `WHERE status IN ('active','pending') AND user_id=:uid ORDER BY generated_at DESC LIMIT 1`.
  3. Lire `training_sessions` `WHERE user_id=:uid AND scheduled_date BETWEEN now()-28d AND now()+14d`.
  4. Lire `strava_activities` `WHERE start_date >= now()-30d AND sport_type ILIKE '%run%'`.
  5. Construire le contexte (volume hebdo, allures moyennes par type estimé, suffer_score, écart plan vs réel).
  6. Prompt Sonnet avec contraintes dures (cf ci-dessous) → JSON structuré `{ phases, weekly_sessions: [...], summary, recommendations }`.
  7. Si pas de plan actif → INSERT `training_plans` (status='active', generated_by='cowork'), INSERT toutes les `training_sessions` du plan macro (12 sem × ~5 séances).
  8. Sinon → UPDATE `training_plans` (cowork_summary, cowork_recommendations, updated_at), UPDATE/INSERT les `training_sessions` de S+1 (UPSERT par `(user_id, scheduled_date, session_type)` pour éviter les doublons).
  9. Si flag `training_plans.status='pending'` détecté (déclenchement manuel via bouton) → traiter en priorité, passer status à `active`.
- **Contraintes du prompt** :
  - Chaussure : Nimbus pour endurance/longue/récup, Megablast pour seuil/VMA, `none` pour muscu/renfo.
  - Volume : +10 % max par semaine, sauf semaine de décharge (-30 %) toutes les 4 semaines.
  - Récup : minimum 1 jour off / semaine, ne pas enchaîner 2 séances dures.
  - Si suffer_score moyen 7j > 80 ou ratio fait/prévu < 60 % → semaine de décharge automatique.
  - Format de sortie strict (JSON schema documenté dans le .md).
- **Fail-safe** : si la lecture d'une table échoue, log et stop sans rien écrire. Si le JSON Sonnet est invalide, retry 1 fois puis abandonne.
- **Validation post-run** : ne jamais écraser une `training_sessions` avec `status IN ('done','skipped')` (l'utilisateur a déjà tracé l'historique).

## Conventions à respecter (rappel CLAUDE.md)

- **RLS** : `authenticated` partout. Service role uniquement pour les pipelines backend (la routine Cowork passe par MCP Supabase qui peut utiliser service_role selon ta config).
- **Pas de DELETE côté front** : archive via `status` ou `active=false`.
- **Spec produit** (`docs/specs/tab-training.md`) — sections Fonctionnalités et Parcours utilisateur **strictement produit** : pas de chemins de fichier, pas de noms de composants JSX, pas de `window.X_DATA`, pas de colonnes DB, pas de jargon `Tier 1/2`. Les détails techniques vont dans les sections Front et Back du même doc. La CI `lint-specs` est bloquante.
- **Architecture** (`docs/architecture/dependencies.yaml`) : ajouter le panel + les 5 tables. La CI `validate-arch` est bloquante.
- **`docs/specs/index.json`** : ajouter l'entrée `training` avec `last_updated` à la date du jour.
- **Télémétrie** (commit 2) : mettre à jour le tableau dans CLAUDE.md avec les nouveaux event_type avant le commit (règle dure).
- **Commit message** : si tu utilises `.gitmessage`, renseigne la ligne `Specs mises à jour: tab-training`.
- **Sécurité XSS** : tout HTML rendu dynamiquement (notamment `cowork_summary`) passe par DOMPurify via le helper `safe()` existant.
- **Thèmes** : tous les CSS variables (`--brand`, `--tx`, `--bd`, `--surface`, `--bg2`, `--bg3`, `--up`, `--down`) — pas de couleur en dur.
- **Babel standalone** : pas d'imports ES modules. Chaque composant s'expose sur `window.X` pour être visible des autres scripts.

## Checklist finale (à cocher avant de marquer chaque commit comme terminé)

Commit 1 :
- [ ] Migration `sql/0XX_training_tables.sql` créée et appliquée (vérifier via MCP Supabase `list_tables`)
- [ ] `cockpit/nav.js` modifié, entrée Entraînement visible dans la sidebar
- [ ] `cockpit/app.jsx` route `training`
- [ ] `cockpit/panel-training.jsx` rend les 3 sections (mocks OK pour renfo/muscu)
- [ ] `cockpit/styles-training.css` créé, respecte les 3 thèmes
- [ ] Saisie objectif fonctionne (POST + refetch)
- [ ] `docs/specs/tab-training.md` créé, conforme aux règles éditoriales (lance `python scripts/lint_specs_produit.py` localement si possible)
- [ ] `docs/specs/index.json` mis à jour
- [ ] `docs/architecture/dependencies.yaml` mis à jour, `python scripts/validate_architecture.py` passe
- [ ] CLAUDE.md : pas besoin d'update au commit 1 (pas encore d'event télémétrie)

Commit 2 :
- [ ] CRUD `strength_templates` opérationnel
- [ ] Mode séance muscu logge dans `strength_logs`
- [ ] Saisie renfo course → `training_sessions` `status='done'`
- [ ] Tier 2 loader `training` dans `data-loader.js`
- [ ] Historique muscu + mini graph
- [ ] 3 nouveaux events télémétrie ajoutés au tableau de CLAUDE.md
- [ ] Spec mise à jour, `last_updated` bumpé

Commit 3 :
- [ ] `docs/cowork-routines/plan-course-hebdo.md` complet (cadence, prompt, contraintes, fail-safe)
- [ ] Bouton "Régénère mon plan" fonctionnel (insère row `pending` ou déclenche edge function — choix documenté)
- [ ] Bloc "Analyse Cowork" affiche `cowork_summary` / `cowork_recommendations` (DOMPurify)
- [ ] Heuristique de matching Strava → `training_sessions` documentée et implémentée
- [ ] Spec et architecture mis à jour
- [ ] Test manuel : la routine tourne (depuis Cowork desktop), génère un plan macro cohérent, écrit en base

## Si tu bloques

- Un détail manque → lis le code existant (panel-forme.jsx, panel-musique.jsx ou panel-gaming.jsx pour les patterns récents).
- Doute sur une convention → CLAUDE.md fait foi, la CI tranche.
- Ambiguïté produit → demande à l'utilisateur **avant** d'inventer (assignation d'une chaussure, format d'une donnée, etc.).
- Pour la routine Cowork au commit 3 : si tu n'as pas accès au Cowork desktop pour tester, livre la routine en l'état documentée — l'utilisateur la testera depuis son client lourd.
