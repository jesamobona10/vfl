# Match Logger — Implementation Guide

Adds a **Match Logger** to the main navigation, next to Dashboard, Competitions and Public Match Centre. It lists every fixture the user may log that is live or about to start, and opens a phone-first logging screen with large tactile keys for adding match events.

The design reference is the "Match Logger — Mobile UI" canvas (three artboards: Live matches, Match logger, Player picker). The agent can't open that link, so everything needed to build it is spelled out in section 4.

## 1. What already exists (reuse it, don't rebuild it)

| Need | Existing piece |
|---|---|
| Sidebar tabs | `app/org/[slug]/layout.tsx` (tab array `{ href, label, icon }` plus a `NAV_BY_ROLE` allow-list) |
| Clock and eligibility logic | `lib/logic/live.ts`: `livePhase`, `formatLiveClock`, `matchKickoff`, `isLiveEligible`, `liveSettings` |
| Live clock / badge UI | `components/live/live-clock.tsx`, `live-badge.tsx` |
| Event types and score effect | `lib/logic/events.ts`: `primaryEventTypes`, `secondaryEventTypes`, `scoreDelta()` |
| Two-step add-event flow | `components/fixtures/add-event-modal.tsx` |
| Start a match | `app/api/fixtures/[id]/start/route.ts` |
| Add event (authorized) | `app/api/fixtures/[id]/events/route.ts` (admin, or owner of either team; validates team and player) |
| Delete event | `app/api/events/[id]` (DELETE) |
| Toast with action and duration | `components/ui/toast.tsx` (`ToastAction`, `durationMs`) |
| Push on live updates | `lib/public-push.ts` |

