# LeagueForge — App Flow, System Design, UX & UI Improvement Guide

Five phases, ordered by dependency: each phase builds on the one before it, and each is small enough to review and merge on its own.

**Excluded by request:** the "cover every state in the coach flow" item (the dedicated screen for a signed-in coach whose email isn't linked to a team).

**Out of scope here (seams only):** billing/payment integration, the WhatsApp channel, and the offline event queue. The guide leaves clean places for each to plug in later, but doesn't build them.

## Verified starting point

| Area | Current state |
|---|---|
| Error tracking | None. No Sentry-style dependency in `package.json`. |
| Route boundaries | 5 `loading.tsx` and 3 `error.tsx` across 35 pages. |
| Shared primitives | `components/ui/` has only `modal` and `toast`. `components/shared/` has `confirm-dialog`, `data-table`, `skeleton`, `error-banner`. |
| Radius scale | Mixed: ~105 `rounded-lg`, ~53 `rounded-xl`, ~12 `rounded-md`. |
| Status colors | `live` and `danger` tokens exist in `tailwind.config.ts` (CSS-variable based, with tints). No upcoming, finished or cancelled tokens. |
| CI | `ci.yml` runs typecheck, lint, test, build. `season-smoke.yml` also exists. |
| Tests | 14 test files, but `vitest.config.ts` only includes `lib/**/*.test.ts`, so route tests aren't picked up. |
| Branding | `organizations` migration defines `logo_url` only (confirm no later migration added colors). |
| Notifications | Push exists (`lib/public-push.ts`, `Promise.allSettled` via `after()`). In-app notifications are still created inline inside individual routes. |

---

## Phase 1 — Safety net

Do this first. Everything after it ships faster when failures are visible.

### 1.1 Error tracking
- Add `@sentry/nextjs` (or equivalent). Wire it into `lib/utils/error-message.ts` and the existing `logApiError` helper so server errors are captured with their route name.
- Tag events with `organization_id` and role. **Never send player names, emails or other personal data.** Set `sendDefaultPii: false` and add a `beforeSend` scrubber. This app holds minors' data.
- **Done when:** a deliberately thrown error in an API route and in a client component both appear in the dashboard with route and org tags, and no personal data.

### 1.2 Route-level boundaries
- Add `loading.tsx` and `error.tsx` to every data-fetching segment under `app/org/[slug]/` (including `competitions/[cId]/*`) plus a `global-error.tsx`. Reuse `components/shared/skeleton.tsx` and `error-banner.tsx`. Errors in boundaries should report to Sentry from 1.1.
- **Done when:** forcing a failure in one panel leaves the rest of the page usable, and every segment that fetches data has both files.

### 1.3 Authorization tests across roles
- Change `vitest.config.ts` to include `app/api/**/*.test.ts`.
- Build a small role-matrix helper. Roles: anonymous, coach (own team), coach (other team), org admin (own org), org admin (other org), super admin. For each mutating route, assert the expected status per role.
- Start with the routes that have historically broken: `fixtures/[id]/events` (POST), `events/[id]` (DELETE), `fixtures/[id]/report/analyses/[id]/confirm`, `seasons/*`, `transfers`.
- Use a real local Supabase in CI for these (extend the pattern in `season-smoke.yml`) rather than mocking the client. Mocks hide exactly the RLS behavior these tests exist to check.
- **Done when:** CI fails if any listed route accepts a role it should reject.

---

## Phase 2 — UI foundation

### 2.1 Shared primitives
Create in `components/ui/`: `Button` (primary, secondary, ghost, danger; sizes; loading state), `Input` / `Select` / `Textarea` (label, hint, error), `Card` (header, body, footer), `Badge` (status variants).
- Accessibility lives here, once: visible focus ring, `aria-busy` on loading buttons, `aria-invalid` plus described-by on errored fields.
- Migrate by screen priority: dashboard, fixtures, admin, auth. Do not big-bang it.
- **Done when:** raw `<button` and hand-rolled card/input class strings appear only inside the primitives, and `rounded-md` is gone outside them.

### 2.2 Design tokens
- Radius rule: controls `rounded-lg`, cards and panels `rounded-xl`, pills `rounded-full`. Convert outliers to match.
- Add a small type scale (page title, section title, body, caption) as named Tailwind classes, and reuse the existing spacing rhythm.
- Complete the status palette using the same CSS-variable pattern as `live` and `danger`: add `upcoming`, `finished`, `cancelled`, each with a tint, in light and dark themes. Use them identically in fixtures, standings and the public page, through `Badge`.
- Check contrast (WCAG AA, 4.5:1 for text) in both themes.
- **Done when:** a fixture's status looks identical on every screen where it appears.

### 2.3 Table standard
- Extend `components/shared/data-table.tsx`: sticky header, sticky first column, built-in loading and empty states, and a card layout below `md`.
- Adopt it in standings, players, fixtures lists and audit logs.
- Verify the standings PNG export passes an explicit width to `exportAsPNG` (the default is phone-width and breaks wide tables).
- **Done when:** every wide table scrolls with its first column pinned on a phone.

---

## Phase 3 — Platform plumbing

### 3.1 Central notification dispatcher
- New `lib/notifications/dispatch.ts` exposing `dispatchMatchEvent(event)`. Define a small `NotificationChannel` interface (`name`, `send(payload, recipients)`) with adapters for in-app (the existing inserts) and push (the existing `lib/public-push.ts`). A future WhatsApp adapter implements the same interface.
- Run fan-out inside `after()` so it never blocks the request, isolate channel failures with `Promise.allSettled`, and log each failure.
- Add an idempotency key per source event so a retried request can't send twice.
- Replace the inline notification inserts in routes (for example `players/[id]`) with calls to the dispatcher.
- **Undo interaction (decide now):** v1 dispatches immediately. If an event is removed shortly after, the public page corrects itself live and no second push is sent. A delayed-send outbox with a grace window is a later option, but it needs a scheduler and isn't worth it yet.
- **Done when:** no route inserts a notification directly, and a failing push does not affect in-app delivery.

### 3.2 Entitlement check, built once
- New table `season_entitlements` (`organization_id`, `org_season_id`, `status`, `starts_at`, `ends_at`). Keep billing state out of the core season tables.
- New `lib/entitlements.ts` exporting `canManageSeason(orgId, seasonId)`, plus a route helper that rejects writes (create fixtures, start a season, log live events, roll over) when it returns false.
- **Read access is never gated.** Completed seasons stay fully viewable.
- Grandfather every existing organization as active until billing exists, so this ships with no behavior change.
- **Done when:** one function decides write access, no route has its own billing logic, and flipping one row to expired blocks writes but not reads.

### 3.3 Per-organization branding
- Add `brand_color` to `organizations` (migration). Validate server-side: hex format, plus a contrast check that picks a readable foreground automatically.
- Settings UI with a live preview. Inject as a CSS variable (for example `--brand-rgb`) at `app/org/[slug]/layout.tsx` and on the public pages, following the existing rgb-variable pattern. Flyers and exports read the same value.
- Fall back to the default brand when unset or invalid.
- **Done when:** changing the color updates the console, public page and flyer, and an unreadable color is rejected.

---

## Phase 4 — UX

### 4.1 Standard states
- Every list or data screen shows skeleton, then empty (with one primary action), then error (with retry). Consolidate the scattered empty states into one `components/ui/empty-state.tsx`.
- Audit all 35 pages against that rule and fix the gaps.

### 4.2 Hide what a role can't do
- Add one client helper (for example `useCan(action)`) backed by the existing auth store. Replace ad-hoc `isOrgAdmin &&` checks with it.
- Two different behaviors: **hide** actions the role never has; **disable with a visible reason** when the cause is temporary (for example "Subscription ended, renew to create fixtures"). The second depends on 3.2.

### 4.3 Undo for match events
- Extend `components/ui/toast.tsx` to support an action button. Undoing an add calls the existing delete for that event id. Deleting an event hides it immediately and sends the delete after about five seconds unless undone.
- Before building this, verify the earlier-flagged gap where event deletion by team accounts is filtered out by RLS and still returns success. Undo depends on deletion actually working for coaches.
- **Done when:** a mistaken goal can be reversed in one tap, and standings and the live score reflect it.

### 4.4 Public Match Centre as a growth surface
- Share button (Web Share API with copy-link fallback).
- `generateMetadata` with a dynamic OG image showing the scoreline.
- "Follow this team" button wired to the existing `app/api/public/push-subscriptions` route and preferences.
- **Privacy guardrail:** shares, link previews and OG images must not include player names unless `public_player_names_enabled` is on for that organization.

---

## Phase 5 — App flow

### 5.1 Context bar
- Build on `useOrgSeason` (`components/competitions/org-season-provider`). Show organization, selected season, and (inside a competition) the competition, with breadcrumbs and a season switcher in the header. Mount it from `app/org/[slug]/layout.tsx`.
- **Done when:** on any screen, a user can tell whether they're looking at org-wide season data or one competition's data.

### 5.2 Competition type drives setup
Today the type only changes a label, and friendlies get the full round-robin (the generate route only checks the type is one of three).
- **League:** unchanged, round-robin.
- **Cup:** existing bracket logic (`lib/logic/cup.ts`).
- **Friendly:** "Add fixture" is the primary action. Add "Generate N games per team": `generateFriendlyFixtures` in `lib/logic/round-robin.ts`, a seeded shuffle then the first N rounds of the existing circle method. Constraints: N ≤ teams − 1; with an odd team count N teams get N−1 games, so offer a manual fixture to balance. Optional filter to only pair teams in the same category.
- Branch `app/api/competitions/[id]/generate-fixtures/route.ts` on `competition.type`. Hide the standings tab for friendlies (`competitions/[cId]/layout.tsx`). Add `counts_toward_stats` to competitions (migration), default off for friendlies.
- Unit-test the generator with Vitest: no repeat opponents, correct game counts, odd-team behavior, seed reproducibility.

### 5.3 Match mode
- A dedicated phone-first screen for match day, reachable from a fixture: scoreboard, large Goal/Card buttons (reuse the two-step add-event modal logic), live timeline with undo from 4.3.
- Route every write through a single `submitMatchEvent` function. That is the seam where the offline queue wraps later; don't build the queue here.
- **Done when:** a coach can start a match, log five events and finish it on a phone without leaving one screen.

---

## Guardrails

- Don't change `ownsTeam`, `requireOrgAdmin` or any existing RLS policy as part of these phases. New tables get org-scoped RLS the same way as every other org table.
- Schema changes are limited to what's listed: `season_entitlements`, `organizations.brand_color`, `competitions.counts_toward_stats`.
- Keep every phase independently mergeable, and make sure CI (typecheck, lint, test, build) passes before moving on.
- Nothing personal in error reports, shares, link previews or OG images.

## Ready-to-paste prompt

```
Implement the LeagueForge improvement guide (app-improvement-implementation-guide.md)
one phase at a time, in order. Before starting each phase, post a short plan: the
files you'll touch, any schema changes, and risks. Wait for approval. After each
phase, report what changed and stop; do not continue into the next phase unprompted.

Constraints: do not modify ownsTeam, requireOrgAdmin or existing RLS policies. Only
add the schema changes named in the guide. Keep CI green at every step. Never send
or expose personal data (player names, emails) in error tracking, share links, or
OG images unless public_player_names_enabled is on for that organization.
```
