-- ============================================================
-- Migration 005: RLS lockdown
-- Fixes critical security issue: all tables were open to
-- read/write/delete via the public anon key.
--
-- Strategy:
--   SELECT  → anon allowed on all tables (cockpit reads)
--   INSERT  → anon only on business_ideas (frontend form)
--   UPDATE  → anon only on business_ideas, user_profile,
--             skill_radar, tft_matches (frontend edits)
--   DELETE  → anon blocked everywhere
--   Pipelines use service_role which bypasses RLS entirely.
-- ============================================================

-- Helper: drop all existing policies on a table
-- (Supabase doesn't have DROP POLICY IF EXISTS, so we use a DO block)

DO $$
DECLARE
    tbl TEXT;
    pol RECORD;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'articles', 'daily_briefs', 'wiki_concepts', 'signal_tracking',
            'skill_radar', 'learning_recommendations', 'weekly_challenges',
            'weekly_opportunities', 'business_ideas', 'rte_usecases',
            'weekly_analysis', 'user_profile', 'activity_briefs',
            'jarvis_conversations', 'profile_facts', 'entities',
            'jarvis_status_snapshot', 'memories_vectors',
            'tft_matches', 'tft_match_units', 'tft_match_traits',
            'tft_match_lobby', 'tft_rank_history'
        ])
    LOOP
        -- Drop all existing policies
        FOR pol IN
            SELECT policyname FROM pg_policies WHERE tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY %I ON %I', pol.policyname, tbl);
        END LOOP;

        -- Ensure RLS is enabled
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;


-- ============================================================
-- 1. READ-ONLY tables (anon can SELECT, nothing else)
-- ============================================================

-- Articles & briefs
CREATE POLICY "anon_select" ON articles        FOR SELECT USING (true);
CREATE POLICY "anon_select" ON daily_briefs    FOR SELECT USING (true);
CREATE POLICY "anon_select" ON activity_briefs FOR SELECT USING (true);

-- Wiki & signals
CREATE POLICY "anon_select" ON wiki_concepts   FOR SELECT USING (true);
CREATE POLICY "anon_select" ON signal_tracking FOR SELECT USING (true);

-- Weekly analysis outputs
CREATE POLICY "anon_select" ON weekly_analysis          FOR SELECT USING (true);
CREATE POLICY "anon_select" ON weekly_opportunities     FOR SELECT USING (true);
CREATE POLICY "anon_select" ON weekly_challenges        FOR SELECT USING (true);
CREATE POLICY "anon_select" ON learning_recommendations FOR SELECT USING (true);

-- RTE
CREATE POLICY "anon_select" ON rte_usecases FOR SELECT USING (true);

-- Jarvis internal
CREATE POLICY "anon_select" ON jarvis_conversations    FOR SELECT USING (true);
CREATE POLICY "anon_select" ON jarvis_status_snapshot   FOR SELECT USING (true);
CREATE POLICY "anon_select" ON profile_facts           FOR SELECT USING (true);
CREATE POLICY "anon_select" ON entities                FOR SELECT USING (true);
CREATE POLICY "anon_select" ON memories_vectors        FOR SELECT USING (true);

-- TFT (read-only for non-match tables)
CREATE POLICY "anon_select" ON tft_match_units  FOR SELECT USING (true);
CREATE POLICY "anon_select" ON tft_match_traits FOR SELECT USING (true);
CREATE POLICY "anon_select" ON tft_match_lobby  FOR SELECT USING (true);
CREATE POLICY "anon_select" ON tft_rank_history FOR SELECT USING (true);


-- ============================================================
-- 2. Tables the FRONTEND can write to (anon SELECT + limited writes)
-- ============================================================

-- business_ideas: frontend can INSERT and UPDATE (idea creation + editing)
CREATE POLICY "anon_select" ON business_ideas FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON business_ideas FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON business_ideas FOR UPDATE USING (true) WITH CHECK (true);

-- user_profile: frontend can UPDATE only (profile editing)
CREATE POLICY "anon_select" ON user_profile FOR SELECT USING (true);
CREATE POLICY "anon_update" ON user_profile FOR UPDATE USING (true) WITH CHECK (true);

-- skill_radar: frontend can UPDATE only (diagnostic save)
CREATE POLICY "anon_select" ON skill_radar FOR SELECT USING (true);
CREATE POLICY "anon_update" ON skill_radar FOR UPDATE USING (true) WITH CHECK (true);

-- tft_matches: frontend can UPDATE only (user notes/mood/rating)
CREATE POLICY "anon_select" ON tft_matches FOR SELECT USING (true);
CREATE POLICY "anon_update" ON tft_matches FOR UPDATE USING (true) WITH CHECK (true);


-- ============================================================
-- DONE. Service_role key bypasses RLS, so pipelines (main.py,
-- weekly_analysis.py, tft_pipeline.py, server.py) are unaffected.
-- ============================================================
