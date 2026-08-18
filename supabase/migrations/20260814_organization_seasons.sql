-- ============================================================
-- Org-Level Seasons (organization_seasons)
--
-- Competition seasons (seasons.competition_id) scope data within a
-- single competition (league/cup/friendly). This migration adds an
-- organizational umbrella so the org dashboard can select ONE period
-- (e.g. "2025/2026") and view data/events across ALL competitions
-- that fall in that period.
--
--   Organization ── 1:N ──> organization_seasons ── 1:N ──> seasons
--                                                              │
--                                              (fixtures, cup_matches,
--                                               season_teams, events)
--
-- Run AFTER 20260813_season_architecture.sql.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ORGANIZATION SEASONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('draft', 'upcoming', 'active', 'completed', 'archived')),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT organization_seasons_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_seasons_organization_id
  ON organization_seasons(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_seasons_is_current
  ON organization_seasons(organization_id) WHERE is_current = true;

ALTER TABLE organization_seasons ENABLE ROW LEVEL SECURITY;

-- Read: org members (and super admins)
DROP POLICY IF EXISTS "organization_seasons_read_org_members" ON organization_seasons;
CREATE POLICY "organization_seasons_read_org_members" ON organization_seasons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_seasons.organization_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Write: org owner/admin (and super admins)
DROP POLICY IF EXISTS "organization_seasons_write_org_admins" ON organization_seasons;
CREATE POLICY "organization_seasons_write_org_admins" ON organization_seasons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_seasons.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_seasons.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- ============================================================
-- 2. LINK COMPETITION SEASONS TO ORG SEASONS
-- ============================================================
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS organization_season_id UUID
    REFERENCES organization_seasons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_seasons_org_season_id
  ON seasons(organization_season_id);

-- ============================================================
-- 3. BACKFILL — one org season per (organization, season name)
--    grouping existing competition seasons by name. This covers
--    the common case where orgs name seasons consistently
--    ("2025/2026") across their league/cup/friendly competitions.
-- ============================================================

-- Create org seasons from distinct competition-season names per org
INSERT INTO organization_seasons (organization_id, name, short_name, status, is_current)
SELECT
  c.organization_id,
  s.name,
  s.name,
  CASE
    WHEN bool_or(s.is_current) THEN 'active'
    WHEN bool_or(s.status = 'completed') THEN 'completed'
    ELSE 'upcoming'
  END,
  bool_or(s.is_current)
FROM seasons s
JOIN competitions c ON c.id = s.competition_id
GROUP BY c.organization_id, s.name
ON CONFLICT (organization_id, name) DO NOTHING;

-- Link each competition season to its org season
UPDATE seasons s
SET organization_season_id = os.id
FROM competitions c
JOIN organization_seasons os
  ON os.organization_id = c.organization_id
WHERE c.id = s.competition_id
  AND os.name = s.name
  AND s.organization_season_id IS NULL;

-- Ensure a unique current org season per org (defensive:
-- pick the most recently created if backfill produced ties)
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

COMMIT;

-- ============================================================
-- Verification
--   SELECT count(*) FROM organization_seasons;
--   SELECT count(*) FROM seasons WHERE organization_season_id IS NULL;
--   SELECT organization_id, count(*) FROM organization_seasons GROUP BY 1;
-- ============================================================