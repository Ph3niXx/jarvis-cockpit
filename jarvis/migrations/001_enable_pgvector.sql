-- =============================================================
-- Jarvis Phase 2 — pgvector + memories_vectors
-- =============================================================
-- Execution manuelle :
--   1. Supabase Dashboard > Database > Extensions > activer "vector"
--   2. Supabase Dashboard > SQL Editor > coller ce fichier > Run
-- =============================================================

-- 1. Activer pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Table principale des chunks + embeddings
CREATE TABLE IF NOT EXISTS memories_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index SMALLINT NOT NULL DEFAULT 0,
  embedding vector(1024),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_table, source_id, chunk_index)
);

-- 3. Index vectoriel IVFFlat (cosine, lists=100 adapte a <10k vecteurs)
CREATE INDEX IF NOT EXISTS memories_vectors_embedding_idx
  ON memories_vectors
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Index btree pour filtrage par source
CREATE INDEX IF NOT EXISTS memories_vectors_source_idx
  ON memories_vectors(source_table, source_id);

-- 5. Fonction RPC de recherche semantique
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_source_table text DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_table TEXT,
  source_id TEXT,
  chunk_text TEXT,
  chunk_index SMALLINT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mv.id,
    mv.source_table,
    mv.source_id,
    mv.chunk_text,
    mv.chunk_index,
    mv.metadata,
    1 - (mv.embedding <=> query_embedding) AS similarity
  FROM memories_vectors mv
  WHERE
    (filter_source_table IS NULL OR mv.source_table = filter_source_table)
    AND 1 - (mv.embedding <=> query_embedding) > match_threshold
  ORDER BY mv.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Permissions pour appels via publishable key (anon)
GRANT EXECUTE ON FUNCTION match_memories TO anon, authenticated;

-- 7. RLS — meme pattern permissif que les autres tables cockpit
ALTER TABLE memories_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories_vectors_select" ON memories_vectors
  FOR SELECT USING (true);

CREATE POLICY "memories_vectors_insert" ON memories_vectors
  FOR INSERT WITH CHECK (true);

CREATE POLICY "memories_vectors_update" ON memories_vectors
  FOR UPDATE USING (true);

CREATE POLICY "memories_vectors_delete" ON memories_vectors
  FOR DELETE USING (true);
