-- ============================================================
-- Migration: Close public RLS policies that leak cross-org data
--
-- Drops the public read policies (USING true) on teams and
-- fixtures that were left from the single-tenant era, and
-- replaces the fixtures policy with an org-membership-scoped
-- one matching the existing teams_read_org_members pattern.
--
-- /api/public/live is unaffected because it now uses the
-- service-role client, which bypasses RLS entirely.
-- ============================================================

-- 1. Drop public read policies that bypass org membership checks
DROP POLICY IF EXISTS "teams_read_public" ON teams;
DROP POLICY IF EXISTS "fixtures_read_public" ON fixtures;

-- 2. Remove superseded fixture policies from the original migration.sql
DROP POLICY IF EXISTS "fixtures_read_all_authenticated" ON fixtures;
DROP POLICY IF EXISTS "fixtures_read_for_authenticated" ON fixtures;
DROP POLICY IF EXISTS "fixtures_read_admin_or_involving_team" ON fixtures;

-- 3. Create a proper org-scoped read policy for fixtures matching
-- the teams_read_org_members pattern from 20260605_organizations.sql.
CREATE POLICY "fixtures_read_org_members" ON fixtures
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM teams t
        JOIN organization_members om ON om.organization_id = t.organization_id
        WHERE t.id = fixtures.home_team_id AND om.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM teams t
        JOIN organization_members om ON om.organization_id = t.organization_id
        WHERE t.id = fixtures.away_team_id AND om.user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    )
  );
