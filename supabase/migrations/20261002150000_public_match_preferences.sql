-- Keep anonymous match-alert preferences beside the browser push endpoint.
ALTER TABLE public_push_subscriptions
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS team_ids BIGINT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_public_push_subscriptions_organization
  ON public_push_subscriptions(organization_id);

-- Append organization identity to the public fixture view for client-side
-- preference selection and server-side notification routing.
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
   OR (f.status = 'scheduled' AND f.date IS NOT NULL AND f.time IS NOT NULL);

GRANT SELECT ON public_matches TO anon;
