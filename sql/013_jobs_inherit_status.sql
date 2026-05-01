-- Migration 013 — Hérite le statut user lors d'une republication LinkedIn
--
-- Contexte :
--   LinkedIn republie certaines offres avec un nouveau `linkedin_job_id`
--   tous les 1-3 jours, sans changer le titre ni la boîte. La routine
--   Cowork dédup sur `linkedin_job_id` (clé unique), donc une republication
--   crée une nouvelle ligne avec `status='new'` même si l'utilisateur avait
--   archivé/snoozé la version précédente. Conséquence : l'offre réapparaît
--   dans le panel le lendemain, sans aucune trace que c'est la même.
--
--   Trigger BEFORE INSERT : si une ligne (lower(title), lower(company))
--   existe déjà en `archived` (≤30j) ou `snoozed` (≤7j, durée du snooze
--   tel que défini côté front), on hérite du status et des user_notes.
--   Le scoring/intel/url/dates restent ceux du nouveau scan.
--
-- Idempotent : CREATE OR REPLACE FUNCTION + DROP IF EXISTS sur le trigger.

CREATE OR REPLACE FUNCTION public.jobs_inherit_user_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prior RECORD;
BEGIN
  IF NEW.title IS NULL OR NEW.company IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, user_notes INTO prior
  FROM public.jobs
  WHERE lower(trim(title))   = lower(trim(NEW.title))
    AND lower(trim(company)) = lower(trim(NEW.company))
    AND status IN ('archived', 'snoozed')
    AND (
      (status = 'archived' AND updated_at >= now() - interval '30 days')
      OR (status = 'snoozed' AND updated_at >= now() - interval '7 days')
    )
  ORDER BY updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    NEW.status := prior.status;
    IF (NEW.user_notes IS NULL OR NEW.user_notes = '') AND prior.user_notes IS NOT NULL THEN
      NEW.user_notes := prior.user_notes;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobs_inherit_user_status ON public.jobs;
CREATE TRIGGER jobs_inherit_user_status
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_inherit_user_status();
