-- ============================================================
-- Migration: Player Data Anonymization Support
-- Allows org admins to anonymize player PII while preserving
-- historical match events (ON DELETE SET NULL pattern).
-- Run this in Supabase SQL Editor (idempotent).
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.players') IS NULL THEN
    RAISE EXCEPTION 'Missing table: players';
  END IF;
  IF to_regclass('public.match_events') IS NULL THEN
    RAISE EXCEPTION 'Missing table: match_events';
  END IF;
  IF to_regclass('public.player_profiles') IS NULL THEN
    RAISE EXCEPTION 'Missing table: player_profiles';
  END IF;
END $$;

-- 1. Make PII columns nullable on players table
ALTER TABLE players ALTER COLUMN name DROP NOT NULL;
ALTER TABLE players ALTER COLUMN photo_url DROP NOT NULL;
-- jersey_number, position, is_captain already nullable

-- 2. Add anonymization tracking columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS anonymized_by UUID REFERENCES auth.users(id);
ALTER TABLE players ADD COLUMN IF NOT EXISTS original_name TEXT;

-- 3. Update match_events FK to SET NULL instead of CASCADE
-- This preserves historical match events when player is anonymized
DO $$
BEGIN
  -- Drop existing FK if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'match_events'
      AND constraint_name = 'match_events_player_id_fkey'
  ) THEN
    ALTER TABLE match_events DROP CONSTRAINT match_events_player_id_fkey;
  END IF;

  -- Add new FK with SET NULL
  ALTER TABLE match_events
    ADD CONSTRAINT match_events_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  -- If constraint already has correct definition, ignore
  NULL;
END $$;

-- 4. Update player_profiles to allow nullable PII
ALTER TABLE player_profiles ALTER COLUMN display_name DROP NOT NULL;
ALTER TABLE player_profiles ALTER COLUMN username DROP NOT NULL;
ALTER TABLE player_profiles ALTER COLUMN photo_url DROP NOT NULL;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- 5. Create index for querying anonymized players
CREATE INDEX IF NOT EXISTS idx_players_anonymized
  ON players(anonymized_at) WHERE anonymized_at IS NOT NULL;

-- 6. Verification
SELECT
  CASE
    WHEN to_regclass('public.players') IS NULL THEN 'FAIL: players missing'
    WHEN to_regclass('public.match_events') IS NULL THEN 'FAIL: match_events missing'
    WHEN to_regclass('public.player_profiles') IS NULL THEN 'FAIL: player_profiles missing'
    WHEN (
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'players'
        AND column_name IN ('name', 'photo_url', 'anonymized_at', 'anonymized_by', 'original_name')
    ) < 5 THEN 'FAIL: players columns missing'
    WHEN (
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'name'
    ) <> 'YES' THEN 'FAIL: players.name not nullable'
    WHEN (
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'photo_url'
    ) <> 'YES' THEN 'FAIL: players.photo_url not nullable'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'match_events'
        AND constraint_name = 'match_events_player_id_fkey'
    ) THEN 'FAIL: match_events FK missing'
    ELSE 'OK: player anonymization schema ready'
  END AS status,
  (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'name'
  ) AS name_nullable,
  (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'photo_url'
  ) AS photo_url_nullable,
  (
    SELECT delete_rule FROM information_schema.referential_constraints
    WHERE constraint_name = 'match_events_player_id_fkey'
  ) AS fk_delete_rule;