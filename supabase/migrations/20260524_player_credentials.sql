-- =============================================================================
-- RUN THIS FILE ONLY in Supabase SQL Editor (idempotent — safe to re-run)
-- Prerequisite: teams, players, admin_users (from supabase/migration.sql sections 1–3)
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.players') IS NULL THEN
    RAISE EXCEPTION 'Missing table: players. Run core tables from supabase/migration.sql first (lines 1–50).';
  END IF;
  IF to_regclass('public.teams') IS NULL THEN
    RAISE EXCEPTION 'Missing table: teams. Run core tables from supabase/migration.sql first.';
  END IF;
  IF to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION 'Missing table: admin_users. Run core tables from supabase/migration.sql first.';
  END IF;
END $$;

-- 1. player_profiles
CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
  username TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  display_name TEXT,
  jersey_number INTEGER,
  position TEXT,
  photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

UPDATE player_profiles SET must_change_password = true WHERE must_change_password IS NULL;

ALTER TABLE player_profiles ALTER COLUMN must_change_password SET DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_profiles'
      AND column_name = 'must_change_password' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE player_profiles ALTER COLUMN must_change_password SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profiles_username
  ON player_profiles (username)
  WHERE username IS NOT NULL;

-- 2. credential_generation_logs
CREATE TABLE IF NOT EXISTS credential_generation_logs (
  id BIGSERIAL PRIMARY KEY,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN ('admin', 'team')),
  players_affected INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credential_generation_logs_created_at
  ON credential_generation_logs (created_at DESC);

-- 3. RLS on player_profiles
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_profiles_read_owner_or_admin ON player_profiles;
CREATE POLICY player_profiles_read_owner_or_admin ON player_profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS player_profiles_write_owner_or_admin ON player_profiles;
DROP POLICY IF EXISTS player_profiles_insert_owner_or_admin ON player_profiles;
DROP POLICY IF EXISTS player_profiles_update_owner_or_admin ON player_profiles;
DROP POLICY IF EXISTS player_profiles_delete_owner_or_admin ON player_profiles;

CREATE POLICY player_profiles_insert_owner_or_admin ON player_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY player_profiles_update_owner_or_admin ON player_profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY player_profiles_delete_owner_or_admin ON player_profiles
  FOR DELETE USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- 4. Verification — expect status = OK and credential_columns = 2
SELECT
  CASE
    WHEN to_regclass('public.player_profiles') IS NULL THEN 'FAIL: player_profiles missing'
    WHEN to_regclass('public.credential_generation_logs') IS NULL THEN 'FAIL: credential_generation_logs missing'
    WHEN (
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'player_profiles'
        AND column_name IN ('username', 'must_change_password')
    ) < 2 THEN 'FAIL: credential columns missing'
    ELSE 'OK: player credentials schema ready'
  END AS status,
  (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_profiles'
      AND column_name IN ('username', 'must_change_password')
  ) AS credential_columns;
