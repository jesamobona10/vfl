-- supabase/scripts/clear_test_data.sql
-- WARNING: Destructive cleanup of production data. This script will
-- permanently remove fixtures, matches, teams, players, competitions,
-- organizations and related season data. Use only in staging or test
-- environments.

-- Safety guard: you must explicitly confirm by setting a session
-- variable before running this script. Example:
--   SET app.destructive_clear = 'YES_I_AM_SURE';

DO $$
BEGIN
  IF current_setting('app.destructive_clear', true) IS DISTINCT FROM 'YES_I_AM_SURE' THEN
    RAISE EXCEPTION E'Not confirmed: To run this destructive script, first execute:\n  SET app.destructive_clear = ''YES_I_AM_SURE'';\nThen re-run the script.';
  END IF;
END$$;

BEGIN;

-- Delete child/dependent rows first (match events, season registrations, etc.)
-- Order matters to respect foreign keys; adjust if your schema differs.

DELETE FROM match_events;
DELETE FROM season_team_players;
DELETE FROM season_teams;
DELETE FROM fixtures;

-- Seasons and competitions
DELETE FROM seasons;
DELETE FROM competitions;

-- Players and teams
DELETE FROM players;
DELETE FROM teams;

-- Organization members and organizations
DELETE FROM organization_members;
DELETE FROM organizations;

COMMIT;

-- Optional: reset common sequences (uncomment and adapt if you use serial/bigserial IDs)
-- SELECT setval('teams_id_seq', 1, false);
-- SELECT setval('players_id_seq', 1, false);

-- Done.
