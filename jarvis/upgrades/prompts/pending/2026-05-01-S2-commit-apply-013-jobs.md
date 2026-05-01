# S2 — Commiter + appliquer la migration `sql/013_jobs_inherit_status.sql`

> Audit source : [2026-05-01-audit.md](../../2026-05-01-audit.md)
> Effort estimé : S (~30 min)
> North Star : filets de sécurité livrés cet automne (migration jobs trigger appliquée + claude panel restauré dans la nav) avant le prochain sprint UX.

---

```
Contexte projet : `sql/013_jobs_inherit_status.sql` est untracked depuis ≥ 2
jours. Le diff staged sur `docs/specs/tab-jobs.md` documente déjà le trigger ET
mentionne 554 lignes `jobs` (vs 174 dans la version commitée précédente),
suggérant que Jean a déjà rempli la table mais peut-être pas appliqué le
trigger en prod. Risque : repo dit "trigger appliqué" mais Supabase soit
n'a pas le trigger, soit l'a en avance sur le commit. Migration idempotente
(CREATE OR REPLACE + DROP IF EXISTS).

Phase 0 — Reconnaissance (OBLIGATOIRE avant toute action)

Avant de commiter ou appliquer quoi que ce soit, écris un rapport ~25 lignes
après ces vérifications :

1. `git status --porcelain` doit afficher (au moins) :
   - `?? sql/013_jobs_inherit_status.sql`
   - ` M docs/specs/tab-jobs.md`
   - ` M docs/specs/index.json`
   - ` M docs/cowork-routines/jobs-radar.md`
   - ` M cockpit/styles-jarvis-lab.css` (sans rapport, à laisser hors de ce SHIP)

2. `cat sql/013_jobs_inherit_status.sql` — confirmer 100% idempotence
   (CREATE OR REPLACE FUNCTION + DROP IF EXISTS TRIGGER) et absence
   d'opération destructive.

3. Vérifier l'état du trigger côté prod via MCP Supabase :
   - `mcp__6b08b413-..._list_migrations` → lister les migrations appliquées,
     repérer si `013_jobs_inherit_status` ou similaire y figure.
   - Si MCP non disponible : `mcp__6b08b413-..._execute_sql` avec :
     `SELECT tgname FROM pg_trigger WHERE tgname = 'jobs_inherit_user_status';`
     → 1 ligne = trigger déjà en prod, 0 ligne = pas appliqué.

4. Vérifier le contenu actuel de la table `jobs` :
   `mcp__6b08b413-..._execute_sql`:
   `SELECT count(*) AS total, count(*) FILTER (WHERE status = 'archived') AS archived FROM public.jobs;`
   → confirmer 554/399 (ou chiffre actuel) cohérent avec le diff `tab-jobs.md`.

5. Lis `docs/specs/tab-jobs.md` lignes 80-95 (diff staged) pour confirmer la
   description du trigger correspond exactement à la migration.

Écris un rapport et ATTENDS ma validation explicite. Le rapport doit conclure
sur 1 des 3 verdicts :
  (a) "Trigger déjà appliqué en prod, repo en retard → seul commit local
      manquant. Action : git add + commit, pas d'apply."
  (b) "Trigger pas appliqué, repo en avance → seul apply prod manquant.
      Action : commit + apply migration."
  (c) "Désynchro indéterminée (MCP Supabase non lisible) → 2 actions :
      (1) commit immédiat pour figer le repo, (2) demander à Jean de vérifier
      manuellement et d'appliquer si besoin."

Objectif : repo + prod alignés sur la migration 013.

Fichiers concernés :
- sql/013_jobs_inherit_status.sql (commit untracked)
- docs/specs/tab-jobs.md (commit modif staged)
- docs/specs/index.json (commit modif staged — bump last_updated tab-jobs)
- docs/cowork-routines/jobs-radar.md (commit modif staged)

Étapes (après validation Phase 0) :
1. Si verdict (a) ou (b) ou (c) : git add sql/013_jobs_inherit_status.sql
   docs/specs/tab-jobs.md docs/specs/index.json docs/cowork-routines/jobs-radar.md
2. NE PAS git add cockpit/styles-jarvis-lab.css (hors scope ce SHIP).
3. git commit avec message
   `feat(jobs): trigger jobs_inherit_user_status — neutralise republications LinkedIn`
4. Si verdict (b) : appliquer la migration via
   `mcp__6b08b413-..._apply_migration` avec le contenu de sql/013_*.sql
   et le nom `jobs_inherit_user_status`.
5. Si verdict (c) : NE PAS apply, écrire un message explicite à Jean dans
   le diff de commit ("MCP Supabase non lisible — vérifier manuellement et
   appliquer la migration si pg_trigger ne contient pas jobs_inherit_user_status").
6. Smoke test trigger (si appliqué dans cette session) :
   `mcp__6b08b413-..._execute_sql`:
   ```
   BEGIN;
   INSERT INTO public.jobs (linkedin_job_id, title, company, status)
   VALUES ('test-013-' || gen_random_uuid()::text, 'TEST_S2_AUDIT_REPRO',
           'TEST_S2_AUDIT_REPRO', 'archived');
   INSERT INTO public.jobs (linkedin_job_id, title, company, status)
   VALUES ('test-013-' || gen_random_uuid()::text, 'TEST_S2_AUDIT_REPRO',
           'TEST_S2_AUDIT_REPRO', 'new');
   SELECT status FROM public.jobs WHERE title = 'TEST_S2_AUDIT_REPRO'
     ORDER BY created_at DESC LIMIT 1;
   -- Expected: 'archived' (hérité du trigger)
   ROLLBACK;
   ```
   → si le SELECT retourne 'archived', trigger OK.

Contraintes :
- Pas de modification du fichier .sql (idempotence préservée).
- Pas de migration parallèle créée (014, 015...).
- Pas de DROP TABLE, pas de TRUNCATE.
- L'apply migration via MCP Supabase est idempotent (CREATE OR REPLACE).
- Smoke test entouré de BEGIN ... ROLLBACK (pas de pollution table).
- Pas de push.

Validation (lance ces commandes après modification) :
- `git log -1 --stat` → 4 fichiers : sql/013, tab-jobs.md, index.json, jobs-radar.md.
- `git status --porcelain | grep -E "sql/013|tab-jobs|index.json|jobs-radar"`
  → ne doit plus rien afficher.
- Si verdict (b) ou apply effectué : `mcp__6b08b413-..._execute_sql`
  `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = 'jobs_inherit_user_status';`
  → 1 ligne avec `tgrelid = public.jobs`.

Ne fais PAS :
- Ne touche pas à `cockpit/styles-jarvis-lab.css` ni aux 3 prompts pending v22
  (hors scope ce SHIP, K1 s'en occupe).
- N'apply pas la migration sans verdict explicite — toujours préférer le
  commit-then-apply à apply-then-commit.
- Ne push pas.

Quand c'est fait : montre le diff complet AVANT git add. git commit comme spécifié.
PAS de push.
```
