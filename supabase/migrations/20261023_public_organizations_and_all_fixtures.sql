-- Public match centre: list every organization and expose its fixtures and
-- seasons, including scheduled fixtures that do not yet have a date/time.

CREATE OR REPLACE VIEW public_organizations
WITH (security_barrier=false)
AS
SELECT
  o.id,
  o.name,
  o.slug
FROM organizations o;

ALTER VIEW public_organizations OWNER TO postgres;

GRANT SELECT ON public_organizations TO anon, authenticated;

-- Scheduled fixtures are public before they are dated; the match centre shows
-- them as "Date to be announced".
CREATE OR REPLACE VIEW public_matches AS
SELECT
  f.id AS match_id,
  f.round,
  COALESCE(ht.name, 'Unknown team') AS home_team_name,
  COALESCE(at.name, 'Unknown team') AS away_team_name,
  f.home_score,
  f.away_score,
  f.status,
  f.date,
  f.time::TEXT,
  f.venue,
  ht.logo_url AS home_team_logo,
  at.logo_url AS away_team_logo,
  f.live_started_at,
  f.competition_id,
  COALESCE(
    CASE WHEN c.settings->>'halftimeMinutes' ~ '^[0-9]{1,3}$'
      THEN (c.settings->>'halftimeMinutes')::INTEGER END,
    15
  ) AS halftime_minutes,
  COALESCE(
    CASE WHEN c.settings->>'stoppageMinutes' ~ '^[0-9]{1,3}$'
      THEN (c.settings->>'stoppageMinutes')::INTEGER END,
    3
  ) AS stoppage_minutes,
  f.season_id,
  ht.id AS home_team_id,
  at.id AS away_team_id,
  c.name AS competition_name,
  s.name AS season_name,
  c.organization_id,
  o.name AS organization_name
FROM fixtures f
LEFT JOIN teams ht ON ht.id = f.home_team_id
LEFT JOIN teams at ON at.id = f.away_team_id
LEFT JOIN competitions c ON c.id = f.competition_id
LEFT JOIN organizations o ON o.id = c.organization_id
LEFT JOIN seasons s ON s.id = f.season_id
WHERE f.status IN ('live', 'in-progress', 'completed')
   OR f.status = 'scheduled';

GRANT SELECT ON public_matches TO anon, authenticated;

-- Season metadata is available for every organization.
CREATE OR REPLACE VIEW public_seasons AS
SELECT
  s.id AS season_id,
  s.competition_id,
  c.organization_id,
  s.organization_season_id,
  COALESCE(os.name, s.name) AS season_name,
  COALESCE(os.is_current, s.is_current, FALSE) AS is_current
FROM seasons s
JOIN competitions c ON c.id = s.competition_id
LEFT JOIN organization_seasons os ON os.id = s.organization_season_id;

GRANT SELECT ON public_seasons TO anon, authenticated;
