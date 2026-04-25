-- Migration 011 — Veille Claude (routine Cowork hebdomadaire)
--
-- Table alimentée par une scheduled task Cowork qui synthétise les nouveautés
-- Claude (Code, Cowork, skills, écosystème) chaque semaine.
--
-- Sécurité :
--   - INSERT réservé service_role (Cowork via MCP Supabase, ou pipeline backend)
--   - SELECT + UPDATE pour authenticated (l'utilisateur édite status + notes
--     depuis le panel cockpit "Veille outils")
--   - DELETE interdit (append-only, on garde la trace historique)
--
-- Ce script est idempotent : la table a été créée hors-repo en amont, donc on
-- utilise IF NOT EXISTS / DO blocks partout pour pouvoir le ré-exécuter sans
-- échouer. Il documente le schéma cible final.

CREATE TABLE IF NOT EXISTS public.claude_veille (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL CHECK (category IN (
    'jarvis_applicable',
    'claude_general',
    'other_news',
    'complementary_tools',
    '_summary'
  )),
  title TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT,
  summary TEXT,
  applicability TEXT,
  how_to_apply TEXT,
  effort TEXT CHECK (effort IN ('XS','S','M','L')),
  priority TEXT CHECK (priority IN ('high','medium','low')),
  trend_context TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_progress','applied','dismissed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colonnes éventuellement manquantes (table préexistante)
ALTER TABLE public.claude_veille ADD COLUMN IF NOT EXISTS applicability TEXT;

-- Status : default + NOT NULL + CHECK (idempotent)
UPDATE public.claude_veille SET status = 'new' WHERE status IS NULL;
ALTER TABLE public.claude_veille ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE public.claude_veille ALTER COLUMN status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.claude_veille'::regclass
      AND conname = 'claude_veille_status_check'
  ) THEN
    ALTER TABLE public.claude_veille
      ADD CONSTRAINT claude_veille_status_check
      CHECK (status IN ('new','in_progress','applied','dismissed'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS claude_veille_run_date_idx
  ON public.claude_veille(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_cv_category
  ON public.claude_veille(category);
CREATE INDEX IF NOT EXISTS idx_cv_status
  ON public.claude_veille(status);
-- Dédup côté DB : empêche la routine de réinsérer un item déjà connu.
-- Le _summary hebdo n'a pas de source_url donc passe à travers le partial index.
CREATE UNIQUE INDEX IF NOT EXISTS claude_veille_source_url_uniq
  ON public.claude_veille(source_url) WHERE source_url IS NOT NULL;

-- RLS
ALTER TABLE public.claude_veille ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.claude_veille'::regclass
      AND polname = 'claude_veille_select_authenticated'
  ) THEN
    CREATE POLICY claude_veille_select_authenticated ON public.claude_veille
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.claude_veille'::regclass
      AND polname = 'claude_veille_update_authenticated'
  ) THEN
    CREATE POLICY claude_veille_update_authenticated ON public.claude_veille
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
