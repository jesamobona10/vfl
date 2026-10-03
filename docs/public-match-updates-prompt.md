# Public Match Updates Page — Implementation Prompt

Builds on the existing `public_live` view (scores/status only, one consumer: `app/api/public/live/route.ts`) rather than replacing it — this is additive.

```
Implement a public, unauthenticated live match-updates page showing the
scoreline, status, and a running event timeline (goals, cards, assists) for
live and today's scheduled matches. No login required, matching the
existing public_live pattern.

1. ORG-LEVEL VISIBILITY TOGGLE (do this first — everything else depends on it)
   Add a `public_player_names_enabled boolean default false` column to
   organizations (migration against the existing organizations table from
   20260605_organizations.sql). Default OFF — an organization's admin must
   explicitly turn this on before any player's name appears on the public
   page. Add the toggle to the org settings UI, off by default for existing
   orgs too (the migration should not backfill this to true).

2. DATA LAYER — new view, additive to public_live
   Create `public_live_events` (or extend public_live — your call, but keep
   it a dedicated view/RPC, not a raw table grant, matching the existing
   public_live pattern): joins match_events to fixtures/teams, and
   conditionally includes the scoring/carded player's name only when the
   fixture's organization has public_player_names_enabled = true. When
   false, still return the event (type, minute, team) with player identity
   omitted — don't withhold the whole event, just the name. Scope to the
   same live/in-progress-or-today window the existing public_live view
   uses. Grant SELECT to anon on this view only, same as public_live.

3. REALTIME SUBSCRIPTION
   On the client, using the existing public/anon Supabase client
   (lib/supabase/public.ts), subscribe to Postgres changes on match_events
   and fixtures scoped to the relevant match_id, rather than polling.
   Update the scoreline and event timeline as changes arrive. Handle
   subscription cleanup on unmount and a reasonable reconnect/backoff if
   the Realtime connection drops.

4. PUBLIC PAGE
   New route (e.g. app/live/[matchId]/page.tsx): scoreline, live/status
   badge, and the event timeline from step 2, updating live via step 3.
   Add an entry point to it from the existing public fixtures/standings
   pages so a fan can actually discover a live match to follow — a "Live"
   badge/link on any fixture currently in progress.

GUARDRAILS
- Don't modify or remove the existing public_live view or its consumer
  (app/api/public/live/route.ts) — this is a new, additive surface.
- Don't add any field beyond what's explicitly decided here (no player
  photos, no contact info, no internal IDs) regardless of the visibility
  toggle's state.
- Keep this page's own rate limiting/abuse posture consistent with the
  existing public endpoint — this remains a fully public, unauthenticated
  surface.
- Confirm current Supabase plan's Realtime connection limits before this
  ships broadly — note it in the PR description, don't just assume headroom.
```
