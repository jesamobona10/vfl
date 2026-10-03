# Public match centre and kickoff reminders

The public match centre remains available without authentication at `/public`. Authenticated users also get the same module in the super-admin Public tab and in their organization workspace. Their organization, teams, display name, and selected reminder times are saved to `user_public_preferences`.

## Deploy setup

1. Apply `supabase/migrations/20261003110000_authenticated_public_preferences_and_reminders.sql` to the production Supabase project.
2. In the production Vercel environment, set `CRON_SECRET` to a random secret value. The reminder route rejects requests unless the matching bearer token is present.
3. Optionally set `PUBLIC_MATCH_TIMEZONE` if fixture date/time values use a timezone other than `Africa/Lagos`.
4. Enable `pg_cron`, `pg_net`, and Vault in Supabase. In the Supabase SQL Editor, run `supabase/scripts/schedule_public_match_reminders.sql` after replacing its URL and secret placeholders. The script schedules a one-minute job that calls the protected production route.

Supabase's `pg_cron` and `pg_net` support scheduled HTTP calls at one-minute intervals. Push delivery also requires the existing VAPID environment variables and an enabled browser subscription. The match centre lets each user choose which reminder offsets to receive.
