-- ============================================================
-- Phase 1: Multi-Tenant Organizations
-- ============================================================

-- 1. ORGANIZATIONS (top-level tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('school', 'academy', 'club')),
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'coach', 'player')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 3. ADD org_id TO EXISTING TABLES
ALTER TABLE teams ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE team_accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. SEED DEFAULT ORGANIZATION FOR EXISTING DATA
INSERT INTO organizations (id, name, slug, type)
VALUES ('00000000-0000-0000-0000-000000000001', 'VUNA League', 'vuna-league', 'school')
ON CONFLICT (slug) DO NOTHING;

-- Assign existing teams to the default org (only if organization_id is null)
UPDATE teams SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Assign existing team_accounts to the default org
UPDATE team_accounts SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- 5. RLS POLICIES

-- Organizations: authenticated members can read their org, super admins can read all
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_read_public" ON organizations
  FOR SELECT USING (true);

CREATE POLICY "orgs_insert_admin_only" ON organizations
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "orgs_update_admin_only" ON organizations
  FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "orgs_delete_admin_only" ON organizations
  FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Organization members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_own_or_admin" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "org_members_insert_admin_or_owner" ON organization_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_members_update_admin_or_owner" ON organization_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_members_delete_admin_or_owner" ON organization_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Teams: org-scoped read/write
DROP POLICY IF EXISTS "teams_read_all_authenticated" ON teams;
DROP POLICY IF EXISTS "teams_write_admin_only" ON teams;
DROP POLICY IF EXISTS "teams_update_admin_only" ON teams;
DROP POLICY IF EXISTS "teams_delete_admin_only" ON teams;

CREATE POLICY "teams_read_org_members" ON teams
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      organization_id IS NULL
      OR EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = teams.organization_id
          AND user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    )
  );

CREATE POLICY "teams_insert_org_admin" ON teams
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = teams.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "teams_update_org_admin" ON teams
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = teams.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "teams_delete_org_admin" ON teams
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = teams.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Team accounts: org-scoped
DROP POLICY IF EXISTS "team_accounts_read_own_or_admin" ON team_accounts;
DROP POLICY IF EXISTS "team_accounts_insert_admin_only" ON team_accounts;
DROP POLICY IF EXISTS "team_accounts_update_admin_only" ON team_accounts;
DROP POLICY IF EXISTS "team_accounts_delete_admin_only" ON team_accounts;

CREATE POLICY "team_accounts_read_org" ON team_accounts
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = team_accounts.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "team_accounts_insert_org_admin" ON team_accounts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = team_accounts.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "team_accounts_update_org_admin" ON team_accounts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = team_accounts.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "team_accounts_delete_org_admin" ON team_accounts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = team_accounts.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_accounts_organization_id ON team_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
