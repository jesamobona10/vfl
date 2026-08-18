-- Migration: migrate legacy competitions.season into seasons table
-- Run this after you've applied the seasons table migration and validated backfill.

BEGIN;

-- Defensive: ensure the columns this migration depends on exist
-- (they are also added by 20260813_season_architecture.sql; keeping
-- them here makes this migration order-independent).
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- For each competition that has a legacy `season` string, create a corresponding seasons row
DO $$
DECLARE
  comp RECORD;
  new_season_id uuid;
  short_name text;
BEGIN
  FOR comp IN SELECT id, name, season FROM competitions WHERE season IS NOT NULL LOOP
    -- Skip if a season with the same name already exists for this competition
    IF NOT EXISTS (SELECT 1 FROM seasons WHERE competition_id = comp.id AND name = comp.season) THEN
      short_name := comp.season;
      INSERT INTO seasons (competition_id, name, short_name, status, is_current, created_at)
      VALUES (comp.id, comp.season, short_name, 'active', true, now())
      RETURNING id INTO new_season_id;

      -- Optionally, backfill fixtures that belong to this competition but are missing season_id
      UPDATE fixtures SET season_id = new_season_id
      WHERE competition_id = comp.id AND (season_id IS NULL OR season_id = '');
    END IF;
  END LOOP;
END$$;

-- Clear the legacy `season` field to avoid future confusion. Keep this step reversible by commenting out if you want to inspect results first.
UPDATE competitions SET season = NULL WHERE season IS NOT NULL;

COMMIT;

-- Notes:
-- - This migration marks migrated seasons as `active` and `is_current=true` to preserve expected UX where competitions showed a current season string.
-- - If you prefer to make migrated seasons `upcoming` and `is_current=false`, adjust the INSERT values accordingly before running.
