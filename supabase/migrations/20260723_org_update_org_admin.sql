-- ============================================================
-- Migration: Allow org admins to update their organization profile
--
-- Adds an RLS policy so org members with role owner/admin can
-- update name, logo_url, and settings on their own organization.
-- The existing orgs_update_admin_only (super-admin only) policy
-- is kept; RLS policies are OR'd so both will work.
-- ============================================================

CREATE POLICY "orgs_update_org_admin" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
