-- ============================================================
-- Season entitlements
--
-- Billing/entitlement state for an organization's seasons, kept out
-- of the core season tables so writes can be gated in one place
-- (lib/entitlements.ts) without touching ownsTeam / RLS semantics.
--
--   organizations ── 1:N ──> season_entitlements ── 0..1 ──> organization_seasons
--
-- An entitlement with `org_season_id IS NULL` applies org-wide (every
-- season); a row with `org_season_id` set overrides it for that season.
-- Reads are never gated — only writes consult this table.
--
-- Run AFTER 20260814_organization_seasons.sql.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS season_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_season_id UUID REFERENCES organization_seasons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'expired', 'canceled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT season_entitlements_org_season_unique UNIQUE (organization_id, org_season_id)
);

-- A UNIQUE constraint treats NULLs as distinct, so add a partial index to
-- keep at most one org-wide (org_season_id IS NULL) entitlement per org.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_season_entitlements_org_wide
  ON season_entitlements(organization_id) WHERE org_season_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_season_entitlements_organization_id
  ON season_entitlements(organization_id);
CREATE INDEX IF NOT EXISTS idx_season_entitlements_org_season_id
  ON season_entitlements(org_season_id);

ALTER TABLE season_entitlements ENABLE ROW LEVEL SECURITY;

-- Read: org owners/admins (and super admins). This is billing data, so it is
-- narrower than the org-member read used for season content.
DROP POLICY IF EXISTS "season_entitlements_read_org_admins" ON season_entitlements;
CREATE POLICY "season_entitlements_read_org_admins" ON season_entitlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = season_entitlements.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Write: super admins only (orgs cannot self-provision entitlements yet).
DROP POLICY IF EXISTS "season_entitlements_write_admins" ON season_entitlements;
CREATE POLICY "season_entitlements_write_admins" ON season_entitlements
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Grandfather: every existing organization is active until billing exists,
-- so this ships with no behavior change.
INSERT INTO season_entitlements (organization_id, org_season_id, status)
SELECT id, NULL, 'active' FROM organizations
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- Verification
--   SELECT count(*) FROM season_entitlements;
--   SELECT status, count(*) FROM season_entitlements GROUP BY 1;
-- ============================================================
