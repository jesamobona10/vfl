-- ============================================================
-- Season Archive / Season Selector
-- ============================================================

-- 1. SEASONS TABLE
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADD season_id TO fixtures
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

-- 3. ADD season_id TO cup_matches
ALTER TABLE cup_matches ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

-- 4. RLS: seasons
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_read_org_members" ON seasons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN competitions c ON c.organization_id = om.organization_id
      WHERE c.id = seasons.competition_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "seasons_write_org_admins" ON seasons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN competitions c ON c.organization_id = om.organization_id
      WHERE c.id = seasons.competition_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "seasons_update_org_admins" ON seasons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN competitions c ON c.organization_id = om.organization_id
      WHERE c.id = seasons.competition_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "seasons_delete_org_admins" ON seasons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN competitions c ON c.organization_id = om.organization_id
      WHERE c.id = seasons.competition_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_seasons_competition_id ON seasons(competition_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_season_id ON fixtures(season_id);
CREATE INDEX IF NOT EXISTS idx_cup_matches_season_id ON cup_matches(season_id);