**Verify before building:**
1. The scan found only `app/api/public/live/route.ts` under the live routes. An org-scoped live list may have been removed, so plan to add one (section 3).
2. Check which fields `livePhase` reads, and which transitions exist besides `start` (halftime, second half, pause, full time). Add any that are missing in Phase B.
3. Check whether the earlier-flagged RLS gap on event deletion by team accounts is closed. Undo depends on it working for coaches.
4. If `app/api/fixtures/[id]/report/analyses/[analysisId]/confirm/route.ts` still doesn't check that events belong to the fixture's two teams (finding #11), fix that before more write paths lean on it.

## 2. Navigation placement

- **Org layout tab array:** add `{ href: "/match-logger", label: "Match Logger", icon: Goal }` right after Competitions. `Goal` is available in the installed lucide-react version, and `Radio` is already used by Public Match Centre.
- **Role allow-list (`NAV_BY_ROLE`):** add the new entry for `org_admin` and `team_account`. Do not show it to any other role.
- **Coach sidebar (from the coach Google sign-in work):** Match Logger is the second item, after Dashboard. It is the coach's highest-frequency screen on match day.
- **Live badge on the tab:** extend `SidebarItem` with an optional `badge?: "live" | number`. Render a small pulsing dot or count in both `Sidebar` and `MobileNavDrawer` (they share the type). Show it only while the user has at least one live fixture.
- **Mobile shortcut:** below `lg`, show a "Live · N" pill in `AppHeader` that links to `/match-logger` when N > 0.
- **Focus mode:** `/match-logger/[fixtureId]` hides the global header and drawer on phones and shows only a back button (section 4, screen 2). On desktop it renders inside the normal shell as a centered column about 480px wide.

## 3. Routes, files and data

```
app/org/[slug]/match-logger/page.tsx                 Screen 1: live list
app/org/[slug]/match-logger/[fixtureId]/page.tsx     Screen 2: logger
app/org/[slug]/match-logger/[fixtureId]/layout.tsx   focus-mode wrapper
components/match-logger/
  live-match-list.tsx   live-match-card.tsx   sync-chip.tsx
  scoreboard.tsx        team-toggle.tsx       event-keypad.tsx
  tactile-key.tsx       timeline.tsx          undo-bar.tsx
  player-picker-sheet.tsx
lib/match-logger/haptics.ts   lib/match-logger/use-wake-lock.ts
lib/match-logger/submit-match-event.ts   (the single write seam)
lib/hooks/use-live-fixtures.ts   lib/hooks/use-match-events.ts
```

**Live list endpoint.** Add `GET /api/org/[slug]/live-fixtures` (or extend `GET /api/fixtures` with a `status` filter).
- Server-side scoping: org admin sees all fixtures in the org; a coach sees only fixtures where `ownsTeam` is true for the home or away team. Never trust a client-side filter.
- Include live and in-progress fixtures, plus "starting soon" using the existing eligibility rule (`isLiveEligible`, `matchKickoff`), not a new one.
- Return only what the cards need: ids, team names and logos, score, status, kickoff, competition and round, venue.

**Writes.** Route every write through `submitMatchEvent()`, which calls the existing `POST /api/fixtures/[id]/events`. This is the seam the later offline queue wraps.
- Add an optional `clientEventId` (UUID generated on each key press). Migration: nullable `client_event_id uuid` on `match_events` plus a partial unique index on (fixture FK column, `client_event_id`) where not null. On replay, return the existing row instead of inserting. This protects against double taps and, later, offline retries.
- Compute score effects with the existing `scoreDelta()`. The server stays the source of truth. The client may update optimistically and must reconcile with the response.
- Undo: add calls the existing DELETE for that event id. A delete hides the row immediately and sends the DELETE after about 5 seconds unless undone (the toast's `durationMs` and `action`).

**Live updates.** Subscribe to `match_events` and `fixtures` for the open fixture via Supabase Realtime, with polling as a fallback if the subscription drops. Keep the connection count in mind on your plan tier.

## 4. Mobile UI specification

### 4.1 Tokens (scoped to the logger root, independent of the app theme)

| Token | Value | Use |
|---|---|---|
| `--ml-bg` | `#07110B` | page |
| `--ml-surface` / `-2` / `-3` | `#0E1D14` / `#142A1D` / `#0A160F` | cards / keys / wells |
| `--ml-line` | `rgba(255,255,255,.08)` | borders |
| `--ml-text` / `--ml-muted` | `#EAF4EC` / `#93AB99` | text |
| `--ml-green` / `--ml-green-hi` | `#0F7C45` / `#19A25C` | brand, goal key |
| `--ml-live` | `#19B368` | live dot and label |
| `--ml-gold` | `#E2A729` | active state, clock, primary |
| `--ml-yellow` / `--ml-red` | `#F2C230` / `#C93B3B` | card keys |

Fonts: **Inter** for text; **Barlow Condensed** (600/700/800) for score, clock, minute and key labels. Radii: cards 22–24, keys 16–20, controls 14, pills 999. Every tap target is at least 44px. Frame width 390 with 20px side padding. Respect `env(safe-area-inset-bottom)`.

Contrast: white on red `#C93B3B` is about 5.0:1; dark ink `#1A1405` on gold and yellow is well above 4.5:1; muted text on the dark surfaces passes AA. Don't lighten the muted color.

### 4.2 Screen 1: Live matches

- **Top bar:** 44px menu button, title "Match Logger" (18/700) with "Org · season" beneath (12, muted), sync chip on the right ("Synced" with a green dot).
- **Filter chips (36px):** Live · N (active: gold fill, dark text), Soon · N, My team.
- **Section label** "LIVE NOW": 11/700, tracking .12em, muted.
- **Live card** (radius 22, padding 16): top row has a pulsing LIVE badge and the clock (Barlow 22/700). Middle is a 3-column grid with crest (44px circle with initials, or the team logo), team name (13/600) and score (Barlow 46/800). Bottom has competition and round (12, muted) and an "Open logger" key (44px high).
  - The user's own match gets a gold border and 4px soft gold halo and the label "LIVE · YOUR MATCH". Admins see all cards in the neutral style, with the "Open logger" key in the dark surface color.
- **Starting soon card:** compact, with a disabled "Start match" button until kickoff.
- **Footer note:** "You only see matches you're authorised to log."
- **States:** loading uses `components/shared/skeleton`; empty is "No live matches right now" with a link to Fixtures; error uses `error-banner` with retry.

### 4.3 Screen 2: Match logger

- **Header:** back button, competition name with "Round N · venue", sync chip.
- **Scoreboard** (height 148, radius 24, gradient `#14301F` to `#0E1D14`): crest (48px), names, score (Barlow 58/800), clock (24/700 gold) with a pulsing live dot, a 32px pause/resume button, and the phase label ("2ND HALF").
  - Phases: first half, half time, second half, full time. At full time the keypad is disabled and a "Finish match" step appears.
- **Team toggle** (height 52, inner padding 4, buttons 44, radius 12): selected team is gold with dark text; the other is transparent with muted text. It decides which team the next event is for. Both teams' coaches may log either team's events (the existing POST allows this).
- **Label:** "LOG EVENT · TEAM NAME" (11/700, tracking .12em).
- **Keypad:**
  - GOAL: full width, height 84, radius 20, green gradient, ball icon 30px, label Barlow 34/800 with .1em tracking.
  - Row of three (ASSIST, YELLOW, RED): height 68, radius 18. Yellow and red show a small card shape above the label.
  - Row of two (OWN GOAL at flex 1.5, MORE at flex 1): height 60.
  - MORE opens the remaining event types from `secondaryEventTypes`.
- **Timeline:** label "TIMELINE" and a count, then rows (height 46, radius 14) with minute (Barlow 20/700 gold), text ("Goal — Bello · assist Adeyemi") and the team code. Most recent first. Tap a row to open edit and delete (the edit sheet can come in v2).
- **Undo bar:** floats at the bottom (left/right 16, bottom 20 plus safe-area inset, height 56, radius 18, light surface): check badge, "Goal added · Bello 58'", and an "Undo · 4s" button. It appears after every add and disappears on timeout.
- **Offline state:** the sync chip becomes "Offline · N queued". The queue itself is a later piece; today the chip only reports success or failure.

### 4.4 Screen 3: Player picker (bottom sheet)

- **Sheet:** covers the screen below a 130px strip showing the dimmed scoreboard. Top radius 28, handle 40×4, padding 12/20/24.
- **Title row:** event icon and label (Barlow 28/800) with team name beneath; on the right a minute stepper (44px − and + buttons, minute Barlow 30/800 gold). The minute defaults to the live clock's current minute.
- **Step tabs:** "1 · Scorer" and "2 · Assist (optional)". The active tab has a gold underline.
- **Number grid:** 4 columns, gap 10. Each key is 68px high, radius 16, with the jersey number (Barlow 28/800) and surname (11). Selected: gold with dark text and `aria-pressed="true"`. Only players on the selected team are listed (the server validates this too).
- **Assist row:** 44px chips: None, then likely players. The selected chip has a green border.
- **Confirm key:** height 58, radius 18, green gradient, "CONFIRM GOAL" in Barlow 24/800.
- **Per event type:**
  - Goal: scorer, then optional assist; one confirm creates the goal and, if chosen, the assist event.
  - Own goal: list the players of the team that conceded. `scoreDelta()` already credits the opposing team.
  - Assist, yellow, red, and everything under MORE: single step.

### 4.5 Tactile key CSS (use as the base for `tactile-key.tsx`)

```css
.ml-key{border:0;display:flex;align-items:center;justify-content:center;gap:10px;
  touch-action:manipulation;user-select:none;-webkit-tap-highlight-color:transparent;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 6px 0 var(--edge),0 14px 22px rgba(0,0,0,.45);
  transition:transform .06s,box-shadow .06s}
.ml-key:active{transform:translateY(5px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 1px 0 var(--edge),0 4px 8px rgba(0,0,0,.45)}
@media (prefers-reduced-motion:reduce){.ml-key{transition:none}.ml-pulse{animation:none}}
```

Edge colors (`--edge`): goal `#074D2B`, neutral keys `#0A1710`, yellow `#8A6C0C`, red `#7E1F1F`, selected gold `#9A6F12`. Leave at least 10px between keys so the bottom edge isn't clipped.

## 5. Haptics, wake lock and tap safety

```ts
// lib/match-logger/haptics.ts
export type HapticKind = "tap" | "select" | "confirm" | "undo" | "error";
const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10, select: 12, confirm: [20, 30, 60], undo: 15, error: [40, 60, 40],
};
export function haptic(kind: HapticKind) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (localStorage.getItem("ml.haptics") === "off") return;
  navigator.vibrate(PATTERNS[kind]);
}
```

- Call `haptic()` only inside the press handler (it must run within a user gesture).
- **iOS Safari does not support the Vibration API.** Don't promise haptics on iPhones. There the feedback is the key press animation, plus an optional soft click sound the user can switch on in a small settings toggle (default off, since venues are loud). Add a user toggle for haptics too.
- **Screen wake lock:** keep the screen on while a match is open.

```ts
// lib/match-logger/use-wake-lock.ts
import { useEffect } from "react";
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => { try { lock = await navigator.wakeLock.request("screen"); } catch {} };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release().catch(() => {}); };
  }, [active]);
}
```
Verify wake lock behavior on a real iPhone, including the installed PWA, before relying on it.

- **Accidental taps:** keys are at least 56px (the goal key 84px); `touch-action: manipulation` prevents double-tap zoom; lock a key for about 400ms after a press; the `clientEventId` makes any double submission harmless anyway; use `overscroll-behavior: contain` on the sheet.
- **Accessibility:** real `<button>`s, `aria-pressed` on selected players and the team toggle, `aria-label` on icon-only buttons, a polite `aria-live` region announcing "Goal added, Chukwu, 64 minutes", focus trapped in the sheet and returned to the triggering key on close.

## 6. Two people logging the same match

Both coaches can write events for a fixture, so two phones can easily log the same goal. For v1:
- Show who else has the logger open (Supabase Realtime presence: "Also logging: Coach Musa").
- Warn when an event matches an existing one (same type, player, minute within 60 seconds) with "Looks like this was already logged. Add anyway?".
- A single-scorer lock with "Take over" is a reasonable v2 if conflicts actually show up.

## 7. Phases

**A. Navigation and list.** Tab, role allow-list, badge, header pill, live-fixtures endpoint, `use-live-fixtures`, Screen 1 with all states. *Done when:* a coach sees only their fixtures, an admin sees the whole org, and a not-yet-kicked-off match shows a disabled start.

**B. Logger core.** Focus-mode layout, scoreboard and phase controls (add any missing transitions), team toggle, keypad, picker sheet, `submitMatchEvent`, `clientEventId` migration, timeline, undo bar. *Done when:* a goal with an assist is logged in under five taps, the score and timeline update, undo reverses it, and a replayed request doesn't create a duplicate.

**C. Tactile and field-readiness.** Key CSS, haptics with settings toggle, wake lock, tap safety, accessibility pass. *Done when:* an Android phone vibrates on press, an iPhone falls back cleanly, and the screen stays on for a whole match.

**D. Live updates and concurrency.** Realtime subscription with polling fallback, presence, duplicate warning. *Done when:* an event logged on one phone appears on another within a couple of seconds.

**E. Tests and QA.** Unit tests for the haptics helper and event payload builders. Route tests that call the events endpoints as each role (coach of the home team, coach of the away team, a coach from another fixture, org admin, other-org admin) and a replayed `clientEventId`. Playwright at 390×844 for the full goal flow. Device matrix: Android Chrome, iOS Safari, installed PWA, a throttled 3G profile.

## 8. Guardrails

- Don't change `ownsTeam`, `requireOrgAdmin` or existing RLS policies. The only schema change is `match_events.client_event_id` and its partial unique index.
- Keep the events POST contract backward compatible; `clientEventId` is optional and additive.
- Build the picker from the existing `lib/logic/events.ts` types and `scoreDelta()`. Don't fork the event-type list.
- Keep `add-event-modal.tsx` for the desktop fixtures views until the logger has proven itself.
- No player names in anything public. The logger is authenticated-only and must not leak into the public Match Centre beyond what its visibility toggle allows.

## Ready-to-paste prompt

```
Implement the Match Logger per match-logger-implementation-guide.md, one phase at a time
(A to E). Before each phase post a short plan: files you'll touch, schema changes, risks.
Wait for approval. After each phase, report and stop.

Constraints: reuse lib/logic/live.ts, lib/logic/events.ts and the existing events routes;
all writes go through submitMatchEvent(); do not modify ownsTeam, requireOrgAdmin or
existing RLS policies; the only schema change is match_events.client_event_id plus a
partial unique index. Do not promise haptics on iOS; implement the specified fallback.
Keep CI (typecheck, lint, test, build) green at every step.
```
