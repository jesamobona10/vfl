-- ============================================================
-- Migration: Add org admin access to players table
-- Allows organization admins (owner/admin) to SELECT, INSERT,
-- UPDATE, and DELETE players for teams within their org.
-- ============================================================

-- 1. Allow org admins to SELECT players for teams in their org
CREATE POLICY "players_select_org_admin" ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN teams t ON t.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND t.id = players.team_id
    )
  );

-- 2. Allow org admins to INSERT players for teams in their org
CREATE POLICY "players_insert_org_admin" ON players
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN teams t ON t.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND t.id = players.team_id
    )
  );

-- 3. Allow org admins to UPDATE players for teams in their org
CREATE POLICY "players_update_org_admin" ON players
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN teams t ON t.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND t.id = players.team_id
    )
  );

-- 4. Allow org admins to DELETE players for teams in their org
CREATE POLICY "players_delete_org_admin" ON players
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN teams t ON t.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND t.id = players.team_id
    )
  );
