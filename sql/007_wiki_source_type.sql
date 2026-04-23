-- Add source_type to wiki_concepts to distinguish auto-detected entries
-- (from the daily pipeline) from user-authored personal notes.
--
-- Existing rows default to 'auto' — preserves current behavior where every
-- wiki entry was treated as maintained by Jarvis.
--
-- Run once via Supabase SQL editor. Idempotent: the ADD COLUMN IF NOT EXISTS
-- guard means re-runs are safe.

ALTER TABLE wiki_concepts
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'auto'
    CHECK (source_type IN ('auto', 'perso'));

-- Optional: index on source_type for fast filtering (low cardinality, only
-- 2 values, so a partial index on 'perso' is probably more efficient than a
-- full btree — but for ≤ 10k rows a plain index is fine).
CREATE INDEX IF NOT EXISTS idx_wiki_concepts_source_type
  ON wiki_concepts (source_type);
