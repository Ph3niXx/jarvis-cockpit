-- ============================================================
-- Migration 038: Once Upon a Nerd — compteurs publics des posts
-- Buffer relit chaque réseau une fois par jour : un Short à 32 vues
-- s'affichait à 0. pipelines/creator_sync.py relit aussi, à chaque run,
-- le compteur public des posts TikTok et YouTube des 14 derniers jours.
-- Voir ADR-55 dans docs/architecture/decisions.md.
-- Écriture : service_role seul. Lecture : authenticated.
-- ============================================================

CREATE TABLE IF NOT EXISTS creator_public_readings (
  post_id  text NOT NULL REFERENCES creator_posts(post_id) ON DELETE CASCADE,
  read_at  timestamptz NOT NULL,                -- heure de la collecte
  views    bigint,
  likes    bigint,
  comments bigint,                              -- TikTok seulement
  shares   bigint,                              -- TikTok seulement
  saves    bigint,                              -- TikTok : favoris
  PRIMARY KEY (post_id, read_at)
);
CREATE INDEX IF NOT EXISTS creator_public_readings_read_at_idx ON creator_public_readings (read_at DESC);

ALTER TABLE creator_public_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select" ON creator_public_readings;
CREATE POLICY "auth_select" ON creator_public_readings FOR SELECT TO authenticated USING (true);
REVOKE ALL ON creator_public_readings FROM anon;
