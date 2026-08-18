-- ============================================================
-- Scope team name uniqueness per-organization instead of globally
-- ============================================================

-- 1. Drop the global UNIQUE constraint on teams.name (from migration.sql line 10)
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_key;

-- 2. Add a per-org UNIQUE constraint instead
--    First ensure no teams have NULL organization_id
UPDATE teams SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- 3. Add the scoped unique constraint
ALTER TABLE teams ADD CONSTRAINT teams_org_name_unique UNIQUE (organization_id, name);

-- 4. Add index for faster lookups by org
CREATE INDEX IF NOT EXISTS idx_teams_org_name ON teams(organization_id, name);
