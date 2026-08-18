-- ============================================================
-- Enforce season_id on fixtures and cup_matches
-- ============================================================

-- 1. Delete orphan fixtures that have no competition_id (legacy data)
DELETE FROM fixtures WHERE competition_id IS NULL;

-- 2. Delete orphan cup_matches with no competition_id
DELETE FROM cup_matches WHERE competition_id IS NULL;

-- 3. For each competition that has fixtures but no active season,
--    auto-create a default season so backfill can succeed.
INSERT INTO seasons (competition_id, name, status, is_current, start_date)
SELECT DISTINCT
  f.competition_id,
  (EXTRACT(YEAR FROM NOW())::TEXT || '/' || (EXTRACT(YEAR FROM NOW()) + 1)::TEXT || ' Season'),
  'active',
  true,
  NOW()::DATE
FROM fixtures f
WHERE f.season_id IS NULL
  AND f.competition_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM seasons s
    WHERE s.competition_id = f.competition_id
      AND (s.is_current = true OR s.status = 'active')
  );

-- 4. Backfill fixtures: set season_id to the active season for their competition
UPDATE fixtures f
SET season_id = (
  SELECT s.id FROM seasons s
  WHERE s.competition_id = f.competition_id
    AND (s.is_current = true OR s.status = 'active')
  ORDER BY s.is_current DESC, s.created_at DESC
  LIMIT 1
)
WHERE f.season_id IS NULL
  AND f.competition_id IS NOT NULL;

-- 5. Backfill cup_matches the same way
UPDATE cup_matches cm
SET season_id = (
  SELECT s.id FROM seasons s
  WHERE s.competition_id = cm.competition_id
    AND (s.is_current = true OR s.status = 'active')
  ORDER BY s.is_current DESC, s.created_at DESC
  LIMIT 1
)
WHERE cm.season_id IS NULL
  AND cm.competition_id IS NOT NULL;

-- 6. Make season_id NOT NULL on fixtures
ALTER TABLE fixtures ALTER COLUMN season_id SET NOT NULL;

-- 7. Make season_id NOT NULL on cup_matches
ALTER TABLE cup_matches ALTER COLUMN season_id SET NOT NULL;

-- 8. Drop the SET NULL referential action so fixtures can't exist without a season
ALTER TABLE fixtures DROP CONSTRAINT IF EXISTS fixtures_season_id_fkey;
ALTER TABLE fixtures ADD CONSTRAINT fixtures_season_id_fkey
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT;

ALTER TABLE cup_matches DROP CONSTRAINT IF EXISTS cup_matches_season_id_fkey;
ALTER TABLE cup_matches ADD CONSTRAINT cup_matches_season_id_fkey
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT;

-- 9. Add a composite index for org+season queries (via competition_id)
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_season
  ON fixtures(competition_id, season_id);
