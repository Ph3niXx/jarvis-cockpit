-- ============================================================
-- Migration 006: Switch RLS from anon to authenticated
-- All SELECT policies now require authenticated user.
-- Anon can no longer read anything.
-- Service_role bypasses RLS (pipelines unaffected).
-- ============================================================

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
    END LOOP;
END $$;

-- ============================================================
-- READ-ONLY tables (authenticated SELECT only)
-- ============================================================
CREATE POLICY "auth_select" ON articles        FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON daily_briefs    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON activity_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON wiki_concepts   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON signal_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON weekly_analysis          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON weekly_opportunities     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON weekly_challenges        FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON learning_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON rte_usecases    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON jarvis_conversations    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON jarvis_status_snapshot   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON profile_facts           FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON entities                FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON memories_vectors        FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON tft_match_units  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON tft_match_traits FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON tft_match_lobby  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON tft_rank_history FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Tables the FRONTEND can write to (authenticated)
-- ============================================================
CREATE POLICY "auth_select" ON business_ideas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON business_ideas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON business_ideas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select" ON user_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON user_profile FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select" ON skill_radar FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON skill_radar FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select" ON tft_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON tft_matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
