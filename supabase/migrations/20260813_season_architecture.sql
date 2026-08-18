-- ============================================================
-- Competition & Season Architecture — Core Data Model
--
-- Implements the competition-as-identity / season-as-data-boundary
-- model from the implementation guide:
--   Organization → Competition → Season → Season Teams →
--   Player Registrations / Fixtures / Matches → Match Events →
--   Statistics / Standings
--
-- Run BEFORE 20260812_migrate_competition_season.sql because this
-- migration adds the seasons.short_name / seasons.updated_at columns
-- that migration depends on.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SEASONS — add missing columns, constraints, statuses
-- ============================================================

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill short_name from name where empty (e.g. "2025/2026 Season")
UPDATE seasons
SET short_name = name
WHERE short_name IS NULL OR short_name = '';

-- Prevent duplicate seasons per competition (guide §8)
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_competition_name_unique;
ALTER TABLE seasons
  ADD CONSTRAINT seasons_competition_name_unique UNIQUE (competition_id, name);

-- Extend lifecycle statuses to include 'draft' (guide §23)
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_status_check;
ALTER TABLE seasons
  ADD CONSTRAINT seasons_status_check
  CHECK (status IN ('draft', 'upcoming', 'active', 'completed', 'archived'));

-- ============================================================
-- 2. COMPETITIONS — current season pointer (guide §24)
-- ============================================================

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS current_season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

-- Backfill: point each competition at its current season
UPDATE competitions c
SET current_season_id = s.id
FROM seasons s
WHERE s.competition_id = c.id
  AND s.is_current = true
  AND c.current_season_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_competitions_current_season
  ON competitions(current_season_id);

-- ============================================================
-- 3. SEASON TEAMS — season participation relationship (guide §9/§10)
-- ============================================================

CREATE TABLE IF NOT EXISTS season_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name TEXT,
  logo_url TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT season_teams_season_team_unique UNIQUE (season_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_season_teams_season_id ON season_teams(season_id);
CREATE INDEX IF NOT EXISTS idx_season_teams_team_id ON season_teams(team_id);

ALTER TABLE season_teams ENABLE ROW LEVEL SECURITY;

-- Read: org members of the competition's organization
DROP POLICY IF EXISTS "season_teams_read_org_members" ON season_teams;
CREATE POLICY "season_teams_read_org_members" ON season_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM seasons s
      JOIN competitions c ON c.id = s.competition_id
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE s.id = season_teams.season_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Write: org owner/admin of the competition's organization
DROP POLICY IF EXISTS "season_teams_write_org_admins" ON season_teams;
CREATE POLICY "season_teams_write_org_admins" ON season_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM seasons s
      JOIN competitions c ON c.id = s.competition_id
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE s.id = season_teams.season_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM seasons s
      JOIN competitions c ON c.id = s.competition_id
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE s.id = season_teams.season_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- ============================================================
-- 4. SEASON TEAM PLAYERS — season-scoped player registration (guide §11)
-- ============================================================

CREATE TABLE IF NOT EXISTS season_team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_team_id UUID NOT NULL REFERENCES season_teams(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  jersey_number INTEGER,
  position TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT season_team_players_unique UNIQUE (season_team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_season_team_players_season_team_id ON season_team_players(season_team_id);
CREATE INDEX IF NOT EXISTS idx_season_team_players_player_id ON season_team_players(player_id);

ALTER TABLE season_team_players ENABLE ROW LEVEL SECURITY;

-- Read: org members of the competition's organization (via season_teams)
DROP POLICY IF EXISTS "season_team_players_read_org_members" ON season_team_players;
CREATE POLICY "season_team_players_read_org_members" ON season_team_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM season_teams st
      JOIN seasons s ON s.id = st.season_id
      JOIN competitions c ON c.id = s.competition_id
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE st.id = season_team_players.season_team_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Write: org owner/admin of the competition's organization
DROP POLICY IF EXISTS "season_team_players_write_org_admins" ON season_team_players;
CREATE POLICY "season_team_players_write_org_admins" ON season_team_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM season_teams st
      JOIN seasons s ON s.id = st.season_id
      JOIN competitions c ON c.id = s.competition_id
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE st.id = season_team_players.season_team_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM season_teams st
      JOIN seasons s ON s.id = st.season_id
      JOIN competitions c ON c.id = s.competition_id
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE st.id = season_team_players.season_team_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- ============================================================
-- 5. MATCH EVENTS — season scoping (guide §14)
-- ============================================================

ALTER TABLE match_events
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE CASCADE;

-- Backfill: match_events belong to a fixture which belongs to a season
UPDATE match_events me
SET season_id = f.season_id
FROM fixtures f
WHERE f.id = me.match_id
  AND me.season_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_match_events_season_id ON match_events(season_id);

-- ============================================================
-- 6. RPCs — season-scoped player statistics (guide §15)
-- ============================================================

-- Goals per player within a season
CREATE OR REPLACE FUNCTION season_player_goals(season_uuid uuid)
RETURNS TABLE (player_id bigint, name text, team_id bigint, team_name text, goals bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id AS player_id,
    p.name AS name,
    p.team_id AS team_id,
    t.name AS team_name,
    COUNT(me.id)::bigint AS goals
  FROM match_events me
  JOIN players p ON p.id = me.player_id
  JOIN teams t ON t.id = p.team_id
  WHERE me.season_id = season_uuid
    AND me.event_type IN ('goal', 'penalty_goal')
  GROUP BY p.id, p.name, p.team_id, t.name
  ORDER BY goals DESC;
$$;

-- General season player stats: goals, assists, cards, appearances
CREATE OR REPLACE FUNCTION season_player_stats(season_uuid uuid)
RETURNS TABLE (
  player_id bigint,
  name text,
  team_id bigint,
  team_name text,
  goals bigint,
  assists bigint,
  yellow_cards bigint,
  red_cards bigint,
  appearances bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id AS player_id,
    p.name AS name,
    p.team_id AS team_id,
    t.name AS team_name,
    COUNT(me.id) FILTER (WHERE me.event_type IN ('goal', 'penalty_goal'))::bigint AS goals,
    COUNT(me.id) FILTER (WHERE me.event_type = 'assist')::bigint AS assists,
    COUNT(me.id) FILTER (WHERE me.event_type = 'yellow')::bigint AS yellow_cards,
    COUNT(me.id) FILTER (WHERE me.event_type = 'red')::bigint AS red_cards,
    COUNT(DISTINCT me.match_id)::bigint AS appearances
  FROM match_events me
  JOIN players p ON p.id = me.player_id
  JOIN teams t ON t.id = p.team_id
  WHERE me.season_id = season_uuid
  GROUP BY p.id, p.name, p.team_id, t.name
  ORDER BY goals DESC, assists DESC;
$$;

COMMIT;