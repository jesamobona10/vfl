-- ============================================================
-- Ensure seasons.competition_id -> competitions(id) FK exists
--
-- Why: several API routes resolve a season's org via a PostgREST
-- embed (e.g. select("id, competition:competitions(organization_id)")).
-- PostgREST only honors embeds when a foreign key constraint links the
-- two tables. If the `seasons` table predates 20260725_seasons.sql
-- (which used CREATE TABLE IF NOT EXISTS), the FK may never have been
-- added, so those embeds error out and the routes return 404 even for
-- seasons that exist.
--
-- Idempotent: only adds the constraint if it is missing.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seasons_competition_id_fkey'
      AND conrelid = 'seasons'::regclass
  ) THEN
    ALTER TABLE seasons
      ADD CONSTRAINT seasons_competition_id_fkey
      FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Verification:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'seasons'::regclass AND contype = 'f';