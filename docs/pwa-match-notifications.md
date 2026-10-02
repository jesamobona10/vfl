# PWA install and public match notifications

## Deployment setup

1. Apply `supabase/migrations/20261002_pwa_match_notifications.sql` and `supabase/migrations/20261002130000_public_event_player_names.sql` to the Supabase project before deploying the app update. They create the private push-subscription store, add the half-time deduplication field, extend the public match views, and expose linked player names in public events.
2. Generate one VAPID key pair with `npx web-push generate-vapid-keys --json`. Keep the private key secret and reuse the same pair across deployments.
3. Configure these Vercel environment variables for each deployment environment:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: generated public key.
   - `VAPID_PRIVATE_KEY`: generated private key.
   - `VAPID_SUBJECT`: a `mailto:` contact or the app's HTTPS URL.
4. Deploy over HTTPS. Users can install from the app prompt, then select **Notify me about match updates** on `/public` and allow browser notifications.

## Notification behavior

- The service worker handles Web Push while the site is closed or in the background.
- Match start, full-time, scoreline, goals, assists, cards, and other recorded match events send push alerts.
- Half-time is detected from the live clock by an open public match page, then deduplicated on the fixture before sending. Without a scheduled server-side job, half-time push delivery needs a visitor to have a live match page open during the half-time window.
- Public match events and alerts include the linked player's name. Player photos are not displayed.
- The live page subscribes to Supabase Realtime and refreshes a 20-second fallback poll; routine event updates no longer wait for the old three-second poll interval.
