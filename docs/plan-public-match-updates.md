# Plan: Public Match Updates Page

Implementation order matches the prompt: migrations first, schema views, API/data layer, UI, then tests/docs. All changes additive; `public_live` and its consumer remain untouched.

## 1) Migration: add org visibility toggle

File: `supabase/migrations/20260830_org_public_player_names.sql`

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS public_player_names_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

Rationale: default OFF, no backfill to true, as requested.

## 2) Migration: create `public_live_events` view

File: `supabase/migrations/20260831_public_live_events.sql`

```sql
-- Public live events view (additive). Joins match_events with fixtures/teams/org.
-- Player name only when org.public_player_names_enabled is true.
CREATE OR REPLACE VIEW public_live_events AS
SELECT
  f.id AS match_id,
  f.round,
  f.competition_id,
  f.season_id,
  f.organization_id,
  o.public_player_names_enabled,
  f.home_team_id,
  ht.name AS home_team_name,
  ht.logo_url AS home_team_logo,
  f.away_team_id,
  at.name AS away_team_name,
  at.logo_url AS away_team_logo,
  f.home_score,
  f.away_score,
  f.status,
  f.date,
  f.time::TEXT,
  f.venue,
  me.id AS event_id,
  me.event_type,
  me.minute,
  me.team_id,
  CASE
    WHEN o.public_player_names_enabled THEN p.name
    ELSE NULL
  END AS player_name,
  p.id AS player_id
FROM match_events me
JOIN fixtures f ON f.id = me.match_id
LEFT JOIN teams ht ON ht.id = f.home_team_id
LEFT JOIN teams at ON at.id = f.away_team_id
LEFT JOIN players p ON p.id = me.player_id
LEFT JOIN organizations o ON o.id = f.organization_id
WHERE (
  f.status IN ('live', 'in-progress')
  OR (f.status = 'scheduled' AND f.date = CURRENT_DATE)
);

GRANT SELECT ON public_live_events TO anon;
```

Notes: keep names omitted when toggle is false (player_name NULL). Still return event row. Uses LEFT JOINs defensively. Grant anon only.

## 3) Types (client)

File: `lib/types.ts`

Add `PublicLiveEventRow` (shape matches view) for typing client reads/subscriptions.

## 4) Public match page

Route: `app/live/[matchId]/page.tsx`

Responsibilities:
- Fetch initial events + match header from `public_live_events` filtered by `match_id`.
- Subscribe to Realtime on `match_events` (filter by match_id) and `fixtures` (filter by id=match_id) using `lib/supabase/public.ts`. Cleanup on unmount, backoff on disconnect.
- Render scoreline (teams, scores, status badge), event timeline. Show `player_name` only when present. No other PII.
- Loading/empty states, no auth.

## 5) Links to live matches

Add "Live" badge/link on fixtures currently `live`/`in-progress` pointing to `/live/[matchId]` on public-facing lists. Keep styling consistent.

## 6) Org settings toggle (UI)

Create `app/org/[slug]/settings/page.tsx` (org-level settings). Read org, add boolean toggle for `public_player_names_enabled`, default false, persisted. Add minimal org PATCH/GET API in `app/api/organizations/[slug]/route.ts` if needed (admin-only).

## 7) Verification

- Typecheck, lint, tests, build
- Toggle off hides names, on shows; Realtime updates; no changes to `public_live` or `app/api/public/live/route.ts`.

Guardrails: additive only. No PII beyond player name when explicitly enabled. Document Realtime limits in PR.
