-- Public live events view (additive). Joins match_events with fixtures/teams/org.
-- Player name only when org.public_player_names_enabled is true.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS public_player_names_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE VIEW public_live_events AS
SELECT
  f.id AS match_id,
  f.round,
  f.competition_id,
  f.season_id,
  c.organization_id,
  COALESCE(o.public_player_names_enabled, FALSE) AS public_player_names_enabled,
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
  f.venue,
  me.id AS event_id,
  me.event_type,
  me.minute,
  me.team_id,
  CASE
    WHEN COALESCE(o.public_player_names_enabled, FALSE) THEN p.name
    ELSE NULL
  END AS player_name,
  p.id AS player_id
FROM match_events me
JOIN fixtures f ON f.id = me.match_id
JOIN competitions c ON c.id = f.competition_id
LEFT JOIN teams ht ON ht.id = f.home_team_id
LEFT JOIN teams at ON at.id = f.away_team_id
LEFT JOIN players p ON p.id = me.player_id
LEFT JOIN organizations o ON o.id = c.organization_id
WHERE (
  f.status IN ('live', 'in-progress')
  OR (f.status = 'scheduled' AND f.date = CURRENT_DATE)
);

GRANT SELECT ON public_live_events TO anon;
