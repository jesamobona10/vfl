-- ============================================================
-- Migration: player_imports audit log for bulk CSV player imports.
-- Records each bulk import for accountability: who imported, how
-- many rows, how many were created/errored, and any season link.
-- ============================================================

CREATE TABLE IF NOT EXISTS player_imports (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  created_teams INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_imports_org_created
  ON player_imports(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_imports_imported_by
  ON player_imports(imported_by);

ALTER TABLE player_imports ENABLE ROW LEVEL SECURITY;

-- Org members can read import history for their organization.
DROP POLICY IF EXISTS "player_imports_read_org_members" ON player_imports;
CREATE POLICY "player_imports_read_org_members" ON player_imports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.organization_id = player_imports.organization_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM admin_users au WHERE au.id = auth.uid()
    )
  );

-- Service role performs inserts (bypasses RLS); no direct insert policy needed.
