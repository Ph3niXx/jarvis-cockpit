-- Phase 6: Activity briefs from window observation
-- Stores only the generated summary (raw activity data stays local)

CREATE TABLE IF NOT EXISTS activity_briefs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date       date UNIQUE NOT NULL,
  brief_html text NOT NULL DEFAULT '',
  stats      jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON activity_briefs FOR SELECT USING (true);
CREATE POLICY "service_write" ON activity_briefs FOR ALL USING (true);
