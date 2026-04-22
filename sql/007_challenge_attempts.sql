-- ============================================================
-- Migration 007: challenge_attempts
-- One row per completed challenge attempt (quiz or practice exercise).
-- weekly_challenges reste la source des challenges générés ; ici on stocke
-- ce que l'utilisateur a fait dessus (scores, réponses, XP, date).
-- Plusieurs tentatives possibles sur un même challenge (challenge_ref).
-- ============================================================

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  challenge_ref text NOT NULL,
  challenge_source text NOT NULL DEFAULT 'fake' CHECK (challenge_source IN ('fake', 'db')),
  mode text NOT NULL CHECK (mode IN ('theory', 'practice')),
  axis text,
  title text,
  difficulty text,
  score_percent int NOT NULL CHECK (score_percent >= 0 AND score_percent <= 100),
  xp_earned int NOT NULL DEFAULT 0,
  answers jsonb,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS challenge_attempts_user_completed_idx
  ON challenge_attempts (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS challenge_attempts_user_ref_idx
  ON challenge_attempts (user_id, challenge_ref);

ALTER TABLE challenge_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON challenge_attempts;
DROP POLICY IF EXISTS "auth_insert" ON challenge_attempts;

CREATE POLICY "auth_select" ON challenge_attempts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert" ON challenge_attempts
  FOR INSERT TO authenticated WITH CHECK (true);
