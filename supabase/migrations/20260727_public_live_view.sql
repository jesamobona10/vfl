-- ============================================================
-- Public Live Scores — narrow, purpose-built data access
-- Creates a restricted view for the /api/public/live endpoint
-- so the endpoint can use the anon key instead of service-role.
-- ============================================================

-- 1. REVOKE anon access on base tables (belt and suspenders)
REVOKE SELECT ON teams FROM anon;
REVOKE SELECT ON fixtures FROM anon;

-- 2. CREATE A NARROW VIEW for public live data
--    Only exposes: team id/name/logo, match id/round/score/status/date/time/venue
--    Only includes: live, in-progress, or today's scheduled fixtures
CREATE OR REPLACE VIEW public_live AS
SELECT
  f.id AS match_id,
  f.round,
  f.home_team_id,
  ht.name AS home_team_name,
  ht.logo_url AS home_team_logo,
  f.away_team_id,
  at.name AS away_team_name,
  at.logo_url AS away_team_logo,
  f.home_score,
  f.away_score,
  f.status,
  f.date,
  f.time::TEXT,
  f.venue
FROM fixtures f
JOIN teams ht ON ht.id = f.home_team_id
JOIN teams at ON at.id = f.away_team_id
WHERE f.status IN ('live', 'in-progress')
   OR (f.status = 'scheduled' AND f.date = CURRENT_DATE);

-- 3. GRANT anon SELECT on the view only
GRANT SELECT ON public_live TO anon;
