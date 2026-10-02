-- Link unlinked competition seasons to their org's current org-season.
--
-- Bug: three season-creation paths (competition create, and both
-- generate-fixtures handlers) inserted into `seasons` without
-- `organization_season_id`. Season-scoped reads resolve org seasons through
-- that column, so those seasons were invisible: the org dashboard rendered
-- "this season doesn't have any data yet" even though the season held teams
-- and fixtures.
--
-- The application now sets the column on insert. This backfills rows created
-- before the fix.
--
-- Matching is deliberately conservative: link to the org's CURRENT org-season
-- only when the competition season is itself current, or when its name matches
-- an existing org-season name. A season we cannot attribute confidently is left
-- NULL rather than guessed at, since a wrong link would surface one org's data
-- under another season.

-- 1. Name match: the org season shares the competition season's name.
UPDATE seasons s
SET organization_season_id = os.id
FROM competitions c
JOIN organization_seasons os
  ON os.organization_id = c.organization_id
WHERE c.id = s.competition_id
  AND os.name = s.name
  AND s.organization_season_id IS NULL;

-- 2. Current season fallback: competition season is current and the org
--    season name does not match, so link to the org's current org-season.
UPDATE seasons s
SET organization_season_id = os.id
FROM competitions c
JOIN organization_seasons os
  ON os.organization_id = c.organization_id
 AND os.is_current = true
WHERE c.id = s.competition_id
  AND s.organization_season_id IS NULL
  AND (s.is_current = true OR s.status = 'active')
  AND NOT EXISTS (
    SELECT 1 FROM organization_seasons match
    WHERE match.organization_id = c.organization_id
      AND match.name = s.name
  );

-- Verification: should return 0 rows once applied.
-- SELECT count(*) FROM seasons WHERE organization_season_id IS NULL;