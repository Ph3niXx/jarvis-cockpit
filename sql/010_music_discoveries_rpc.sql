-- RPC: return artists whose very first scrobble lands within the last
-- p_window_days, along with their play count over the last p_recent_days.
-- This powers the "Découvertes" section of the Music panel — a list of
-- genuinely new artists, not just artists appearing in a short chart.

CREATE OR REPLACE FUNCTION music_discoveries(
  p_window_days INT DEFAULT 90,
  p_recent_days INT DEFAULT 30
)
RETURNS TABLE (
  artist_name TEXT,
  first_scrobble TIMESTAMPTZ,
  scrobbles_recent BIGINT,
  scrobbles_total BIGINT,
  image_url TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH artist_agg AS (
    SELECT
      s.artist_name,
      MIN(s.scrobbled_at) AS first_scrobble,
      COUNT(*) AS scrobbles_total,
      COUNT(*) FILTER (
        WHERE s.scrobbled_at >= NOW() - (p_recent_days || ' days')::INTERVAL
      ) AS scrobbles_recent,
      (ARRAY_AGG(s.image_url) FILTER (WHERE s.image_url IS NOT NULL))[1] AS image_url
    FROM music_scrobbles s
    WHERE s.artist_name IS NOT NULL
      AND s.artist_name <> ''
    GROUP BY s.artist_name
  )
  SELECT
    artist_name,
    first_scrobble,
    scrobbles_recent,
    scrobbles_total,
    image_url
  FROM artist_agg
  WHERE first_scrobble >= NOW() - (p_window_days || ' days')::INTERVAL
  ORDER BY scrobbles_recent DESC, scrobbles_total DESC
  LIMIT 24;
$$;

GRANT EXECUTE ON FUNCTION music_discoveries(INT, INT) TO authenticated;
