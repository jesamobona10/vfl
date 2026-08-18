-- ============================================================
-- Migration: link match_events to org > competition > season
--
-- match_events already gained season_id in 20260813. This adds
-- competition_id and organization_id so every recorded event is
-- fully scoped to its organization, competition and season, and
-- backfills existing rows from their fixture.
-- ============================================================

BEGIN;

-- 1. Add competition_id + organization_id columns
ALTER TABLE match_events
  ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE;

ALTER TABLE match_events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. Backfill competition_id from the fixture's competition
UPDATE match_events me
SET competition_id = f.competition_id
FROM fixtures f
WHERE f.id = me.match_id
  AND me.competition_id IS NULL;

-- 3. Backfill organization_id from the competition's organization
UPDATE match_events me
SET organization_id = c.organization_id
FROM competitions c
WHERE c.id = me.competition_id
  AND me.organization_id IS NULL;

-- 4. Backfill season_id (defensive; 20260813 already did this)
UPDATE match_events me
SET season_id = f.season_id
FROM fixtures f
WHERE f.id = me.match_id
  AND me.season_id IS NULL;

-- 5. Indexes for org/competition/season scoped statistics queries
CREATE INDEX IF NOT EXISTS idx_match_events_competition_id
  ON match_events(competition_id);

CREATE INDEX IF NOT EXISTS idx_match_events_organization_id
  ON match_events(organization_id);

COMMIT;