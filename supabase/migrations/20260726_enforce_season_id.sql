-- ============================================================
-- Enforce season_id on fixtures and cup_matches
-- ============================================================

-- 1. Backfill any existing fixtures that lack a season_id
--    by finding the active season for their competition.
UPDATE fixtures f
SET season_id = (
  SELECT s.id FROM seasons s
  WHERE s.competition_id = f.competition_id
    AND s.is_current = true
  LIMIT 1
)
WHERE f.season_id IS NULL
  AND f.competition_id IS NOT NULL;

-- 2. Backfill cup_matches the same way
UPDATE cup_matches cm
SET season_id = (
  SELECT s.id FROM seasons s
  WHERE s.competition_id = cm.competition_id
    AND s.is_current = true
  LIMIT 1
)
WHERE cm.season_id IS NULL
  AND cm.competition_id IS NOT NULL;

-- 3. Make season_id NOT NULL on fixtures
ALTER TABLE fixtures ALTER COLUMN season_id SET NOT NULL;

-- 4. Make season_id NOT NULL on cup_matches
ALTER TABLE cup_matches ALTER COLUMN season_id SET NOT NULL;

-- 5. Drop the SET NULL referential action so fixtures can't exist without a season
ALTER TABLE fixtures DROP CONSTRAINT IF EXISTS fixtures_season_id_fkey;
ALTER TABLE fixtures ADD CONSTRAINT fixtures_season_id_fkey
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT;

ALTER TABLE cup_matches DROP CONSTRAINT IF EXISTS cup_matches_season_id_fkey;
ALTER TABLE cup_matches ADD CONSTRAINT cup_matches_season_id_fkey
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT;

-- 6. Add a composite index for org+season queries (via competition_id)
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_season
  ON fixtures(competition_id, season_id);
