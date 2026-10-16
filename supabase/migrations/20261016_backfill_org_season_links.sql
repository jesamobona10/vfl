-- ============================================================
-- Backfill org-season links
--
-- Competition seasons are invisible to season-scoped reads
-- (resolveOrgSeasonIds, the org fixtures/teams/players endpoints)
-- unless they carry organization_season_id. Seasons created while an
-- organization had no current organization_seasons row were left with a
-- NULL link, so the org dashboard reported an empty season even though
-- teams and fixtures existed.
--
-- This migration repairs existing data:
--   1. Give every organization at least one organization_seasons row.
--   2. Normalize to exactly one current org-season per organization.
--   3. Link every competition season with a NULL organization_season_id
--      to its organization's current org-season.
--
-- Idempotent: safe to run more than once.
-- Run AFTER 20260814_organization_seasons.sql.
-- ============================================================

BEGIN;

-- 1. One org-season per organization that has none.
INSERT INTO organization_seasons (organization_id, name, short_name, status, is_current)
SELECT
  o.id,
  'Season ' || to_char(now(), 'YYYY'),
  'Season ' || to_char(now(), 'YYYY'),
  'active',
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM organization_seasons os WHERE os.organization_id = o.id
)
ON CONFLICT (organization_id, name) DO NOTHING;

-- 2. Exactly one current org-season per organization (prefer the existing
--    current row, else the most recently created).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id
           ORDER BY is_current DESC, created_at DESC
         ) AS rn
  FROM organization_seasons
)
UPDATE organization_seasons os
SET is_current = (ranked.rn = 1)
FROM ranked
WHERE ranked.id = os.id;

-- 3. Link any competition season still missing its org-season to the
--    organization's current org-season.
UPDATE seasons s
SET organization_season_id = os.id
FROM competitions c
JOIN organization_seasons os
  ON os.organization_id = c.organization_id
 AND os.is_current = true
WHERE c.id = s.competition_id
  AND s.organization_season_id IS NULL;

COMMIT;

-- ============================================================
-- Verification
--   SELECT count(*) FROM organization_seasons;
--   SELECT count(*) FROM seasons WHERE organization_season_id IS NULL;
--   SELECT organization_id, count(*) FROM organization_seasons
--     WHERE is_current GROUP BY 1 HAVING count(*) <> 1;
-- ============================================================
