-- 035 — Jobs Radar : les issues de candidature survivent aux republications
-- Spec : docs/superpowers/specs/2026-09-24-jobs-radar-triage-design.md — ADR-52.
--
-- Le front écrit désormais `interview`, `rejected` et `ghosted` — statuts
-- ouverts par le CHECK de sql/030 et jamais écrits jusqu'ici. Le trigger de
-- sql/026 n'hérite, parmi eux, que de `applied`. Si la dédup de la routine rate
-- une republication — elle a dérivé plusieurs fois —, une offre où l'utilisateur
-- est en entretien reviendrait en `new`. Les quatre statuts de candidature sont
-- donc traités comme `applied` : hérités sans péremption, jamais forcés en
-- `archived` par une clôture. Seule la fonction change ; le trigger BEFORE
-- INSERT de 013/026 reste en place.
CREATE OR REPLACE FUNCTION public.jobs_inherit_user_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prior   RECORD;
  v_key   text;
  v_corp  text;
BEGIN
  IF NEW.title IS NULL OR NEW.company IS NULL THEN
    RETURN NEW;
  END IF;

  -- NB : on appelle la fonction plutôt que de lire NEW.logical_key — les
  -- colonnes générées sont calculées APRÈS les triggers BEFORE.
  v_key  := public.jobs_logical_key(NEW.company, NEW.title);
  v_corp := split_part(v_key, '|', 1);

  -- Garde-fou anti-sur-fusion (ADR-25) : deux employeurs masqués distincts
  -- partageraient la clé. On n'hérite alors de rien.
  IF v_corp IN ('', 'confidential', 'confidentialcareers', 'undisclosed') THEN
    RETURN NEW;
  END IF;

  SELECT status, user_notes, closed_at INTO prior
  FROM public.jobs
  WHERE logical_key = v_key
    AND (
      -- « cette annonce est morte » : décision explicite, sans péremption
      closed_at IS NOT NULL
      -- une candidature, quelle que soit son issue : ne jamais la reproposer
      OR status IN ('applied', 'interview', 'rejected', 'ghosted')
      OR (status = 'snoozed'  AND updated_at >= now() - interval '14 days')
      -- ADR-23 : n'hériter que d'un archivage qui reflète une décision USER.
      -- Le NOT LIKE exclut les auto-archivages de vieillissement (ADR-26/31).
      OR (status = 'archived' AND updated_at >= now() - interval '90 days'
          AND (user_verdict IS NOT NULL OR score_total >= 5)
          AND coalesce(user_notes, '') NOT LIKE '%auto-archive vieillissement%')
    )
  ORDER BY (closed_at IS NOT NULL) DESC,
           (status IN ('applied', 'interview', 'rejected', 'ghosted')) DESC,
           updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Une offre clôturée revient archivée, sauf une candidature : le front ne
    -- considère jamais une candidature comme morte.
    NEW.status := CASE
      WHEN prior.closed_at IS NOT NULL
       AND prior.status NOT IN ('applied', 'interview', 'rejected', 'ghosted') THEN 'archived'
      ELSE prior.status
    END;
    NEW.closed_at := coalesce(NEW.closed_at, prior.closed_at);
    IF (NEW.user_notes IS NULL OR NEW.user_notes = '') AND prior.user_notes IS NOT NULL THEN
      NEW.user_notes := prior.user_notes;
    END IF;
  END IF;

  RETURN NEW;
END $$;
