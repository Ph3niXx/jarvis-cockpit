-- Migration 006: Daily Mirror — réflexion quotidienne 19h sur l'usage du cockpit.
-- Contrepartie du brief Gemini du matin ("voici ce qu'il faut penser") : le miroir
-- du soir dit "voici comment tu as pensé aujourd'hui".
-- Alimenté par une routine Cowork remote (Claude Haiku 4.5) qui lit usage_events,
-- articles cliqués, business_ideas, strava_activities, withings_measurements,
-- daily_briefs et UPSERT une ligne par jour. Le panel front lit en authenticated.

CREATE TABLE IF NOT EXISTS daily_mirror (
  mirror_date  date PRIMARY KEY,
  summary_html text,
  stats        jsonb,
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE daily_mirror ENABLE ROW LEVEL SECURITY;

-- Front authentifié : lecture seule
CREATE POLICY "authenticated read" ON daily_mirror
  FOR SELECT TO authenticated USING (true);

-- Routine Cowork via MCP service_role : insert + update
CREATE POLICY "service_role write" ON daily_mirror
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_role update" ON daily_mirror
  FOR UPDATE TO service_role USING (true);
