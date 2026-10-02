-- Public match listing for scheduled fixtures, live scores, and final results.
-- Expose only fields intended for the public match center.
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
  f.venue
FROM fixtures f
LEFT JOIN teams ht ON ht.id = f.home_team_id
LEFT JOIN teams at ON at.id = f.away_team_id
WHERE f.status IN ('live', 'in-progress', 'completed')
   OR (f.status = 'scheduled' AND f.date IS NOT NULL AND f.time IS NOT NULL);

GRANT SELECT ON public_matches TO anon;
