-- ============================================================
-- Migration: Add organization_id to auth_audit_logs for
-- org-scoped audit log reading by org admins.
-- ============================================================

ALTER TABLE auth_audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_organization_id ON auth_audit_logs(organization_id);

CREATE POLICY "auth_audit_logs_org_admin_read" ON auth_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = auth_audit_logs.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );
