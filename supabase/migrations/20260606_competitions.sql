-- ============================================================
-- Phase 2: Competition Engine
-- ============================================================

-- 1. COMPETITIONS
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('league', 'cup', 'friendly')),
  season TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. ADD competition_id TO fixtures
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE;

-- 3. CUP MATCHES TABLE
CREATE TABLE IF NOT EXISTS cup_matches (
  id SERIAL PRIMARY KEY,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  round TEXT NOT NULL CHECK (round IN ('playoff', 'quarter', 'semi', 'final')),
  match_index INTEGER NOT NULL,
  home_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  away_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  away_from_match_id INTEGER,
  home_from_match_id INTEGER,
  home_score INTEGER,
  away_score INTEGER,
  home_et_score INTEGER,
  away_et_score INTEGER,
  home_pen_score INTEGER,
  away_pen_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed')),
  winner_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  completed_via TEXT CHECK (completed_via IN ('regular', 'extra_time', 'penalties')),
  playoff_pairing TEXT,
  date DATE,
  time TIME,
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS: competitions
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitions_read_org_members" ON competitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = competitions.organization_id
        AND user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "competitions_insert_org_admins" ON competitions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = competitions.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "competitions_update_org_admins" ON competitions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = competitions.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "competitions_delete_org_admins" ON competitions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = competitions.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- RLS: cup_matches
ALTER TABLE cup_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cup_matches_read_org_members" ON cup_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN competitions c ON c.organization_id = om.organization_id
      WHERE c.id = cup_matches.competition_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "cup_matches_write_org_admins" ON cup_matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN competitions c ON c.organization_id = om.organization_id
      WHERE c.id = cup_matches.competition_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_competitions_org_id ON competitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_competition_id ON fixtures(competition_id);
CREATE INDEX IF NOT EXISTS idx_cup_matches_competition_id ON cup_matches(competition_id);
