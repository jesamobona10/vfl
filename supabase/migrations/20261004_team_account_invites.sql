-- ============================================================
-- Migration: team account invites (coach Google Sign-In)
--
-- Adds the invite/claim infrastructure that lets a coach sign in with Google
-- and receive a team_accounts row, replacing the old username+password
-- credential flow (retired in a later phase).
--
-- This migration only changes HOW a team_accounts row gets created. It does
-- not change authorization: ownsTeam() still resolves via
-- team_accounts.team_id, and no existing RLS policy is modified.
--
-- Two details that are load-bearing rather than cosmetic:
--
-- 1. organization_id is denormalised onto the claim. team_accounts rows only
--    resolve their org slug via the organizations FK embed, so a row created
--    without organization_id cannot reach /org/[slug]/* at all. This is the
--    same defect 20260818_backfill_team_accounts_org.sql repaired in
--    production, so the claim derives it from teams.organization_id instead
--    of trusting any caller-supplied value.
--
-- 2. The claim is a SECURITY DEFINER function rather than an INSERT from the
--    client, because team_accounts RLS only permits org admins to insert and
--    a coach is not one. It re-derives the caller's verified email from
--    auth.users itself, so the email can never be supplied by the caller.
-- ============================================================

-- ------------------------------------------------------------------
-- Table
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS team_account_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'coach' CHECK (role IN ('coach', 'assistant_coach')),
  claimed_by UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE team_account_invites IS
  'Pending coach/assistant access to a team, claimable once via Google Sign-In.';

-- One pending invite per email per organization. Repeat invites for the same
-- person are rejected rather than silently stacking.
CREATE UNIQUE INDEX IF NOT EXISTS team_account_invites_pending_unique
  ON team_account_invites (organization_id, lower(email))
  WHERE claimed_by IS NULL;

-- The claim looks up by lower(email) across organizations, so this is the
-- index that matters for sign-in latency.
CREATE INDEX IF NOT EXISTS team_account_invites_pending_email
  ON team_account_invites (lower(email))
  WHERE claimed_by IS NULL;

-- Admin listing of an organization's invites.
CREATE INDEX IF NOT EXISTS team_account_invites_org
  ON team_account_invites (organization_id);

-- ------------------------------------------------------------------
-- Row level security
--
-- Org admins manage their own organization's invites; coaches may read the
-- invites for the team they manage (used by the team settings page).
-- ------------------------------------------------------------------

ALTER TABLE team_account_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_account_invites_read_org ON team_account_invites;

CREATE POLICY team_account_invites_read_org
  ON team_account_invites
  FOR SELECT
  USING (
    public.is_super_admin()
    OR public.auth_org_role(organization_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS team_account_invites_read_own_team ON team_account_invites;

-- A coach can see who else has access to their own team. team_accounts RLS
-- already admits the caller's own row via `id = auth.uid()`, so this subquery
-- resolves without recursing.
CREATE POLICY team_account_invites_read_own_team
  ON team_account_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_accounts ta
      WHERE ta.id = auth.uid()
        AND ta.team_id = team_account_invites.team_id
    )
  );

DROP POLICY IF EXISTS team_account_invites_insert_org ON team_account_invites;

CREATE POLICY team_account_invites_insert_org
  ON team_account_invites
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR public.auth_org_role(organization_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS team_account_invites_update_org ON team_account_invites;

CREATE POLICY team_account_invites_update_org
  ON team_account_invites
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR public.auth_org_role(organization_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.auth_org_role(organization_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS team_account_invites_delete_org ON team_account_invites;

CREATE POLICY team_account_invites_delete_org
  ON team_account_invites
  FOR DELETE
  USING (
    public.is_super_admin()
    OR public.auth_org_role(organization_id) IN ('owner', 'admin')
  );

REVOKE ALL ON team_account_invites FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_account_invites TO authenticated;

-- ------------------------------------------------------------------
-- Claim
--
-- Returns one row when an invite was claimed and a team_accounts row was
-- created; zero rows otherwise (no invite, no verified email, or the caller
-- already has an account). Never raises for "nothing to claim" — that is the
-- normal case for any signed-in user without a team, and resolveSession runs
-- on every authenticated render.
--
-- The team_accounts INSERT has to live in here rather than in the caller:
-- team_accounts_insert_org_admin only admits super admins and org admins, and
-- a coach claiming their own invite is neither. Keeping both writes in one
-- SECURITY DEFINER transaction also means a failed insert rolls the invite
-- back to pending instead of burning it.
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_team_account_invite()
RETURNS TABLE (
  claimed_team_id BIGINT,
  claimed_organization_id UUID,
  claimed_invite_role TEXT,
  account_username TEXT,
  account_display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_invite public.team_account_invites;
  v_team_name TEXT;
  v_username TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Derive the email from the authenticated user. Requiring a confirmed
  -- email is what stops someone registering an unverified address that
  -- happens to match a pending invite.
  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = v_user_id
    AND u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN;
  END IF;

  -- Oldest first, so a coach invited to a single team always lands on that
  -- team. SKIP LOCKED lets concurrent requests move on to another row
  -- instead of serialising; claimed_by UNIQUE then rejects a second claim by
  -- the same user outright.
  --
  -- Every table is schema-qualified because search_path is empty.
  SELECT i.*
  INTO v_invite
  FROM public.team_account_invites i
  WHERE lower(i.email) = v_email
    AND i.claimed_by IS NULL
  ORDER BY i.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT t.name
  INTO v_team_name
  FROM public.teams t
  WHERE t.id = v_invite.team_id;

  -- The legacy login flow keyed accounts by "TEAMNAME-123"; an email address
  -- cannot collide with that shape, so a Google-claimed account can never be
  -- mistaken for an existing username/password credential during the
  -- transition before that flow is removed.
  v_username := left(v_email, 64);

  -- ON CONFLICT DO NOTHING: if the caller already has a team_accounts row
  -- they have no use for the invite, so leave it pending rather than
  -- consuming it.
  INSERT INTO public.team_accounts (
    id, username, display_name, team_id, organization_id, role, created_by
  )
  VALUES (
    v_user_id, v_username, coalesce(v_team_name, v_username),
    v_invite.team_id, v_invite.organization_id, 'team_account', v_invite.created_by
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.team_account_invites
  SET claimed_by = v_user_id,
      claimed_at = NOW()
  WHERE id = v_invite.id
    AND claimed_by IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_invite.team_id,
         v_invite.organization_id,
         v_invite.role,
         v_username,
         coalesce(v_team_name, v_username);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_team_account_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_team_account_invite() TO authenticated, service_role;
