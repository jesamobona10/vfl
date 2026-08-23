-- ============================================================
-- Migration: RLS hardening
--
-- 1. match_report_analyses: the SELECT policy only verified row-level
--    self-consistency (row's org matched its fixture's teams) and never
--    checked WHO was asking — every authenticated user could read every
--    organization's AI analyses. Now requires actual org membership.
--
-- 2. organization_members: INSERT/UPDATE/DELETE policies queried the same
--    table they protect, which makes Postgres abort with infinite-recursion
--    error 42P17 — they never enforced anything at runtime. They also had no
--    WITH CHECK on the new role value, allowing an org admin to promote
--    themselves to owner. Replaced with SECURITY DEFINER helpers (no
--    recursion) plus explicit anti-escalation checks.
--
-- 3. organizations: drop the world-readable anon policy and replace it with
--    a members/team-accounts-only read policy.
-- ============================================================

-- ------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER + empty search_path: safe per Supabase hardening
-- guidelines, and bypasses RLS on the tables they read so policies that
-- call them cannot recurse. They only ever reveal the CALLER's own role,
-- so EXECUTE is granted broadly but revoked from anon.
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_org_role(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT om.role
  FROM public.organization_members om
  WHERE om.organization_id = p_organization_id
    AND om.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.auth_org_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_org_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- ------------------------------------------------------------------
-- 1. match_report_analyses: real membership check
-- ------------------------------------------------------------------

DROP POLICY IF EXISTS match_report_analyses_org_select ON match_report_analyses;

CREATE POLICY match_report_analyses_org_select
  ON match_report_analyses
  FOR SELECT
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = match_report_analyses.organization_id
    )
  );

-- ------------------------------------------------------------------
-- 2. organization_members: recursion-safe, escalation-safe policies
--    Roles: ('owner', 'admin', 'coach', 'player')
-- ------------------------------------------------------------------

DROP POLICY IF EXISTS "org_members_insert_admin_or_owner" ON organization_members;
DROP POLICY IF EXISTS "org_members_update_admin_or_owner" ON organization_members;
DROP POLICY IF EXISTS "org_members_delete_admin_or_owner" ON organization_members;

-- Owners/admins may add members to their own org; granting the 'owner'
-- role requires being an owner yourself.
CREATE POLICY "org_members_insert_admin_or_owner" ON organization_members
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      public.auth_org_role(organization_id) IN ('owner', 'admin')
      AND (role <> 'owner' OR public.auth_org_role(organization_id) = 'owner')
    )
  );

-- Admins may modify non-owner rows within their org but cannot grant or
-- remove the 'owner' role; owners can manage everyone in their org.
CREATE POLICY "org_members_update_admin_or_owner" ON organization_members
  FOR UPDATE USING (
    public.is_super_admin()
    OR (
      public.auth_org_role(organization_id) IN ('owner', 'admin')
      AND (role <> 'owner' OR public.auth_org_role(organization_id) = 'owner')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.auth_org_role(organization_id) IN ('owner', 'admin')
      AND (role <> 'owner' OR public.auth_org_role(organization_id) = 'owner')
    )
  );

CREATE POLICY "org_members_delete_admin_or_owner" ON organization_members
  FOR DELETE USING (
    public.is_super_admin()
    OR (
      public.auth_org_role(organization_id) IN ('owner', 'admin')
      AND (role <> 'owner' OR public.auth_org_role(organization_id) = 'owner')
    )
  );

-- ------------------------------------------------------------------
-- 3. organizations: no more anonymous tenant enumeration.
--    Members see their own org; team accounts resolve theirs via FK.
-- ------------------------------------------------------------------

DROP POLICY IF EXISTS "orgs_read_public" ON organizations;

CREATE POLICY "orgs_read_members" ON organizations
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organizations.id
    )
    OR EXISTS (
      SELECT 1 FROM public.team_accounts ta
      WHERE ta.id = auth.uid()
        AND ta.organization_id = organizations.id
    )
  );
