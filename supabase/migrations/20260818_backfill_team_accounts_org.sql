-- Backfill team_accounts.organization_id from their linked team's organization.
-- Fixes team accounts created before organization_id was populated on creation,
-- which previously could not resolve their org slug to reach /org/[slug]/dashboard.
UPDATE team_accounts ta
SET organization_id = t.organization_id
FROM teams t
WHERE ta.team_id = t.id
  AND ta.organization_id IS NULL
  AND t.organization_id IS NOT NULL;