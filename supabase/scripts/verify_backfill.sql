-- Verification queries to run after executing backfill_seasons.sql

-- 1) Count fixtures that still lack a season_id
SELECT COUNT(*) AS fixtures_without_season_count
FROM fixtures
WHERE season_id IS NULL OR season_id::text = '';

-- 2) List competitions that still have no seasons
SELECT c.id, c.name
FROM competitions c
LEFT JOIN seasons s ON s.competition_id = c.id
WHERE s.id IS NULL;

-- 3) Ensure every fixture.season_id references an existing season
SELECT COUNT(*) AS orphan_fixtures_count
FROM fixtures f
LEFT JOIN seasons s ON f.season_id = s.id
WHERE f.season_id IS NOT NULL AND s.id IS NULL;

-- 4) Show season counts per competition
SELECT c.id AS competition_id, c.name AS competition_name, COUNT(s.*) AS season_count
FROM competitions c
LEFT JOIN seasons s ON s.competition_id = c.id
GROUP BY c.id, c.name
ORDER BY season_count DESC;

-- 5) Check for duplicate seasons within a competition (uniqueness enforcement)
SELECT competition_id, name, COUNT(*) AS duplicates
FROM seasons
GROUP BY competition_id, name
HAVING COUNT(*) > 1;

-- 6) Sample fixtures joined to season info (limit for review)
SELECT f.id, f.date, f.competition_id, f.season_id, s.name AS season_name
FROM fixtures f
LEFT JOIN seasons s ON f.season_id = s.id
ORDER BY f.date DESC
LIMIT 50;
