-- ============================================================
-- Live Event clock support
-- Adds a timestamp anchor so the live clock can be derived
-- (count-up from kickoff) and survives page refreshes.
-- ============================================================

ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fixtures_status_live_started
  ON fixtures(status, live_started_at)
  WHERE status IN ('live', 'in-progress');
