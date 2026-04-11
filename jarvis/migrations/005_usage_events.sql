-- Migration 005: Usage telemetry for cockpit UX tracking
-- Append-only table — no UPDATE/DELETE policies, enforced at RLS level.
-- Frontend uses authenticated JWT via postJSON().
-- Pipelines can query via service_role key (bypasses RLS).

CREATE TABLE IF NOT EXISTS usage_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts         timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_usage_events_ts ON usage_events (ts DESC);
CREATE INDEX idx_usage_events_type ON usage_events (event_type);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT (fire telemetry) and SELECT (read back for audits)
CREATE POLICY "auth_insert" ON usage_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_select" ON usage_events FOR SELECT TO authenticated USING (true);

-- No UPDATE or DELETE policy — append-only by design.
