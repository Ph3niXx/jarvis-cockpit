-- Migration 003: Structured memory tables for Phase 3
-- jarvis_conversations: raw messages saved in real-time
-- profile_facts: structured facts extracted from conversations
-- entities: persons, projects, tools mentioned

-- ── Conversations ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jarvis_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  mode TEXT DEFAULT 'quick',
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_session ON jarvis_conversations (session_id, created_at);
CREATE INDEX idx_conversations_date ON jarvis_conversations (created_at);

ALTER TABLE jarvis_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read conversations" ON jarvis_conversations
  FOR SELECT USING (true);

CREATE POLICY "Allow anon insert conversations" ON jarvis_conversations
  FOR INSERT WITH CHECK (true);

-- ── Profile facts ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profile_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_type TEXT NOT NULL CHECK (fact_type IN ('preference', 'goal', 'context', 'personality', 'skill', 'opinion')),
  fact_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'conversation',
  confidence FLOAT DEFAULT 0.8,
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by UUID REFERENCES profile_facts(id)
);

CREATE INDEX idx_facts_active ON profile_facts (created_at DESC) WHERE superseded_by IS NULL;

ALTER TABLE profile_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read facts" ON profile_facts
  FOR SELECT USING (true);

CREATE POLICY "Allow service write facts" ON profile_facts
  FOR ALL USING (auth.role() = 'service_role');

-- Allow anon insert for server.py without service key
CREATE POLICY "Allow anon insert facts" ON profile_facts
  FOR INSERT WITH CHECK (true);

-- ── Entities ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'project', 'tool', 'company', 'concept')),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  mentions_count INT DEFAULT 1,
  first_mentioned TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_mentioned TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read entities" ON entities
  FOR SELECT USING (true);

CREATE POLICY "Allow service write entities" ON entities
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow anon insert entities" ON entities
  FOR INSERT WITH CHECK (true);
