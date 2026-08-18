-- ============================================================
-- Backfill season_teams from existing fixtures.
--
-- For each season, register every team that appears in that
-- season's fixtures. This gives existing data a season-team
-- relationship without manual data entry, so standings and
-- season-scoped team queries work immediately.
--
-- Idempotent: uses ON CONFLICT DO NOTHING. Safe to re-run.
-- ============================================================

INSERT INTO season_teams (season_id, team_id, display_name, logo_url, status, registered_at)
SELECT DISTINCT
  f.season_id AS season_id,
  t.id AS team_id,
  t.name AS display_name,
  t.logo_url AS logo_url,
  'active' AS status,
  NOW() AS registered_at
FROM fixtures f
JOIN teams t ON t.id IN (f.home_team_id, f.away_team_id)
WHERE f.season_id IS NOT NULL
ON CONFLICT (season_id, team_id) DO NOTHING;

-- Also cover cup_matches (they carry season_id too)
INSERT INTO season_teams (season_id, team_id, display_name, logo_url, status, registered_at)
SELECT DISTINCT
  cm.season_id AS season_id,
  t.id AS team_id,
  t.name AS display_name,
  t.logo_url AS logo_url,
  'active' AS status,
  NOW() AS registered_at
FROM cup_matches cm
JOIN teams t ON t.id IN (cm.home_id, cm.away_id)
WHERE cm.season_id IS NOT NULL
  AND t.id IS NOT NULL
ON CONFLICT (season_id, team_id) DO NOTHING;

-- ============================================================
-- Backfill match_events.season_id (in case it wasn't populated
-- by the migration; e.g. events added between migrations)
-- ============================================================

UPDATE match_events me
SET season_id = f.season_id
FROM fixtures f
WHERE f.id = me.match_id
  AND me.season_id IS NULL;

-- ============================================================
-- Verification queries
-- ============================================================

-- SELECT 'season_teams_count' AS check, COUNT(*) FROM season_teams;
-- SELECT 'season_teams_without_season' AS check, COUNT(*) FROM season_teams WHERE season_id IS NULL;
-- SELECT 'match_events_without_season' AS check, COUNT(*) FROM match_events WHERE season_id IS NULL;