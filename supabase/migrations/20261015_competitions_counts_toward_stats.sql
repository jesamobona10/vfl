-- ============================================================
-- Competition stats opt-in
--
-- Controls whether a competition's matches are included in
-- aggregate statistics/standings. League and cup competitions
-- count by default; friendlies do not. Existing friendlies are
-- backfilled to false.
-- ============================================================

BEGIN;

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS counts_toward_stats BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE competitions
  SET counts_toward_stats = FALSE
  WHERE type = 'friendly';

COMMENT ON COLUMN competitions.counts_toward_stats IS
  'Whether results count toward aggregate standings/statistics. Friendly competitions default to false.';

COMMIT;
