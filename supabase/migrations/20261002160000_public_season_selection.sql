-- Expose only season metadata for organizations that already have public
-- fixtures. This lets the anonymous public route offer an empty/new season
-- before that season has any match rows of its own.
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
LEFT JOIN organization_seasons os ON os.id = s.organization_season_id
WHERE EXISTS (
  SELECT 1
  FROM competitions public_competition
  JOIN fixtures f ON f.competition_id = public_competition.id
  WHERE public_competition.organization_id = c.organization_id
    AND (
      f.status IN ('live', 'in-progress', 'completed')
      OR (f.status = 'scheduled' AND f.date IS NOT NULL AND f.time IS NOT NULL)
    )
);

GRANT SELECT ON public_seasons TO anon;
