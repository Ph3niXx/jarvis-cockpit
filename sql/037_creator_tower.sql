-- ============================================================
-- Migration 037: Once Upon a Nerd — les posts Buffer et leurs chiffres
-- Onglet « Once Upon a Nerd » (Business), pipeline pipelines/creator_sync.py.
-- Voir ADR-54 dans docs/architecture/decisions.md.
--
-- Écriture : service_role seul (le pipeline). Lecture : authenticated (le
-- propriétaire, inscriptions fermées). Aucune policy d'écriture : le front
-- ne modifie rien.
-- ============================================================

-- Un épisode = un dossier du dépôt youtuber, publié en trois posts le même jour.
CREATE TABLE IF NOT EXISTS creator_episodes (
  slug          text PRIMARY KEY,               -- ex. 001-naruto-nine-tails
  number        int  NOT NULL,
  title         text,                           -- titre YouTube du post
  video_seconds numeric,                        -- durée de la vidéo (métadonnées Buffer)
  first_due_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Un post Buffer. `episode` reste NULL pour un post qui ne vient pas du pipeline youtuber.
CREATE TABLE IF NOT EXISTS creator_posts (
  post_id    text PRIMARY KEY,                  -- id Buffer
  episode    text REFERENCES creator_episodes(slug) ON DELETE SET NULL,
  network    text NOT NULL CHECK (network IN ('tiktok','youtube','instagram')),
  status     text NOT NULL,                     -- draft | scheduled | sending | sent | error | needs_approval
  due_at     timestamptz,
  sent_at    timestamptz,
  url        text,                              -- lien du post sur le réseau, une fois publié
  error      text,
  updated_at timestamptz NOT NULL DEFAULT now() -- touché à chaque run : sonde de fraîcheur
);
CREATE INDEX IF NOT EXISTS creator_posts_episode_idx ON creator_posts (episode);

-- Un relevé = un passage quotidien de Buffer sur le réseau (`metricsUpdatedAt`).
-- Les chiffres sont cumulés depuis la publication ; les vues d'un jour sont
-- l'écart entre deux relevés.
CREATE TABLE IF NOT EXISTS creator_post_readings (
  post_id         text NOT NULL REFERENCES creator_posts(post_id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL,
  views           bigint,
  reactions       bigint,                       -- j'aime, toutes plateformes
  comments        bigint,
  shares          bigint,
  saves           bigint,                       -- Instagram
  reach           bigint,
  impressions     bigint,
  follows         bigint,                       -- abonnés gagnés par le post (Instagram)
  avg_watch_s     numeric,                      -- durée moyenne regardée (TikTok, Instagram)
  total_watch_min numeric,
  engagement_rate numeric,                      -- calculé par Buffer, en %
  metrics         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- tout ce que Buffer renvoie, tel quel
  PRIMARY KEY (post_id, read_at)
);
CREATE INDEX IF NOT EXISTS creator_post_readings_read_at_idx ON creator_post_readings (read_at DESC);

-- Abonnés lus sur les pages publiques (Buffer n'en donne pas), un relevé par jour de Paris.
CREATE TABLE IF NOT EXISTS creator_audience (
  network   text NOT NULL CHECK (network IN ('tiktok','youtube','instagram')),
  day       date NOT NULL,
  followers bigint,
  likes     bigint,                             -- TikTok : j'aime reçus par toutes les vidéos
  read_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (network, day)
);

-- RLS : lecture authenticated seule. anon n'a rien (cf. sql/036).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['creator_episodes','creator_posts','creator_post_readings','creator_audience'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_select" ON %I', t);
    EXECUTE format('CREATE POLICY "auth_select" ON %I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END $$;
