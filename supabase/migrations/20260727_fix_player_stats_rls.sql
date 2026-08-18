-- ============================================================
-- Fix player_statistics RLS: replace wide-open authenticated
-- read policy with org-scoped access, and allow org-admins to
-- write stats for their own organization's players.
--
-- Also add an index on match_events.team_id for RLS perf, and
-- broaden match_events write policies to include org-admins.
-- ============================================================

-- 0. Ensure player_statistics table exists (may not have been
--    created if base migration.sql was run partially)
CREATE TABLE IF NOT EXISTS player_statistics (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  appearances INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  average_rating DOUBLE PRECISION DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS player_statistics ENABLE ROW LEVEL SECURITY;

-- 1. PLAYER STATISTICS — drop the leaky read-all policy
DROP POLICY IF EXISTS player_statistics_read_all_authenticated ON player_statistics;
CREATE POLICY player_statistics_read_org ON player_statistics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM players p
      JOIN teams t ON t.id = p.team_id
      JOIN organization_members om ON om.organization_id = t.organization_id
      WHERE p.id = player_statistics.player_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM players p
      JOIN team_accounts ta ON ta.team_id = p.team_id
      WHERE p.id = player_statistics.player_id
        AND ta.id = auth.uid()
    )
  );

-- 2. PLAYER STATISTICS — allow org-admins to write, not just super-admins
DROP POLICY IF EXISTS player_statistics_write_admin_only ON player_statistics;
CREATE POLICY player_statistics_write_org_admin ON player_statistics
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM players p
      JOIN teams t ON t.id = p.team_id
      JOIN organization_members om ON om.organization_id = t.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      WHERE p.id = player_statistics.player_id
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM players p
      JOIN teams t ON t.id = p.team_id
      JOIN organization_members om ON om.organization_id = t.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      WHERE p.id = player_statistics.player_id
    )
  );

-- 3. MATCH EVENTS — add index on team_id for RLS queries
CREATE INDEX IF NOT EXISTS idx_match_events_team_id ON match_events(team_id);

-- 4. MATCH EVENTS — broaden write policies to include org-admins
DROP POLICY IF EXISTS "match_events_write_admin_only" ON match_events;
CREATE POLICY "match_events_write_org_admin" ON match_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM teams t
      JOIN organization_members om ON om.organization_id = t.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      WHERE t.id = match_events.team_id
    )
  );

DROP POLICY IF EXISTS "match_events_update_admin_only" ON match_events;
CREATE POLICY "match_events_update_org_admin" ON match_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM teams t
      JOIN organization_members om ON om.organization_id = t.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      WHERE t.id = match_events.team_id
    )
  );

DROP POLICY IF EXISTS "match_events_delete_admin_only" ON match_events;
CREATE POLICY "match_events_delete_org_admin" ON match_events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM teams t
      JOIN organization_members om ON om.organization_id = t.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      WHERE t.id = match_events.team_id
    )
  );
