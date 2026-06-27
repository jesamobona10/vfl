# Operations Runbook

## Deploy

1. Ensure CI is green on the target commit (lint, build, test, migration checks).
2. Confirm required environment variables are set in the deployment platform:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Apply pending SQL migrations in `supabase/migrations` to the target environment.
4. Deploy application image/build.
5. Run smoke checks:
   - Login (`/auth/login`)
   - Core admin page load (`/admin`)
   - Public live feed (`/live`)

## Rollback

1. Roll application back to the previous known-good release.
2. If a migration caused the issue, apply a forward fix migration immediately.
3. Validate smoke checks on rolled-back version.
4. Record incident timeline and root cause before re-attempting deployment.

## Incident Response

1. Triage severity:
   - Sev1: app unavailable, auth unavailable, major data integrity issue.
   - Sev2: key feature degraded, partial outage.
   - Sev3: non-critical bug.
2. Capture evidence:
   - API errors, auth failures, rate-limit spikes.
   - Affected routes and user role scope.
3. Mitigate:
   - Block abusive traffic at edge/WAF.
   - Disable risky feature flags or endpoints if needed.
4. Communicate updates on fixed cadence until resolved.
5. Publish postmortem with preventive actions.

## Backup & Restore

1. Ensure automated Postgres backups are enabled in Supabase.
2. Test restore process periodically in a staging environment.
3. For data corruption events:
   - Pause writes where possible.
   - Restore to point-in-time in staging first.
   - Validate data integrity, then execute production restore plan.
