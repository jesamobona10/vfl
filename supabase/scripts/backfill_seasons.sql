-- Backfill script for creating `seasons` records for competitions
-- and assigning `fixtures.season_id` where missing.
--
-- Usage (run in a staging DB first):
-- psql "postgresql://..." -f supabase/scripts/backfill_seasons.sql
--
-- This script will:
-- 1. For each competition that has no season records, create a default season.
-- 2. If `competitions.season` (legacy) exists, use it as the season name.
-- 3. Update `fixtures` rows with NULL `season_id` to point to the created season.

BEGIN;

-- Safety check: ensure `seasons` and `fixtures` tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seasons') THEN
        RAISE EXCEPTION 'Table "seasons" does not exist. Run seasons migrations first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixtures' AND column_name = 'season_id') THEN
        RAISE EXCEPTION 'Column "fixtures.season_id" does not exist. Run season_id migration first.';
    END IF;
END$$;

-- For each competition with no season, create a season and backfill fixtures.
DO $$
DECLARE
  comp RECORD;
  new_season_id uuid;
  season_name text;
  short_name text;
BEGIN
  FOR comp IN SELECT id, name, season FROM competitions LOOP
    IF NOT EXISTS (SELECT 1 FROM seasons WHERE competition_id = comp.id) THEN
      -- derive season name from legacy `competitions.season` if available
      season_name := COALESCE(comp.season, comp.name || ' ' || to_char(now(), 'YYYY'));
      short_name := COALESCE(comp.season, to_char(now(), 'YYYY'));

      INSERT INTO seasons (competition_id, name, short_name, start_date, end_date, status, is_current, created_at, updated_at)
      VALUES (comp.id, season_name, short_name, NULL, NULL, 'UPCOMING', false, now(), now())
      RETURNING id INTO new_season_id;

      -- Backfill fixtures for this competition that don't have a season_id
      UPDATE fixtures
      SET season_id = new_season_id
      WHERE competition_id = comp.id
        AND (season_id IS NULL OR season_id = '');
    END IF;
  END LOOP;
END$$;

COMMIT;

-- Notes:
-- - Review created seasons and adjust `start_date`/`end_date` as needed before enforcing NOT NULL constraints.
-- - Run this script in staging, verify, then run it in production during a maintenance window.
