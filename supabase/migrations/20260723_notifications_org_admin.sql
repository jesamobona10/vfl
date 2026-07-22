-- ============================================================
-- Migration: Allow org admins to read notifications for teams
-- within their organization.
-- ============================================================

CREATE POLICY "notifications_read_org_admin" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN teams t ON t.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND t.id = notifications.team_id
    )
  );
