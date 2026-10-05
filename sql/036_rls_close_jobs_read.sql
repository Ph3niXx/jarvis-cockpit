-- 036 — Fermer la lecture anonyme de jobs/job_scans, retirer TRUNCATE à anon
-- Audit sécurité du 2026-10-05. Voir ADR-53 dans docs/architecture/decisions.md.
--
-- Constat : `jobs_read_public` et `job_scans_read_public` (roles={public}, using(true))
-- laissaient n'importe qui lire, avec la seule clé publiable du dépôt public, les ~2 000
-- offres, les statuts de candidature, les notes et les verdicts saisis à la main.
-- Vérifié en live : GET /rest/v1/jobs avec la clé publiable seule → HTTP 200.
-- ADR-37 avait laissé cet arbitrage ouvert ; il est tranché ici.
--
-- Ce qui n'est PAS impacté :
--   - la routine Jobs Radar passe par le connecteur MCP Supabase (`execute_sql`),
--     donc hors PostgREST et hors RLS (docs/cowork-routines/jobs-radar.md) ;
--   - backup_supabase écrit et lit en service_role ;
--   - le front lit avec le JWT utilisateur, après waitForAuth().
-- Le rôle `authenticated` ne désigne que le propriétaire : les inscriptions sont
-- fermées sur le projet (`disable_signup: true` dans /auth/v1/settings, 1 utilisateur).

-- ── 1. jobs / job_scans : la lecture passe de `public` à `authenticated` ─────
drop policy if exists jobs_read_public      on public.jobs;
drop policy if exists job_scans_read_public on public.job_scans;

create policy jobs_read_auth on public.jobs
  for select to authenticated using (true);

create policy job_scans_read_auth on public.job_scans
  for select to authenticated using (true);

revoke select on public.jobs      from anon;
revoke select on public.job_scans from anon;

-- ── 2. TRUNCATE / REFERENCES / TRIGGER retirés à anon sur tout le schéma ─────
-- Suite d'ADR-37, qui ne l'avait fait que sur 3 tables : TRUNCATE n'est filtré par
-- aucune policy RLS. Inatteignable via PostgREST aujourd'hui, mais le défaut Supabase
-- l'accordait aux ~70 tables. Les défauts du schéma sont corrigés aussi, pour que les
-- prochaines tables naissent sans.
revoke truncate, references, trigger on all tables in schema public from anon;
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon;

-- ── 3. log_user_profile_change n'est plus exposée en RPC ─────────────────────
-- Fonction de trigger SECURITY DEFINER : Postgres ne vérifie pas EXECUTE au
-- déclenchement d'un trigger, donc la révoquer ne casse pas l'écriture de
-- user_profile ; elle sort seulement de /rest/v1/rpc (linter 0028/0029).
revoke execute on function public.log_user_profile_change() from public, anon, authenticated;

-- ── 4. search_path figé sur les 6 fonctions restantes (linter 0011) ──────────
alter function public.update_updated_at_column()          set search_path = public;
alter function public.set_updated_at()                    set search_path = public;
alter function public.claude_ecosystem_touch_updated_at() set search_path = public;
alter function public.ai_landscape_touch_updated_at()     set search_path = public;
alter function public.jobs_inherit_user_status()          set search_path = public;
alter function public.jobs_logical_key(text, text)        set search_path = public;
