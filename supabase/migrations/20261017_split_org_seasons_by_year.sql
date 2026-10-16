-- ============================================================
-- Split collapsed org-seasons by year
--
-- Competition seasons ("2025/2026", "2026/2027", …) are the switchable
-- seasons users create, but every one of them was linked to a single
-- auto-generated org-season named "Season <YYYY>" (created by
-- 20261016_backfill_org_season_links.sql). That collapsed the org season
-- selector and the public season picker down to one generic entry.
--
-- This migration repairs it by giving every distinct competition-season
-- name its own organization_seasons row and re-linking:
--   1. Create an org-season per distinct (org, season name) that lacks one.
--   2. Point every competition season at the org-season sharing its name.
--   3. Normalise to exactly one current org-season per org, preferring the
--      one that already owns a currently-active competition season.
--   4. Drop empty auto-generated "Season <YYYY>" placeholders left behind.
--
-- Idempotent: safe to run more than once.
-- Run AFTER 20261016_backfill_org_season_links.sql.
-- ============================================================

BEGIN;

-- 1. One org-season per distinct competition-season name.
INSERT INTO organization_seasons (organization_id, name, short_name, status, is_current)
SELECT DISTINCT c.organization_id, s.name, s.short_name, 'active', false
FROM seasons s
JOIN competitions c ON c.id = s.competition_id
WHERE NOT EXISTS (
  SELECT 1 FROM organization_seasons os
  WHERE os.organization_id = c.organization_id AND os.name = s.name
)
ON CONFLICT (organization_id, name) DO NOTHING;

-- 2. Point every competition season at the org-season with the same name.
UPDATE seasons s
SET organization_season_id = os.id
FROM competitions c
JOIN organization_seasons os
  ON os.organization_id = c.organization_id
 AND os.name = s.name
WHERE c.id = s.competition_id
  AND s.organization_season_id IS DISTINCT FROM os.id;

-- 3. Exactly one current org-season per org; prefer the one that owns an
--    already-current competition season, else the most recently created.
WITH ranked AS (
  SELECT os.id,
         ROW_NUMBER() OVER (
           PARTITION BY os.organization_id
           ORDER BY EXISTS (
             SELECT 1 FROM seasons s
             WHERE s.organization_season_id = os.id AND s.is_current = true
           ) DESC,
           os.created_at DESC,
           os.name DESC
         ) AS rn
  FROM organization_seasons os
)
UPDATE organization_seasons os
SET is_current = (ranked.rn = 1)
FROM ranked
WHERE ranked.id = os.id;

-- 4. Remove empty auto-generated placeholder org-seasons nothing links to.
DELETE FROM organization_seasons os
WHERE os.name ~ '^Season [0-9]{4}$'
  AND os.is_current = false
  AND NOT EXISTS (
    SELECT 1 FROM seasons s WHERE s.organization_season_id = os.id
  );

COMMIT;

-- ============================================================
-- Verification
--   -- No competition season should be left unlinked or collapsed:
--   SELECT s.name, os.name AS org_season
--   FROM seasons s
--   JOIN competitions c ON c.id = s.competition_id
--   LEFT JOIN organization_seasons os ON os.id = s.organization_season_id
--   ORDER BY c.organization_id, s.name;
--
--   -- Each org should expose one switchable row per season name:
--   SELECT organization_id, name, is_current
--   FROM organization_seasons ORDER BY organization_id, name;
-- ============================================================
