# Backfill Runbook — Seasons & Fixtures

Purpose
-------
This runbook describes the safe procedure to backfill `seasons` records for existing `competitions` and to populate `fixtures.season_id` for all fixtures. Run this in staging first, verify results, then schedule a production run during a maintenance window.

Prerequisites
-------------
- A recent staging database snapshot (or restored production dump) to validate the script.
- The migrations that create the `seasons` table and add `fixtures.season_id` must be applied to the target DB before running the backfill: see `supabase/migrations/20260725_seasons.sql` and `supabase/migrations/20260726_enforce_season_id.sql`.
- A database user with privileges to INSERT/UPDATE on `seasons` and `fixtures`.
- CLI access to psql or a DB client.

Files
-----
- `supabase/scripts/backfill_seasons.sql` — the backfill script that creates seasons for competitions and updates fixtures that lack `season_id`.
- `supabase/scripts/verify_backfill.sql` — verification queries to run after the backfill.

High-level Steps
----------------
1. Run the script in staging and verify results.
2. Review created seasons and adjust `start_date` / `end_date` where necessary.
3. When approved, run on production during a maintenance window.
4. After verification, apply the NOT NULL enforcement migration (`20260726_enforce_season_id.sql`) if not already applied.

Staging Run (recommended)
-------------------------
1. Restore a recent production snapshot to a staging database (or use a read-only copy).
2. Ensure migrations are applied on staging:

```bash
# from repo root
npx supabase db push --db-url "$STAGING_DB_URL"
# or run SQL migrations with your CI/deployment tool
```

3. Run the backfill script:

```bash
psql "$STAGING_DB_URL" -f supabase/scripts/backfill_seasons.sql
```

4. Run verification queries:

```bash
psql "$STAGING_DB_URL" -f supabase/scripts/verify_backfill.sql
```

Expected staging verification results
-------------------------------------
- `fixtures_without_season_count` should be 0.
- `competitions_without_season_count` should be 0 (or only those intentionally excluded).
- `orphan_fixtures_count` should be 0 (fixtures pointing to non-existent seasons).

Production Run (maintenance window)
-----------------------------------
1. Notify stakeholders and open maintenance window.
2. Take a DB backup/snapshot.
3. Apply migrations that add `seasons` and `fixtures.season_id` if they are not present.
4. Execute the backfill script:

```bash
psql "$PROD_DB_URL" -f supabase/scripts/backfill_seasons.sql
```

5. Run verification queries:

```bash
psql "$PROD_DB_URL" -f supabase/scripts/verify_backfill.sql
```

6. Review results, fix any anomalies, then apply `NOT NULL` enforcement migration if ready.

API & Frontend rollout notes
---------------------------
- After backfilling seasons and fixtures, deploy API changes that enforce season-scoped behavior. Recommended sequence:
	1. Deploy API changes to staging (new season endpoints, modified generate-fixtures behavior).
	2. Deploy frontend changes that pass `seasonId` in URLs and use the new hooks.
	3. Run integration smoke tests (see `supabase/scripts/verify_backfill.sql` and test endpoints `/api/seasons/:id/standings`, `/api/seasons/:id/teams`).
	4. If tests pass, promote to production during a maintenance window.

Monitoring after production rollout
---------------------------------
- Monitor API error logs for `season_*` errors for at least 24 hours.
- Run the smoke-check script in staging to validate season endpoints:

```bash
AUTH_TOKEN="<bearer-token>" SEASON_ID="<season-uuid>" BASE_URL="https://staging.example.com" node scripts/api_season_smoke_checks.js
```

Replace `AUTH_TOKEN` with a valid bearer token for a test admin user and `SEASON_ID` with a season ID present in staging.
- Watch for spikes in fixture-generation errors and partner with the DB team if any referential integrity fails.
- Validate a sample of competitions in the UI to ensure season selector works and standings show correct season data.

Rollback plan
-------------
If serious issues appear (e.g., incorrect mapping of fixtures to seasons):

1. Restore the DB from the pre-backfill backup/snapshot.
2. Investigate and fix the backfill script or data mapping logic.

Notes & Safeguards
------------------
- The backfill script only creates seasons for competitions that do not already have seasons. It uses `competitions.season` (legacy) as a preferred name when present.
- The script updates fixtures where `season_id` is NULL or empty string only.
- Always review created seasons before enforcing NOT NULL constraints in production.

Season architecture (competition & season model)
-----------------------------------------------
To bring the schema in line with the competition/season architecture guide, apply in this order:

1. `supabase/migrations/20260813_season_architecture.sql` — adds `seasons.short_name` + `seasons.updated_at` + `UNIQUE(competition_id, name)`, `competitions.current_season_id`, the `season_teams` and `season_team_players` tables (with RLS), `match_events.season_id`, and the `season_player_goals` / `season_player_stats` RPCs. Also extends season statuses with `draft`.
2. `supabase/migrations/20260812_migrate_competition_season.sql` — migrates legacy `competitions.season` strings into `seasons` records and clears the legacy column. This migration is order-independent (it defensively adds the columns it needs).
3. `supabase/scripts/backfill_season_teams.sql` — registers every team that already appears in a season's fixtures into `season_teams`, and backfills `match_events.season_id`. Idempotent.

Verification after these steps:
- `fixtures_without_season_count` should be 0.
- `competitions_without_season_count` should be 0 (or only those intentionally excluded).
- `season_teams` should have at least one row per season with fixtures.
- Smoke-test `/api/seasons/:id/teams`, `/api/seasons/:id/standings`, `/api/seasons/:id/statistics`.

Migration: legacy `competitions.season`
-----------------------------------
If your DB contains a legacy `competitions.season` string field (used by older UI), run the migration `supabase/migrations/20260812_migrate_competition_season.sql` after the backfill. This will:

- Create a `seasons` record for each competition that had a non-null `season` value (skips existing matching seasons).
- Set the newly created season's `status` to `active` and `is_current` to `true` by default (adjust the SQL if you prefer `upcoming`).
- Backfill any fixtures for that competition that still lack `season_id` to point to the created season.
- Clear the `competitions.season` field to avoid future ambiguity.

Review the created seasons and adjust dates before applying NOT NULL enforcement.

Contact
-------
Ask the platform/DB team for help if you do not have permission to create or alter records.
