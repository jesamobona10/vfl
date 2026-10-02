-- Public scheduled fixtures view (additive).
-- Only includes scheduled matches that have BOTH date AND time attached.
CREATE OR REPLACE VIEW public_scheduled_fixtures AS
SELECT
  f.id AS match_id,
  f.round,
  f.competition_id,
  f.season_id,
  c.organization_id,
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
JOIN competitions c ON c.id = f.competition_id
LEFT JOIN teams ht ON ht.id = f.home_team_id
LEFT JOIN teams at ON at.id = f.away_team_id
WHERE f.status = 'scheduled'
  AND f.date IS NOT NULL
  AND f.time IS NOT NULL;

GRANT SELECT ON public_scheduled_fixtures TO anon;
