-- ============================================================
-- Migration 008: extend weekly_challenges pour contenu riche
-- (quiz QCM + exercices pratique évaluables).
--
-- Schéma cible :
--   mode         : 'theory' | 'practice' (NOT NULL, default 'practice' pour rows existantes)
--   content      : jsonb — { questions: [...] } pour theory
--                          { brief, constraints[], eval_criteria } pour practice
--   teaser       : text — hook court (1-2 lignes) affiché sur la carte
--   duration_min : int  — estimation de durée côté utilisateur
--   xp           : int  — XP gagnés à ≥70%
-- ============================================================

ALTER TABLE weekly_challenges
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS content jsonb,
  ADD COLUMN IF NOT EXISTS teaser text,
  ADD COLUMN IF NOT EXISTS duration_min int,
  ADD COLUMN IF NOT EXISTS xp int;

ALTER TABLE weekly_challenges
  DROP CONSTRAINT IF EXISTS weekly_challenges_mode_check;

ALTER TABLE weekly_challenges
  ADD CONSTRAINT weekly_challenges_mode_check CHECK (mode IN ('theory', 'practice'));

CREATE INDEX IF NOT EXISTS weekly_challenges_mode_week_idx
  ON weekly_challenges (mode, week_start DESC);
