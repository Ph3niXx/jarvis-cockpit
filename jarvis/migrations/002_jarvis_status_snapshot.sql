-- Migration 002: Jarvis project status snapshot table
-- Single-row table holding the latest project status snapshot as JSONB.
-- Frontend reads via anon key, status_generator.py writes via service_role key.

CREATE TABLE IF NOT EXISTS jarvis_status_snapshot (
  id INTEGER PRIMARY KEY DEFAULT 1,
  snapshot_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE jarvis_status_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read" ON jarvis_status_snapshot
  FOR SELECT USING (true);

CREATE POLICY "Allow service write" ON jarvis_status_snapshot
  FOR ALL USING (auth.role() = 'service_role');
