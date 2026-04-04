-- ============================================================
-- TFT Tracker — Supabase Migration
-- 5 tables avec RLS (SELECT, INSERT, UPDATE sur tft_matches)
-- ============================================================

-- ─── TABLE 1 : tft_matches ──────────────────────────────────

CREATE TABLE IF NOT EXISTS tft_matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    match_id TEXT NOT NULL,
    played_at TIMESTAMPTZ NOT NULL,
    game_length_s NUMERIC,
    game_version TEXT,
    set_number SMALLINT,
    set_name TEXT,
    queue_id SMALLINT,
    game_type TEXT,
    placement SMALLINT NOT NULL,
    level SMALLINT,
    gold_left SMALLINT,
    last_round SMALLINT,
    players_eliminated SMALLINT,
    total_damage INT,
    time_eliminated_s NUMERIC,
    player_score INT,
    is_win BOOLEAN,
    num_units SMALLINT,
    num_traits_active SMALLINT,
    user_note TEXT,
    user_mood TEXT,
    user_tags TEXT[],
    user_rating SMALLINT,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    raw_payload JSONB,
    UNIQUE(user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_tft_matches_played_at ON tft_matches (played_at DESC);
CREATE INDEX IF NOT EXISTS idx_tft_matches_placement ON tft_matches (placement);
CREATE INDEX IF NOT EXISTS idx_tft_matches_queue_id ON tft_matches (queue_id);
CREATE INDEX IF NOT EXISTS idx_tft_matches_set_number ON tft_matches (set_number);

ALTER TABLE tft_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tft_matches_select" ON tft_matches
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tft_matches_insert" ON tft_matches
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "tft_matches_update" ON tft_matches
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ─── TABLE 2 : tft_match_units ──────────────────────────────

CREATE TABLE IF NOT EXISTS tft_match_units (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    character_id TEXT NOT NULL,
    champion_name TEXT NOT NULL,
    tier SMALLINT,
    rarity SMALLINT,
    cost SMALLINT,
    items TEXT[],
    num_items SMALLINT
);

CREATE INDEX IF NOT EXISTS idx_tft_match_units_match_id ON tft_match_units (match_id);
CREATE INDEX IF NOT EXISTS idx_tft_match_units_champion ON tft_match_units (champion_name);
CREATE INDEX IF NOT EXISTS idx_tft_match_units_cost ON tft_match_units (cost);

ALTER TABLE tft_match_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tft_match_units_select" ON tft_match_units
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tft_match_units_insert" ON tft_match_units
    FOR INSERT WITH CHECK (user_id = auth.uid());


-- ─── TABLE 3 : tft_match_traits ─────────────────────────────

CREATE TABLE IF NOT EXISTS tft_match_traits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    trait_id TEXT NOT NULL,
    trait_name TEXT NOT NULL,
    num_units SMALLINT,
    style SMALLINT,
    tier_current SMALLINT,
    tier_total SMALLINT,
    is_active BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_tft_match_traits_match_id ON tft_match_traits (match_id);
CREATE INDEX IF NOT EXISTS idx_tft_match_traits_trait_name ON tft_match_traits (trait_name);
CREATE INDEX IF NOT EXISTS idx_tft_match_traits_is_active ON tft_match_traits (is_active);

ALTER TABLE tft_match_traits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tft_match_traits_select" ON tft_match_traits
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tft_match_traits_insert" ON tft_match_traits
    FOR INSERT WITH CHECK (user_id = auth.uid());


-- ─── TABLE 4 : tft_match_lobby ──────────────────────────────

CREATE TABLE IF NOT EXISTS tft_match_lobby (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    puuid TEXT NOT NULL,
    game_name TEXT,
    tag_line TEXT,
    placement SMALLINT,
    level SMALLINT,
    total_damage INT,
    players_eliminated SMALLINT,
    main_traits TEXT[],
    main_carry TEXT,
    num_units SMALLINT,
    UNIQUE(match_id, puuid)
);

CREATE INDEX IF NOT EXISTS idx_tft_match_lobby_match_id ON tft_match_lobby (match_id);
CREATE INDEX IF NOT EXISTS idx_tft_match_lobby_puuid ON tft_match_lobby (puuid);
CREATE INDEX IF NOT EXISTS idx_tft_match_lobby_placement ON tft_match_lobby (placement);

ALTER TABLE tft_match_lobby ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tft_match_lobby_select" ON tft_match_lobby
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tft_match_lobby_insert" ON tft_match_lobby
    FOR INSERT WITH CHECK (user_id = auth.uid());


-- ─── TABLE 5 : tft_rank_history ─────────────────────────────

CREATE TABLE IF NOT EXISTS tft_rank_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    captured_date DATE DEFAULT CURRENT_DATE,
    tier TEXT,
    rank TEXT,
    lp INT,
    wins INT,
    losses INT,
    UNIQUE(user_id, captured_date)
);

CREATE INDEX IF NOT EXISTS idx_tft_rank_history_captured_at ON tft_rank_history (captured_at DESC);

ALTER TABLE tft_rank_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tft_rank_history_select" ON tft_rank_history
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tft_rank_history_insert" ON tft_rank_history
    FOR INSERT WITH CHECK (user_id = auth.uid());
