-- ============================================================
-- VUNA Football League — Database Schema Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. TABLES

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  rating DOUBLE PRECISION DEFAULT 6.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_accounts (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'team_account',
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  jersey_number INTEGER,
  is_captain BOOLEAN DEFAULT FALSE,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  tackles INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  rating DOUBLE PRECISION DEFAULT 0,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixtures (
  id BIGSERIAL PRIMARY KEY,
  round INTEGER NOT NULL,
  home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  date DATE,
  time TIME,
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_events (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  minute INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_lineups (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  formation TEXT NOT NULL,
  slots JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE team_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_lineups_read_admin_or_own_team" ON team_lineups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_accounts
      WHERE id = auth.uid() AND team_id = team_lineups.team_id
    )
  );

CREATE POLICY "team_lineups_insert_admin_or_own_team" ON team_lineups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_accounts
      WHERE id = auth.uid() AND team_id = team_lineups.team_id
    )
  );

CREATE POLICY "team_lineups_update_admin_or_own_team" ON team_lineups
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_accounts
      WHERE id = auth.uid() AND team_id = team_lineups.team_id
    )
  );

CREATE POLICY "team_lineups_delete_admin_or_own_team" ON team_lineups
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_accounts
      WHERE id = auth.uid() AND team_id = team_lineups.team_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_team_lineups_team_id ON team_lineups(team_id);

-- 2. INDEXES

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_round ON fixtures(round);
CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON fixtures(away_team_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_team_accounts_team ON team_accounts(team_id);

-- Player transfers audit log
CREATE TABLE IF NOT EXISTS player_transfers (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  to_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_role TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_transfers_read_admin_or_involving_team" ON player_transfers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_accounts ta
      WHERE ta.id = auth.uid() AND (ta.team_id = player_transfers.from_team_id OR ta.team_id = player_transfers.to_team_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_player_transfers_player_id ON player_transfers(player_id);
CREATE INDEX IF NOT EXISTS idx_player_transfers_from_team ON player_transfers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_player_transfers_to_team ON player_transfers(to_team_id);

-- Notifications table for in-app alerts
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  payload JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read_admin_or_team" ON notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_accounts ta
      WHERE ta.id = auth.uid() AND ta.team_id = notifications.team_id
    )
  );

CREATE POLICY "notifications_insert_admin_or_system" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR auth.role() = 'authenticated'
  );

CREATE INDEX IF NOT EXISTS idx_notifications_team_id ON notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. ROW LEVEL SECURITY

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_accounts ENABLE ROW LEVEL SECURITY;

-- Teams: all authenticated users can read, only admins can write
CREATE POLICY "teams_read_all_authenticated" ON teams
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "teams_write_admin_only" ON teams
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "teams_update_admin_only" ON teams
  FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "teams_delete_admin_only" ON teams
  FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Players: all authenticated can read
-- Admin can write any. Team accounts can write their own team's players.
CREATE POLICY "players_read_all_authenticated" ON players
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "players_insert_admin_or_own_team" ON players
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR (
      EXISTS (SELECT 1 FROM team_accounts WHERE id = auth.uid() AND team_id = players.team_id)
    )
  );

CREATE POLICY "players_update_admin_or_own_team" ON players
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR (
      EXISTS (SELECT 1 FROM team_accounts WHERE id = auth.uid() AND team_id = players.team_id)
    )
  );

CREATE POLICY "players_delete_admin_only" ON players
  FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Fixtures: all authenticated can read, only admins can write
CREATE POLICY "fixtures_read_all_authenticated" ON fixtures
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "fixtures_write_admin_only" ON fixtures
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "fixtures_update_admin_only" ON fixtures
  FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "fixtures_delete_admin_only" ON fixtures
  FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Match events: all authenticated can read, only admins can write
CREATE POLICY "match_events_read_all_authenticated" ON match_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "match_events_write_admin_only" ON match_events
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "match_events_update_admin_only" ON match_events
  FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "match_events_delete_admin_only" ON match_events
  FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- Public read policies for live scores (anon access)
CREATE POLICY "teams_read_public" ON teams
  FOR SELECT USING (true);

CREATE POLICY "fixtures_read_public" ON fixtures
  FOR SELECT USING (true);

-- Admin users: only the user themselves can read their own record
CREATE POLICY "admin_users_read_own" ON admin_users
  FOR SELECT USING (id = auth.uid());

-- Team accounts: user can read their own, admins can read all
CREATE POLICY "team_accounts_read_own_or_admin" ON team_accounts
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "team_accounts_insert_admin_only" ON team_accounts
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "team_accounts_update_admin_only" ON team_accounts
  FOR UPDATE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

CREATE POLICY "team_accounts_delete_admin_only" ON team_accounts
  FOR DELETE USING (EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()));

-- 4. STORAGE BUCKET

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "team_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'team-logos');

CREATE POLICY "team_logos_admin_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'team-logos'
    AND auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "team_logos_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'team-logos'
    AND auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "team_logos_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'team-logos'
    AND auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- 6. MIGRATION FIX: Change player/fixture ID columns to BIGINT
-- (Client generates IDs using Date.now() which exceeds INTEGER range)
-- Run this block if you already ran the original migration:

-- ALTER TABLE players ALTER COLUMN id TYPE BIGINT;
-- ALTER TABLE fixtures ALTER COLUMN id TYPE BIGINT;
-- ALTER TABLE match_events ALTER COLUMN id TYPE BIGINT;
-- ALTER TABLE match_events ALTER COLUMN match_id TYPE BIGINT;
-- ALTER TABLE match_events ALTER COLUMN player_id TYPE BIGINT;
-- SELECT setval('players_id_seq', COALESCE((SELECT MAX(id) FROM players), 1));
-- SELECT setval('fixtures_id_seq', COALESCE((SELECT MAX(id) FROM fixtures), 1));
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION DEFAULT 6.0;

-- 5. SEED DATA: Default 11 teams

INSERT INTO teams (name) VALUES
  ('FC Eagles'),
  ('United Stars'),
  ('Thunder Hawks'),
  ('Royal Knights'),
  ('Phoenix FC'),
  ('Ocean Warriors'),
  ('Golden Lions'),
  ('Silver Arrows'),
  ('Iron Bears'),
  ('Storm Breakers'),
  ('Crystal Palace Academy')
ON CONFLICT (name) DO NOTHING;
