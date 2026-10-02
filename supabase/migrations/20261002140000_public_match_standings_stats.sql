-- Append competition/season/team identifiers to the public match view so the
-- public match centre can scope standings and player stats correctly.
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
  s.name AS season_name
FROM fixtures f
LEFT JOIN teams ht ON ht.id = f.home_team_id
LEFT JOIN teams at ON at.id = f.away_team_id
LEFT JOIN competitions c ON c.id = f.competition_id
LEFT JOIN seasons s ON s.id = f.season_id
WHERE f.status IN ('live', 'in-progress', 'completed')
   OR (f.status = 'scheduled' AND f.date IS NOT NULL AND f.time IS NOT NULL);

GRANT SELECT ON public_matches TO anon;

-- Standings are computed only from fixtures already exposed in public_matches.
CREATE OR REPLACE VIEW public_standings AS
WITH public_fixtures AS (
  SELECT f.*
  FROM fixtures f
  WHERE f.competition_id IS NOT NULL
    AND (
      f.status IN ('live', 'in-progress', 'completed')
      OR (f.status = 'scheduled' AND f.date IS NOT NULL AND f.time IS NOT NULL)
    )
), team_fixtures AS (
  SELECT
    f.competition_id,
    f.season_id,
    f.status,
    f.home_score AS goals_for,
    f.away_score AS goals_against,
    ht.id AS team_id,
    COALESCE(st.display_name, ht.name) AS team_name,
    COALESCE(st.logo_url, ht.logo_url) AS team_logo
  FROM public_fixtures f
  JOIN teams ht ON ht.id = f.home_team_id
  LEFT JOIN season_teams st ON st.season_id = f.season_id AND st.team_id = ht.id

  UNION ALL

  SELECT
    f.competition_id,
    f.season_id,
    f.status,
    f.away_score AS goals_for,
    f.home_score AS goals_against,
    at.id AS team_id,
    COALESCE(st.display_name, at.name) AS team_name,
    COALESCE(st.logo_url, at.logo_url) AS team_logo
  FROM public_fixtures f
  JOIN teams at ON at.id = f.away_team_id
  LEFT JOIN season_teams st ON st.season_id = f.season_id AND st.team_id = at.id
)
SELECT
  tf.competition_id,
  tf.season_id,
  tf.team_id,
  tf.team_name,
  tf.team_logo,
  COUNT(*) FILTER (WHERE
    tf.status IN ('live', 'in-progress')
    OR (tf.status = 'completed' AND tf.goals_for IS NOT NULL AND tf.goals_against IS NOT NULL)
  )::INTEGER AS played,
  COUNT(*) FILTER (WHERE
    (tf.status IN ('live', 'in-progress') OR tf.status = 'completed')
    AND (tf.status IN ('live', 'in-progress') OR (tf.goals_for IS NOT NULL AND tf.goals_against IS NOT NULL))
    AND COALESCE(tf.goals_for, 0) > COALESCE(tf.goals_against, 0)
  )::INTEGER AS won,
  COUNT(*) FILTER (WHERE
    (tf.status IN ('live', 'in-progress') OR tf.status = 'completed')
    AND (tf.status IN ('live', 'in-progress') OR (tf.goals_for IS NOT NULL AND tf.goals_against IS NOT NULL))
    AND COALESCE(tf.goals_for, 0) = COALESCE(tf.goals_against, 0)
  )::INTEGER AS drawn,
  COUNT(*) FILTER (WHERE
    (tf.status IN ('live', 'in-progress') OR tf.status = 'completed')
    AND (tf.status IN ('live', 'in-progress') OR (tf.goals_for IS NOT NULL AND tf.goals_against IS NOT NULL))
    AND COALESCE(tf.goals_for, 0) < COALESCE(tf.goals_against, 0)
  )::INTEGER AS lost,
  COALESCE(SUM(CASE WHEN tf.status IN ('live', 'in-progress', 'completed') THEN COALESCE(tf.goals_for, 0) ELSE 0 END), 0)::INTEGER AS gf,
  COALESCE(SUM(CASE WHEN tf.status IN ('live', 'in-progress', 'completed') THEN COALESCE(tf.goals_against, 0) ELSE 0 END), 0)::INTEGER AS ga,
  (
    COALESCE(SUM(CASE WHEN tf.status IN ('live', 'in-progress', 'completed') THEN COALESCE(tf.goals_for, 0) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN tf.status IN ('live', 'in-progress', 'completed') THEN COALESCE(tf.goals_against, 0) ELSE 0 END), 0)
  )::INTEGER AS gd,
  COALESCE(SUM(CASE
    WHEN tf.status IN ('live', 'in-progress') THEN
      CASE WHEN COALESCE(tf.goals_for, 0) > COALESCE(tf.goals_against, 0) THEN 3
           WHEN COALESCE(tf.goals_for, 0) = COALESCE(tf.goals_against, 0) THEN 1 ELSE 0 END
    WHEN tf.status = 'completed' AND tf.goals_for IS NOT NULL AND tf.goals_against IS NOT NULL THEN
      CASE WHEN tf.goals_for > tf.goals_against THEN 3
           WHEN tf.goals_for = tf.goals_against THEN 1 ELSE 0 END
    ELSE 0
  END), 0)::INTEGER AS points
FROM team_fixtures tf
GROUP BY tf.competition_id, tf.season_id, tf.team_id, tf.team_name, tf.team_logo;

GRANT SELECT ON public_standings TO anon;

-- Aggregate player figures from completed public matches only.
CREATE OR REPLACE VIEW public_player_statistics AS
SELECT
  f.competition_id,
  f.season_id,
  p.id AS player_id,
  p.name AS player_name,
  me.team_id AS team_id,
  COALESCE(st.display_name, t.name) AS team_name,
  COUNT(me.id) FILTER (WHERE me.event_type IN ('goal', 'penalty_goal'))::INTEGER AS goals,
  COUNT(me.id) FILTER (WHERE me.event_type = 'assist')::INTEGER AS assists,
  COUNT(me.id) FILTER (WHERE me.event_type IN ('yellow', 'yellow_card'))::INTEGER AS yellow_cards,
  COUNT(me.id) FILTER (WHERE me.event_type IN ('red', 'red_card'))::INTEGER AS red_cards,
  COUNT(DISTINCT me.match_id)::INTEGER AS appearances
FROM match_events me
JOIN fixtures f ON f.id = me.match_id AND f.status = 'completed'
JOIN players p ON p.id = me.player_id
JOIN teams t ON t.id = me.team_id
LEFT JOIN season_teams st ON st.season_id = f.season_id AND st.team_id = me.team_id
WHERE f.competition_id IS NOT NULL
GROUP BY f.competition_id, f.season_id, p.id, p.name, me.team_id, COALESCE(st.display_name, t.name);

GRANT SELECT ON public_player_statistics TO anon;
