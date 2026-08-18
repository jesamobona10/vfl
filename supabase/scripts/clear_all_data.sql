-- ============================================================
-- supabase/scripts/clear_all_data.sql
--
-- DESTRUCTIVE: Wipes ALL domain data across the app:
--   fixtures, match_events, cup_matches, competitions, seasons,
--   season_teams, season_team_players, teams, team_lineups,
--   team_accounts, players, player_profiles, player_statistics,
--   player_transfers, notifications, credential_generation_logs,
--   match_report_analyses, organizations, organization_members,
--   auth_audit_logs.
--
-- PRESERVED (auth infra, NOT domain data):
--   auth.users            (Supabase identity rows)
--   admin_users           (super-admin bootstrap account)
--   storage.*             (storage objects/buckets)
--
-- Run ONLY against staging/test/dev. Run in the SQL Editor.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Row counts before wiping (for your own record)
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  n bigint;
  total bigint := 0;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'match_events','season_team_players','season_teams','cup_matches','fixtures',
    'team_lineups','player_transfers','notifications','player_profiles',
    'player_statistics','credential_generation_logs','players','team_accounts',
    'seasons','competitions','match_report_analyses','auth_audit_logs','teams',
    'organization_members','organizations'
  ]) LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
    IF n > 0 THEN
      RAISE NOTICE '% : % rows', t, n;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'TOTAL rows to delete: %', total;
END$$;

-- ------------------------------------------------------------
-- 1. Deepest children first (rows referencing multiple tables)
-- ------------------------------------------------------------
DELETE FROM match_events;
DELETE FROM season_team_players;
DELETE FROM season_teams;
DELETE FROM cup_matches;
DELETE FROM fixtures;

-- 2. Team-scoped / player-scoped dependents
DELETE FROM team_lineups;
DELETE FROM player_transfers;
DELETE FROM notifications;
DELETE FROM player_profiles;
DELETE FROM player_statistics;
DELETE FROM credential_generation_logs;

-- 3. Core entity tables
DELETE FROM players;
DELETE FROM team_accounts;
DELETE FROM seasons;           -- competitions.current_season_id → ON DELETE SET NULL
DELETE FROM competitions;
DELETE FROM match_report_analyses;
DELETE FROM auth_audit_logs;

-- 4. Base tables
DELETE FROM teams;
DELETE FROM organization_members;
DELETE FROM organizations;

COMMIT;

-- ------------------------------------------------------------
-- Reset identity sequences so new rows start fresh
-- (only for tables that still exist after this wipe)
-- ------------------------------------------------------------
SELECT setval('teams_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'teams_id_seq');
SELECT setval('players_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'players_id_seq');
SELECT setval('fixtures_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'fixtures_id_seq');
SELECT setval('match_events_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'match_events_id_seq');
SELECT setval('team_lineups_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'team_lineups_id_seq');
SELECT setval('player_transfers_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'player_transfers_id_seq');
SELECT setval('notifications_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'notifications_id_seq');
SELECT setval('player_statistics_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'player_statistics_id_seq');
SELECT setval('credential_generation_logs_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'credential_generation_logs_id_seq');
SELECT setval('auth_audit_logs_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'auth_audit_logs_id_seq');
SELECT setval('cup_matches_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'cup_matches_id_seq');
SELECT setval('match_report_analyses_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'match_report_analyses_id_seq');

-- ------------------------------------------------------------
-- Optional: also wipe the 11 seeded teams from the original
-- migration (they are inside `teams` above). If you want to
-- re-seed them later, run:
--   INSERT INTO teams (name) VALUES
--     ('FC Eagles'),('United Stars'),('Thunder Hawks'),
--     ('Royal Knights'),('Phoenix FC'),('Ocean Warriors'),
--     ('Golden Lions'),('Silver Arrows'),('Iron Bears'),
--     ('Storm Breakers'),('Crystal Palace Academy')
--   ON CONFLICT (name) DO NOTHING;
-- ------------------------------------------------------------