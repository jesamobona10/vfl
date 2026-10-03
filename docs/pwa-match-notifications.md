# PWA install and public match notifications

## Deployment setup

1. Apply `supabase/migrations/20261002_pwa_match_notifications.sql`, `supabase/migrations/20261002130000_public_event_player_names.sql`, and `supabase/migrations/20261002140000_public_match_standings_stats.sql` to the Supabase project before deploying the app update. They create the private push-subscription store, extend the public match views, expose linked player names, and add public standings/player-statistics views.
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

## Notification tags

Every alert carries a `tag` that is unique per logical update, set by the call site and passed through `PublicPushPayload.tag` in `lib/public-push.ts`:

| Alert | Tag |
| --- | --- |
| Match event | `match-{id}-event-{matchEventId}` |
| Kick-off | `match-{id}-start` |
| Half-time | `match-{id}-halftime` |
| Scoreline | `match-{id}-score-{home}-{away}-{status}` |
| Full-time | `match-{id}-fulltime` |
| Kick-off reminder | `match-{id}-reminder-{leadMinutes}` |

This matters on Android. A push whose tag matches an existing notification replaces it in place, and Android performs that replacement silently, so the alert only updates the entry in the notification panel instead of raising a banner. Unique tags make each update its own notification while re-delivery of the same alert still collapses into one. If you add a new push call site, give it its own tag instead of reusing `match-{id}`.

## Android banner alerts

Android 8 and later only raise a heads-up banner for a notification channel at the highest importance. Chrome creates a per-site channel for web push that defaults lower, which delivers sound and a panel entry but no pop-up. Each user sets this once:

**Settings → Apps → Chrome → Notifications → LeagueForge → Importance → the top level**

Label that top level "Urgent" or "High" depending on the phone — Google's importance table names it *Urgent*, and *High* is a separate, lower level that only makes a sound:

| Setting label | Constant | Behaviour |
| --- | --- | --- |
| Urgent | `IMPORTANCE_HIGH` | Sound **and** heads-up banner |
| High | `IMPORTANCE_DEFAULT` | Sound only, stays in the panel |
| Medium | `IMPORTANCE_LOW` | Silent |
| Low | `IMPORTANCE_MIN` | Silent, hidden from the status bar |

**This cannot be automated.** Google's notification channel docs state: "Once you create a notification channel, you can't change the notification channel's visual and auditory behaviors programmatically. Only the user can change the channel behaviors from the system settings." That constraint applies to native apps, and a PWA is worse off — there is no web API for notification channels at all. `Notification.requestPermission()` resolves only `granted`, `denied`, or `default`; it grants browser-level permission and nothing more. Shipping a default-urgent channel would require a native Android wrapper (Bubblewrap TWA) with native code calling `createNotificationChannel(..., IMPORTANCE_HIGH)`.

The `urgency: "high"` header set in `lib/public-push.ts` affects delivery speed only. It cannot promote a notification to a banner.

The alert control on `/public` shows this reminder on Android devices, immediately after alerts are enabled, and it can be dismissed for 30 days. Battery optimisation on some Samsung and Xiaomi devices can also suppress banners; excluding Chrome from battery restrictions helps.

Service worker notifications are sent with `silent: false`, a vibration pattern, and a **View match** action button. Tapping the notification or the action opens `/public/live/{matchId}`.
