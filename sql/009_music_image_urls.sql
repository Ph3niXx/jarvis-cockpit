-- Add image_url column to the Last.fm music tables so the cockpit
-- can render real album/track cover art instead of empty tinted boxes.
--
-- Last.fm API returns an `image` array on every track / chart entry.
-- We persist the `extralarge` size (usually 300x300) as a plain URL.

ALTER TABLE music_scrobbles   ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE music_top_weekly  ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE music_loved_tracks ADD COLUMN IF NOT EXISTS image_url TEXT;
