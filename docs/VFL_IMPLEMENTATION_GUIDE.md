# VFL / LeagueForge — Product, UI/UX and Frontend Implementation Guide

**Document version:** 1.0  
**Prepared:** 26 October 2026  
**Repository:** [jesamobona10/vfl](https://github.com/jesamobona10/vfl/tree/main)  
**Branch reviewed:** `main`  
**Purpose:** A practical implementation blueprint combining the VFL product review with the additional LeagueForge design critique and feature-integration recommendations.

---

## 1. Executive direction

VFL already has a substantial football-management foundation. The next release should not be a wholesale visual redesign or a collection of unrelated new modules. It should make the existing capabilities work together around the actual work an organization performs throughout a season.

**Product direction: move from managing football data to managing the operations of a football organization.**

The next version should be built around three core experiences:

1. **Organization Operations Centre** — the administrator's daily control room, showing what is happening, what needs attention and what action should happen next.
2. **Matchday Hub and Match Workspace** — one place to prepare, operate, review and publish a match.
3. **Staff and Role Management** — individual, accountable access for owners, administrators, competition managers, coaches and match officials.

These experiences should connect the existing competitions, seasons, teams, players, fixtures, lineups, match events, statistics, media, reports, notifications, exports and audit history.

### What should stay the same

- Retain the current visual identity, colour direction, general component language and responsive layout approach.
- Retain existing capabilities that are working; improve their discoverability and integration before replacing them.
- Preserve historical competition and season data.
- Keep public Match Centre access separate from authenticated organization operations.
- Continue using the existing Next.js, Supabase and Vercel foundation unless implementation evidence demonstrates a need to change it.

### What should change

- Organize navigation around tasks and workflows rather than exposing every data area as a peer destination.
- Make dashboards action-oriented rather than predominantly metric-oriented.
- Consolidate match operations into one workspace.
- Provide organization-level task visibility and reliable approval queues.
- Make staff access individual, scoped and auditable.
- Finish design-system consistency and accessibility work incrementally.
- Make important cross-feature updates reliable, traceable and recoverable.

---

## 2. Review scope and confidence

This guide combines:

- The repository review of the VFL `main` branch, including organization and competition layouts, dashboards, team/player experiences, fixture cards, lineup APIs, player imports, notification dispatch and selected management routes.
- The design critique and code-scan findings pasted by the project owner from Claude.
- The earlier product recommendations for the Organization Operations Centre, Matchday Workspace, staff permissions, registration and eligibility, organization settings, analytics and season archives.

**Important limitation:** the repository review examined source code and architecture, not fully rendered screens in a live browser. Visual claims about exact spacing, real-device contrast, perceived hierarchy and first impressions need screenshots and manual browser/device testing.

Claude's code-scan counts — for example, the reported number of raw buttons, `.btn*` usages, native selects, small text classes, hardcoded colours and image elements — are useful baselines, but should be rerun against the current branch before turning them into strict migration targets. This guide treats them as audit signals, not immutable facts.

### Confirmed existing foundations observed in the repository

| Area | Existing implementation observed | Design implication |
|---|---|---|
| Organization workspace | Organization route layout, sidebar, context bar and season selector | Improve the existing shell; do not introduce a second organization shell. |
| Organization dashboard | Metrics, upcoming matches, top-five standings, recent activity, competitions, calendar and setup checklist | Evolve into an Operations Centre with action queues. |
| Competition workspace | Overview, standings, statistics, Team of the Round, schedule, teams, players, results and settings | Consolidate the nine destinations into fewer task groups. |
| Match events | Fixture cards, event modal, score/event API and a five-second undo window | Bring event entry and correction into Matchday Hub. |
| Lineups | Formation builder, team submission, administrator review and public lineup display | Integrate submission and approval states into match preparation. |
| Lineup timing | Fixture lineup API uses a pre-kickoff submission window | Make deadlines visible and explain why submission is or is not available. |
| Match media | Photo/video upload queue, TUS upload flow, poster generation and moderation states | Build a moderation queue and connect publishing to the public Match Centre. |
| Player imports | CSV upload, preview and optional season registration | Add field mapping, duplicate resolution, import outcomes and registration data. |
| Team accounts | Organization screen to create accounts for unassigned teams; reset/deactivation API exists | Improve the user interface and plan a gradual move to individual staff accounts. |
| Organization members | An invite/member API exists with role validation | Build the staff-management interface on top of the existing API and extend carefully. |
| Season context | Organization and competition season selection is persisted in URL query parameters | Keep URL-backed context and make the selected scope unmistakable. |
| Notifications | Shared dispatcher and public web-push implementation | Add durable delivery tracking before making critical delivery promises. |
| Audit activity | Organization recent activity and audit APIs | Reuse audit history in entity-level history drawers. |

Useful repository references:

- [Organization dashboard](https://github.com/jesamobona10/vfl/blob/main/app/org/%5Bslug%5D/dashboard/page.tsx)
- [Organization layout](https://github.com/jesamobona10/vfl/blob/main/app/org/%5Bslug%5D/layout.tsx)
- [Organization context bar](https://github.com/jesamobona10/vfl/blob/main/components/layout/org-context-bar.tsx)
- [Organization season provider](https://github.com/jesamobona10/vfl/blob/main/components/competitions/org-season-provider.tsx)
- [Competition layout/navigation](https://github.com/jesamobona10/vfl/blob/main/app/org/%5Bslug%5D/competitions/%5BcId%5D/layout.tsx)
- [Fixture card](https://github.com/jesamobona10/vfl/blob/main/components/fixtures/fixture-card.tsx)
- [Match event modal](https://github.com/jesamobona10/vfl/blob/main/components/fixtures/add-event-modal.tsx)
- [Match media manager](https://github.com/jesamobona10/vfl/blob/main/components/fixtures/match-media-manager.tsx)
- [Fixture lineup component/API](https://github.com/jesamobona10/vfl/tree/main/components/fixtures)
- [Player import modal](https://github.com/jesamobona10/vfl/blob/main/components/players/player-import-modal.tsx)
- [Notification dispatcher](https://github.com/jesamobona10/vfl/blob/main/lib/notifications/dispatch.ts)
- [Team account management page](https://github.com/jesamobona10/vfl/blob/main/app/org/%5Bslug%5D/team-accounts/page.tsx)
- [Organization member API](https://github.com/jesamobona10/vfl/blob/main/app/api/org/members/route.ts)

---

## 3. Product principles

Apply these principles to every new or revised screen.

### 3.1 Workflow before decoration

Do not add cards, charts or tabs unless they help a user complete a real task. Prefer fewer, connected screens over many isolated destinations.

### 3.2 Context must always be visible

A user should be able to tell which organization, competition and season they are viewing. This is especially important because the system has both organization-season and competition-season contexts.

### 3.3 Actions before vanity metrics

Show pending work, exceptions and next actions prominently. Metrics should provide context, not compete with tasks.

### 3.4 One entity, one operational home

- Match operations belong in the Match Workspace.
- Player identity, eligibility and history belong in the Player Profile.
- Team identity, roster and staff belong in Team Management.
- Competition rules, stages and schedules belong in Competition Management.
- Cross-organization tasks belong in the Organization Operations Centre.

### 3.5 Role-aware, not role-fragmented

Users should see the actions relevant to their responsibilities. Do not create separate copies of the same feature for every role when one well-scoped component can serve them safely.

### 3.6 Clear states and safe recovery

Every important workflow needs loading, empty, error, success, disabled, pending and retry states. A write should not look successful until the server confirms it.

### 3.7 Mobile-first for pitch-side work

Matchday, lineup submission, event logging, player lookup and fixture updates need comfortable phone layouts and touch targets. Desktop can expose denser controls; mobile should prioritize the next action.

---

## 4. Target navigation and information architecture

### 4.1 Organization navigation

Keep the main organization navigation short and predictable. Recommended structure:

| Main destination | Contents |
|---|---|
| **Overview** | Organization Operations Centre |
| **Competitions** | Competition list and each competition workspace |
| **Matchday** | Organization-wide matchday board and match workspaces |
| **People** | Teams, players, staff, team accounts and registration |
| **Settings** | Organization profile, staff permissions, venues, registration, notifications and data management |
| **Public Match Centre** | Public-facing organization match experience; retain as a preview/open-public action where useful |

The current shell has Dashboard, Competitions, Players, Teams, Team Accounts and Public Match Centre. Reorganize labels and grouping without removing capabilities. For example, Teams, Players and Team Accounts can become tabs or sections within People. Do not bury frequent tasks too deeply.

The `Matchday` destination is a new route proposal, for example `/org/[slug]/matchday`. It should not duplicate the competition schedule. It should aggregate relevant fixtures across competitions for the selected date and organization.

### 4.2 Competition navigation: reduce nine peer tabs to five groups

The current competition shell exposes nine destinations: Overview, Standings, Statistics, Team of the Round, Schedule, Teams, Players, Final Match Results and Settings.

Recommended top-level navigation:

1. **Overview**
2. **Matches** — segmented views: Schedule, Matchday/Live, Results
3. **Table & Stats** — standings, statistics and Team of the Round
4. **Participants** — teams and players
5. **Settings** — competition and season configuration

This is a grouping change, not a deletion of features. Preserve deep links to existing destinations during migration. Old routes can continue to render the relevant tab or redirect to its new location after the new navigation is stable.

### 4.3 Global search and command palette

Upgrade existing global search into a command palette:

- Keyboard shortcut: `Ctrl/Cmd + K`.
- Search teams, players, fixtures, competitions and staff.
- Offer actions such as “Create fixture”, “Import players”, “Open matchday”, and “Go to organization settings”, subject to permissions.
- Recent items should be available without searching again.
- Never expose entities from another organization to a user who lacks access.

### 4.4 Navigation acceptance criteria

- A first-time organization administrator can identify where to create a competition, register a team and schedule a match without help.
- A coach can find their team's players, upcoming matches and lineup submission in no more than two navigation steps.
- A match official can open an assigned fixture directly from a notification or Matchday list.
- No navigation item leads to an empty or forbidden page for that role.
- Existing deep links and browser back/forward behaviour continue to work.

---

## 5. Organization Operations Centre

**Priority: P0 — first major user-facing improvement.**

### 5.1 Purpose

Turn the current dashboard into an operations workspace. The administrator should quickly understand:

- What is happening today?
- What needs attention?
- What is the next important action?
- Is the organization ready for upcoming fixtures?
- Are competitions and registrations progressing normally?

### 5.2 Proposed dashboard layout

**A. Context header**

- Organization name and logo.
- Selected organization season.
- Current competition selector/filter where appropriate.
- Date context, timezone and a compact “last updated” indicator.

**B. Key performance summary**

Use a small number of useful metrics: registered teams, registered players, fixtures played, fixtures remaining and competitions currently active. Each metric should link to the relevant filtered list.

**C. Needs Attention queue**

This is the most important panel. Show actionable items with severity, owner/responsible role, due date and a direct link.

Initial task types:

- Fixtures missing date, kickoff time or venue.
- Matches scheduled for today that need an official or matchday preparation.
- Lineups awaiting review.
- Lineups not submitted before the configured deadline.
- Completed matches awaiting score/result confirmation.
- Reports awaiting review or confirmation.
- Media awaiting moderation/publication.
- Teams missing a manager.
- Player registration or eligibility records needing verification.
- Competition setup incomplete.
- Notification delivery failures.

Do not list “expired subscription” until a real entitlement and billing workflow exists. Do not show “unclaimed invite” unless invite status and expiry are persisted and queryable.

**D. Today's and next matches**

Show time, venue, teams, competition, status and a single primary action. Make live matches visually distinct without relying on colour alone.

**E. Competition progress**

Compact competition cards: current stage, fixtures completed/total, teams registered, next milestone and a link to the competition workspace.

**F. Recent activity**

Keep the existing audit-backed activity feed but make items readable (“Fixture venue changed by …”) and link to the affected entity. Use relative time plus exact timestamp on hover/detail.

**G. Quick actions**

Create competition, register team, import players, generate schedule, create announcement and open Matchday. Only show actions the current user is allowed to take.

### 5.3 Needs Attention data model

Do not implement this as a list of hardcoded strings in the dashboard. Prefer a derived task service initially, with a durable task table only when tasks need explicit assignment, acknowledgement, due dates or manual resolution.

Suggested normalized task object:

```ts
 type OrganizationTask = {
   id: string;
   organizationId: string;
   competitionId?: string;
   seasonId?: string;
   fixtureId?: number;
   type: string;
   severity: "info" | "warning" | "critical";
   title: string;
   description?: string;
   href: string;
   ownerUserId?: string;
   dueAt?: string;
   status: "open" | "in_progress" | "resolved" | "dismissed";
   createdAt: string;
 };
```

For derived tasks, use deterministic IDs based on the underlying record and task type. This prevents duplicates when the dashboard refreshes. If task ownership and completion are required, persist those fields and link the task to the source entity.

### 5.4 Operational rules

- A missing venue is an exception only when the competition or organization requires venues.
- A lineup task should use the competition's configured submission window, not a hardcoded deadline in the dashboard.
- A report task should only appear when the match type/configuration requires a report.
- “Today” must be calculated in the organization's configured timezone, not whichever timezone the browser happens to use.
- A task should disappear only when the underlying state is resolved or a permitted user dismisses it.
- Each task should have one clear next action.

### 5.5 Acceptance criteria

- Dashboard shows real tasks from the selected organization's data.
- Each task links directly to the record and action that resolves it.
- Role permissions determine whether a user can resolve a task or only view it.
- Dashboard counts match the underlying filtered records.
- Refreshing or changing season does not show stale tasks from the previous season.
- The page remains useful when a section fails to load; a failed statistics panel must not hide the task queue.

---

## 6. Matchday Hub and Match Workspace

**Priority: P0 — defining workflow improvement.**

### 6.1 Matchday Hub

Create an organization-wide Matchday board, scoped by date and optional competition/team filters. Suggested views:

- **Today** — all fixtures for the organization on the selected local date.
- **Live** — matches currently in progress.
- **Needs action** — missing preparation, lineup review, result confirmation, report review or media moderation.
- **Upcoming** — future fixtures, grouped by date.
- **Recently completed** — finished matches with outstanding post-match work.

Each fixture row/card should show:

- Home and away team names/logos.
- Kickoff time and venue.
- Competition and round/stage.
- Match status and score, when available.
- Lineup readiness (e.g. not submitted, pending review, approved).
- Official assignment, if enabled.
- Report and media completion indicators.
- A single “Open Match Workspace” action.

Offer a compact list view for administrators managing many fixtures and a card view for smaller screens.

### 6.2 Match Workspace

All operations for one match should be reachable within one workspace. The workspace should have a persistent scoreboard and five sections:

| Section | Responsibilities |
|---|---|
| **Overview** | Fixture details, teams, status, venue, referee/official and operational checklist |
| **Live Events** | Goals, assists, own goals, cards, saves, substitutions and other supported events; event timeline and correction/undo |
| **Lineups** | Submitted formations, starting XI, substitutes, approval/rejection and review notes |
| **Media** | Photos/videos, upload progress, captions, moderation and public publication |
| **Report** | Match summary, statistics, AI-assisted draft analysis, human review and publication |

Possible route: `/org/[slug]/matchday/[fixtureId]` or a competition-scoped equivalent. Choose one canonical route and use redirects/links from existing fixture cards and competition schedules.

### 6.3 Separate match status from operational workflow status

Do not overload the existing fixture `status` field with every administrative step. Keep the match state focused on football reality:

- `scheduled`
- `live` / `in-progress` (choose one canonical representation and preserve compatibility if both are in active use)
- `completed`
- `postponed`
- `cancelled`

Track operational states separately:

- Home lineup: not submitted / pending / approved / rejected.
- Away lineup: not submitted / pending / approved / rejected.
- Result: not entered / entered / awaiting confirmation / confirmed / disputed.
- Report: not required / draft / awaiting review / approved / published.
- Media: none / awaiting moderation / published / rejected.

A match can be completed while its report is still awaiting review. Those are different concepts and should not be collapsed into a single status.

### 6.4 Matchday checklist

For each match, display a configurable checklist such as:

**Before kickoff**
- Fixture details confirmed.
- Venue confirmed.
- Match official assigned (when required).
- Home and away lineups submitted.
- Lineups reviewed/approved.

**During match**
- Live status started.
- Events recorded.
- Score verified.

**After match**
- Final score entered and confirmed.
- Player statistics recalculated.
- Disciplinary consequences checked.
- Match report reviewed.
- Media moderated and published.
- Public Match Centre updated.
- Notifications delivered or failures surfaced.

The checklist should be configurable at competition level so friendlies and tournaments do not inherit irrelevant requirements.

### 6.5 Event logging and corrections

The existing event modal and five-second undo approach are good building blocks.

Improve the flow:

- Keep the score visible throughout event entry.
- Let the operator select the event type first, then the team, player and minute.
- Filter player selection to the participating team's eligible roster by default.
- Support unattributed team goals only where allowed, and flag them for later attribution.
- Confirm event details before applying unusually consequential actions if needed.
- Show an event timeline with edit/delete permissions and actor attribution.
- Ensure undo reverses the event, score, player statistics, standings impact and notifications where applicable.
- Make a correction auditable; do not erase the fact that a result was previously changed.

Important: the goal-recording endpoint already uses a database RPC for atomic score updates. Extend the same consistency principles to the full event → statistics → standings → notification workflow. Do not compute critical competition state independently in multiple client components.

### 6.6 Lineup workflow

Connect existing submission/review functionality to the Matchday Hub:

- Coach sees the submission window and countdown.
- Coach sees eligible players, suspended/ineligible players and an explanation when someone cannot be selected.
- Coach can select a formation and starting XI/substitutes.
- Coach sees submission confirmation and can revise only while the rules permit it.
- Admin/reviewer sees pending submissions in a queue and can approve or reject with a reason.
- Both teams can see the current approved state.
- Reminder notifications are sent before the deadline, with delivery status recorded.

The existing API has a two-hour pre-kickoff submission window. Keep that as the current default, but make it competition-configurable before claiming that all competitions must use two hours.

### 6.7 Media and report workflow

Media:

- Reuse the current upload queue, TUS upload mechanism, video poster generation and moderation states.
- Add a moderation inbox across matches.
- Provide bulk approve/reject where safe.
- Show upload/processing/publishing status explicitly.
- Make publication update the public Match Centre without a second manual upload.

Reports:

- Make an AI-generated report a draft, never an automatically published final statement.
- Link report claims to recorded match events and statistics where possible.
- Show unsupported or uncertain information for human review.
- Let the reviewer edit and confirm the report.
- Keep a revision history and author/approver identity.
- If the AI provider fails, preserve the user's input and offer manual completion.

### 6.8 Acceptance criteria

- Administrators can prepare, operate and close out a match without navigating among unrelated sections.
- Coaches can submit lineups from a phone.
- Accidental event logging can be reversed and all derived views return to a consistent state.
- Match media and report publication lead to the correct public Match Centre content.
- A match's football state and its administrative completion state are both visible.
- Every important action is attributable to a user and timestamp.

---

## 7. Staff, roles and permissions

**Priority: P0/P1 — prerequisite for organization-scale operation.**

### 7.1 Target roles

Use a small number of understandable roles backed by capability checks and scope assignments.

| Role | Typical scope | Core responsibilities |
|---|---|---|
| Organization Owner | Entire organization | Organization settings, staff, all competitions and data governance |
| Organization Admin | Entire organization or delegated areas | Teams, players, competitions, fixtures, results and approvals |
| Competition Manager | Assigned competition(s) | Competition setup, schedule, match operations and reports |
| Team Manager / Coach | Assigned team(s) | Team roster, lineup, team details and reschedule requests |
| Match Official | Assigned fixture(s) | Match events, match timing and designated result/incident reporting |
| Player | Own player profile | Personal statistics, match history and achievements |
| Public Viewer | Public organization/competition data | Read-only public Match Centre |

Avoid creating a role for every possible job immediately. Begin with Owner, Admin, Coach/Team Manager, Competition Manager and Match Official. Keep Player and Public Viewer read-only.

### 7.2 Individual staff accounts

The current team-account model is useful as a legacy/simple login option but is not sufficient as the long-term organizational accountability model.

Move toward:

- One login per person.
- Membership in one or more organizations.
- Optional assignment to one or more teams and competitions.
- Explicit capabilities per scope.
- Individual audit attribution.
- Invite, accept, suspend, reactivate and remove lifecycle.
- Password reset/recovery managed through a secure account process.

Do not break existing team accounts in one release. Support a migration period: existing team accounts continue to work while organizations invite named staff and gradually switch over.

### 7.3 Permission model

Prefer capability checks such as:

- `organization.manage`
- `members.invite`
- `members.manage`
- `competition.create`
- `competition.manage`
- `teams.manage`
- `players.manage`
- `players.verify`
- `fixtures.manage`
- `lineups.submit`
- `lineups.review`
- `match.events.create`
- `match.events.correct`
- `match.result.confirm`
- `match.report.review`
- `match.media.moderate`
- `announcements.publish`
- `exports.create`

Capabilities must be enforced in the API and database RLS policies, not merely by hiding buttons. Reuse the existing authorization helpers and `useCan` pattern; extend the permission matrix and tests as new scopes are added.

### 7.4 Approval and delegation

- Competition Managers may manage assigned competitions without organization-wide access.
- Match Officials may operate only assigned fixtures.
- Coaches may manage only assigned teams.
- Only authorized roles can confirm final results or approve reports, depending on competition configuration.
- Sensitive actions should require a reason and produce an audit record.

### 7.5 Acceptance criteria

- A coach cannot access or mutate another team's data by changing a URL or API payload.
- A match official cannot see unrelated organization administration pages.
- A user can be removed from a team without deleting their personal identity or historical actions.
- Audit logs identify the individual actor, not just a shared team credential.
- Existing team accounts remain functional during migration.

---

## 8. Player registration, eligibility and team management

**Priority: P1.**

### 8.1 Player profile additions

The current player import recognises player name, team, position, jersey number and captain status. Add configurable organization registration fields, starting with:

- Matriculation / student / membership number (field label configurable by organization).
- Registration status.
- Eligibility status and reason.
- Optional date of birth only when the organization has a clear need and suitable privacy controls.
- Emergency/medical information should not be added casually; it is sensitive and should require a documented purpose, strict access and retention controls.

Use a stable player identity across seasons so player history is retained even when the player changes team or competition.

### 8.2 Registration statuses

Recommended lifecycle:

`Not started → Submitted → Under review → Verified → Eligible`

Additional states: `Needs correction`, `Rejected`, `Inactive`.

Do not treat “profile exists” as proof that a player is eligible for a competition.

### 8.3 Import experience

Improve the existing CSV import modal:

1. Upload CSV or paste CSV content.
2. Match source columns to supported player fields.
3. Preview all parsed records.
4. Validate team mapping, positions, jersey numbers and required organization fields.
5. Detect duplicate names, duplicate identifiers and duplicate shirt numbers within the relevant team/season rules.
6. Let the operator choose whether to skip, update or resolve each duplicate.
7. Show exactly which records will be created or updated.
8. Import with a clear progress indicator.
9. Show imported, updated, skipped and failed counts.
10. Download rejected rows with row number and actionable error reason.
11. Store an import history record with actor, timestamp, source filename and outcome.

Use a server-side import job for large files. The existing 1,000-player import limit should remain an explicit, validated boundary until a tested bulk-import path is available.

### 8.4 Eligibility and discipline

Add a competition rules engine for:

- Maximum squad size.
- Matchday squad size.
- Player registration cut-off.
- Transfer windows.
- Suspension rules.
- Accumulated yellow-card thresholds.
- Red-card suspension handling.
- Forfeits and ineligible-player consequences.

Rules should be configured per competition and season. Build a preview/validation service so a coach sees why a player is unavailable before submitting a lineup.

### 8.5 Team workspace

Each team should have a central page with:

- Team profile and logo.
- Current roster and registration status.
- Assigned staff and active account status.
- Competition participation by season.
- Fixtures and results.
- Saved formations/lineups.
- Team statistics and discipline summary.
- Transfer history.

Use archive/deactivate semantics for teams with historical match data. Avoid destructive team deletion after matches have been played.

---

## 9. Competition, season and scheduling improvements

**Priority: P1.**

### 9.1 Season setup wizard

Build a guided wizard that can create a new season efficiently:

1. Name the season and set dates/timezone.
2. Select or create competitions.
3. Reuse teams from the previous season or register new teams.
4. Review participant eligibility and roster registration.
5. Configure competition rules.
6. Generate or manually create fixtures.
7. Preview schedule and resolve conflicts.
8. Publish the season/fixtures.

Offer “Clone previous season” for reusable setup data. Do not copy previous match events, results or statistics into the new edition. Make each copied item explicit and reviewable.

### 9.2 Competition configuration

Support configurable:

- Points for win/draw/loss.
- Tie-break order (e.g. points, goal difference, goals scored, head-to-head, disciplinary record, playoff/lottery where required).
- Match duration and extra-time/penalty rules where relevant.
- Roster and matchday squad limits.
- Fixture generation format.
- Home/away and venue rules.
- Lineup submission window.
- Result confirmation and dispute period.
- Reporting and media requirements.
- Knockout progression and third-place/final rules where applicable.

The exact rule set must be visible to participants. For standings, include “Why this position?” so the tie-break sequence is transparent.

### 9.3 Scheduling and calendar

Upgrade the current monthly calendar into:

- Month, week, day and list views.
- Filters for competition, team, venue and status.
- Drag-to-reschedule only for authorized users, with a confirmation step.
- Venue/time collision detection.
- Team double-booking detection.
- Weather/postponement notes and reschedule workflow.
- Calendar exports (`.ics`) per team and organization.
- Notifications when fixtures change.

A reschedule request from a coach should enter an approval queue rather than silently moving the fixture.

### 9.4 Acceptance criteria

- A new season can be configured without copying old results or mixing season data.
- Fixture generation presents a preview and reports byes, conflicts and incomplete schedule conditions.
- Users can identify the selected organization season and competition season at a glance.
- Tie-break logic is deterministic, tested and explained in the standings UI.
- Fixture changes update the public schedule and notify the affected parties through configured channels.

---

## 10. Organization settings and communication centre

**Priority: P1/P2.**

### 10.1 Organization settings

Create a dedicated organization settings area, separate from competition settings.

| Settings section | Scope |
|---|---|
| Organization profile | Name, logo, contact details, description and organization timezone |
| Branding | Brand colour, public page appearance and export identity |
| Staff and permissions | Invites, roles, team/competition assignments and account status |
| Venues | Venue names, locations, capacity/notes and availability |
| Registration | Required player fields, eligibility requirements and import rules |
| Notifications | Default channels, event preferences, templates and recipients |
| Public Match Centre | Visibility, public content and sharing preferences |
| Data management | Exports, archives, retention and privacy operations |

The repository already applies organization brand styling in its layout. Extend the existing organization branding mechanism rather than creating a second source of truth.

### 10.2 Announcements

Add organization announcements for:

- Fixture changes.
- Registration deadlines.
- Competition notices.
- Matchday instructions.
- Postponements/cancellations.
- General organization updates.

Allow recipients to be all members, selected teams, selected competitions or public followers where appropriate. Support scheduled publication and expiry.

### 10.3 Notification delivery architecture

The current notification dispatcher isolates push and in-app channels, but its idempotency guard is process-local and delivery runs after the response. That is not enough for critical, auditable communications across serverless instances.

Introduce a durable outbox/queue:

- Create outbox record in the same transaction as the source event where feasible.
- Use a unique idempotency key per source event and recipient/channel.
- Track `pending`, `processing`, `sent`, `retrying`, `failed`, `dead_letter`.
- Record attempts, provider response code, timestamps and safe error details.
- Retry transient errors with exponential backoff and jitter.
- Avoid retries for invalid recipients or permanent provider errors.
- Add a scheduled worker/cron processor and alerting for repeated failures.
- Provide a delivery log in the organization UI.

Channels can include in-app, browser push, WhatsApp and email. A channel must be independently enabled/configured; failure in one channel should not prevent other channels from sending.

### 10.4 Match notification deep links

Every match-related notification should open the exact match workspace or public match page appropriate to the recipient's role. Preserve the organization, competition and season context in the destination.

---

## 11. Reports, exports, audit history and analytics

**Priority: P2.**

### 11.1 Reports and exports

Add:

- End-of-season summary PDF.
- Competition report PDF.
- Team season report.
- Player season history export.
- Calendar (`.ics`) export for teams and organizations.
- CSV exports for rosters, fixtures, results, standings and statistics.
- Full organization data export for authorized administrators.

Every export should display the organization, competition, season, generated date and filter scope. Make sure wide tables export at a suitable desktop canvas width; do not let phone viewport width silently truncate standings or statistics.

### 11.2 Entity history drawers

Add a reusable History drawer to fixture, player, team and competition details:

- Who changed the record?
- What changed?
- When did it change?
- Why was it changed, where a reason is required?
- Link to the related audit event.

This should reuse the existing audit log model and must not expose private audit metadata to public viewers or unauthorized users.

### 11.3 Analytics

Provide filters by organization season, competition, team, player and date range. Start with well-defined statistics:

- Goals, assists and disciplinary statistics.
- Match participation and appearances.
- Team form and points trends.
- Clean sheets and goalkeeper statistics.
- Fixture completion and postponement rates.
- Registration/eligibility completion.

Use database queries or materialized/derived summaries for larger datasets. Do not load every organization's complete players and fixtures into the browser just to render a dashboard chart.

### 11.4 Public Match Centre preview

Provide an authorized “View as public” action to preview exactly what anonymous visitors see, including public visibility, branding, match details, media and published report state.

---

## 12. Design-system and frontend quality improvements

**Priority: P0 foundation, delivered incrementally alongside feature work.**

Claude's scan identified inconsistency between existing global `.btn*` classes, the shared `Button` component and raw buttons; native browser dialogs; mixed native/custom selects; small text; hardcoded colours/dimensions; and sparse use of dedicated error states. These are credible cleanup targets, but repeat the scan before making exact counts part of CI.

### 12.1 One shared component language

Standardize on the existing shared UI primitives where appropriate:

- Button: primary, secondary, ghost, danger; sizes; icon-only; loading/disabled states.
- Input, Select and Textarea: labels, hints, validation, disabled and loading states.
- Card and Panel: consistent headers, content and footers.
- Badge: semantic status variants.
- Modal and confirmation dialog: focus trap, escape handling, accessible title/description.
- Toast: success, warning and error with optional action for undo.
- EmptyState and ErrorState: separate empty data from failed requests.
- DataTable: loading/empty/error states, sorting, pagination and responsive behaviour.

**Migration rule:** replace raw elements gradually by page and component. Do not delete global `.btn*` CSS until all usages are migrated and visual regression checks pass. Do not wrap every HTML element in an abstraction without a reuse/accessibility benefit.

### 12.2 Confirmation and alert handling

Replace native `window.confirm()` and `window.alert()` with the existing app confirmation and toast/error patterns. Use a shared confirmation hook/component consistently. Every destructive operation should state what will be affected and whether it can be undone.

### 12.3 Typography and density

- Establish named type tokens: page title, section title, body, secondary body, caption and metadata.
- Aim for a 12px minimum for ordinary interface text. Exceptions may exist for decorative labels or dense data, but they must remain readable at 100% zoom on mobile.
- Use tabular numerals for scores, standings, shirt numbers and statistics.
- Reserve uppercase/tracking treatment for small labels rather than long sentences.
- Avoid compressing controls and explanatory copy to fit more into one card.

### 12.4 Colour and design tokens

- Move repeated semantic colours into tokens: brand, success/live, warning, danger, info, upcoming, completed, postponed and cancelled.
- Keep text/background contrast at WCAG AA target (4.5:1 normal text; 3:1 large text and relevant UI boundaries).
- Do not convey match status by colour alone; include text/icon labels.
- Replace arbitrary hardcoded colours with tokens where the value is part of the UI system. Keep one-off data visualization colours only where they are intentionally tied to a chart palette.
- Preserve organization-specific brand colours through the existing CSS-variable approach, with a contrast-safe foreground.

### 12.5 Radius, spacing and dimensions

Keep the current radius direction and make it explicit:

- Controls: `rounded-lg`.
- Cards/panels: `rounded-xl`.
- Pills/status tags: `rounded-full`.

Use a consistent spacing scale. Remove arbitrary dimensions only when they cause inconsistency; don't replace a deliberate chart or pitch dimension just to reduce a code count.

### 12.6 Responsive data tables

Extend the shared data table pattern:

- Sticky header where it helps.
- Sticky first column for wide tables where appropriate.
- Horizontal scrolling with visible affordance.
- Compact card/list presentation on small screens for standings, players and fixtures where it is more usable than a miniature table.
- Sorting, filters and pagination for long lists.
- Export width based on content, not the user's phone viewport.

### 12.7 Accessibility and touch

- Target 44×44 CSS pixel touch targets for primary mobile actions.
- Visible keyboard focus; inspect all `outline-none` uses to ensure a visible replacement.
- Semantic buttons/links instead of clickable `div` elements.
- Useful alt text for meaningful images; empty alt for decorative logos/icons that are already labelled.
- Correct labels and error descriptions on fields.
- Keyboard navigation for dialogs, tabs, tables and command palette.
- Respect reduced-motion settings.
- Test colour contrast in both light and dark themes.

### 12.8 Images and rendering

Use `next/image` for images where it is compatible with the source and optimization configuration. Use a plain `<img>` only where required by an external/variable source pattern or where framework optimization is intentionally disabled. Replace clickable non-semantic containers with buttons or links; do not perform a mechanical refactor without checking interaction semantics.

### 12.9 Error, loading and empty states

Every data screen should distinguish:

- Loading: skeleton or progress indicator.
- Empty: helpful explanation and one relevant action.
- Error: clear message, retry action and support-safe diagnostic ID where appropriate.
- Partial failure: keep independent sections usable.
- Offline/stale: explain whether data is cached and whether writes are pending.

`EmptyState` is not an error component. Use `ErrorState` for failed requests rather than displaying an empty list that could be mistaken for “no records”.

### 12.10 Component audit acceptance criteria

- Shared components own the common interaction and accessibility behaviour.
- Native browser dialogs are removed from application workflows.
- All high-traffic screens use consistent button, form, badge and error states.
- No important mobile action is difficult to tap.
- No text below the agreed type floor appears in ordinary operational screens without an explicit reason.
- Keyboard-only users can complete the core workflows.

---

## 13. Technical integration and data consistency

### 13.1 Source-of-truth rules

Each domain should have one authoritative source:

- Fixtures and match events: database records.
- Competition rules: competition/season configuration.
- Standings and statistics: deterministic server/database computation from confirmed match records and rules.
- User permissions: server-resolved membership/assignment plus matching RLS policies.
- Notification delivery: durable outbox/delivery records.
- Audit trail: append-only audit events.

Client state may cache and optimistically render data, but must not become the authority for results, permissions or competition outcomes.

### 13.2 Event-to-feature integration map

| Source event | Required downstream effects |
|---|---|
| Goal recorded | Match score, scorer/assist stats, timeline, standings after confirmation, public score and configured notifications |
| Card recorded | Match timeline, player discipline totals and suspension eligibility when competition rules apply |
| Match marked completed | Result review/confirmation workflow, final statistics, standings and post-match checklist |
| Result corrected | Recompute affected standings/statistics, retain audit history and send correction notice if the original result was public |
| Lineup submitted | Update preparation status, reviewer queue and coach/admin notification |
| Lineup approved/rejected | Update match readiness, notify coach and retain review note/history |
| Media published | Public Match Centre update, media link and configured announcement/push |
| Fixture rescheduled | Calendar, team dashboards, public schedule, reminders and affected-recipient notifications |
| Player transferred | Current roster, eligible squad, historical team relationship, lineup validation and transfer audit |
| Player registration verified | Eligibility state, team registration progress and competition squad validation |

### 13.3 Reliability rules

- Use database transactions/RPCs for multi-record operations that must succeed or fail together.
- Use idempotency keys for retried writes and side effects.
- Do not treat `after()` or a process-local map as durable delivery infrastructure.
- Retry only transient external failures, with bounded exponential backoff and jitter.
- Preserve the user's draft/input when an external service fails.
- Do not silently swallow failures on critical tasks; alert/record them.
- Use request/correlation IDs in logs and user-facing support messages without exposing secrets or private player information.
- Prefer archive/deactivate for records with historical dependencies.

### 13.4 Performance and scale

Avoid loading entire organizations' datasets into a root dashboard bootstrap as they grow. Query only the information required by the current page, filter by organization/season/competition at the server and paginate large lists.

Before declaring capacity targets, benchmark realistic workloads. Suggested scenarios:

- 100, 250 and 500 simultaneous public Match Centre readers.
- Peak concurrent matchday reads and live event writes.
- Realtime connection counts tested separately from ordinary HTTP page loads.
- 150+ notification subscribers receiving a burst of match updates.
- Large roster import and bulk fixture generation.

Track p50/p95/p99 latency, error rate, database query time, queue lag, notification delivery rate and client-side Core Web Vitals. Set service objectives only after measuring the production baseline.

---

## 14. Failure-mode and improvement tracking

Maintain a single tracker for implementation and operational risks. Suggested columns:

| Column | Purpose |
|---|---|
| ID | Stable issue identifier |
| Area | Auth, matchday, fixtures, player data, media, notifications, exports, UI, performance, etc. |
| Failure mode / improvement | What can fail or what should change |
| Trigger / cause | What causes the issue |
| User impact | What the user experiences |
| Severity | Critical / High / Medium / Low |
| Priority | P0 / P1 / P2 / P3 |
| Prevention | Design or technical safeguard |
| Detection | How the system knows it happened |
| Recovery | Retry, undo, correction or support path |
| Owner | Responsible role/person |
| Status | Not started / In progress / Blocked / In review / Done |
| Evidence / test | Reproduction, test case, metric or screenshot |

### Initial high-value failure modes

| Area | Failure mode | Prevention/detection | Recovery |
|---|---|---|---|
| Match events | Duplicate goal after retry | Idempotency key and database uniqueness/transaction | Detect duplicate; correct through audited event reversal |
| Match events | Goal removed but score/statistics remain | One transactional correction path and integration tests | Recompute affected match/player/standings data |
| Results | Wrong final score published | Separate entered and confirmed states | Correction flow, audit history and correction notification |
| Lineups | Suspended player selected | Server-side eligibility validation | Reject submission with clear reason; allow coach to replace player |
| Fixtures | Teams/venues double-booked | Conflict checks before save | Reschedule request and approval workflow |
| Player import | Partial import leaves confusing records | Import job, per-row status and idempotent batch key | Resume/retry failed rows; downloadable error file |
| Media | Upload succeeds but metadata save fails | Upload state reconciliation and orphan cleanup | Retry metadata save or clean orphaned storage object |
| Notifications | Delivery lost or repeated | Durable outbox and per-recipient/channel idempotency | Retry, dead-letter and delivery log |
| Permissions | Coach accesses another team's records | API authorization plus RLS plus role-matrix tests | Revoke access, alert and investigate audit history |
| Dashboard | Wrong season or stale counts displayed | URL-scoped season query and invalidation tests | Refetch selected scope and show current context |
| Exports | Wide standings table is clipped | Explicit export dimensions and screenshot/fixture-based tests | Regenerate from full dataset at correct width |
| Network | Save appears successful while server failed | Wait for server confirmation; pending/failed UI | Retry with idempotency key; preserve draft |

---

## 15. Implementation roadmap

Build in small, reviewable releases. Each phase should ship only after its acceptance criteria pass. P0/P1 priorities can overlap where dependencies permit, but do not start a large UI migration and a schema-heavy feature simultaneously without tests and rollback plans.

### Phase 0 — Baseline, scope and safety net

**Goal:** make the current state measurable before changing it.

Tasks:

- Re-run the design-system scan on current `main` and save the output.
- Capture screenshots of organization dashboard, competition navigation, fixtures, fixture detail, player list/profile, team list, import modal, lineup submission and mobile layouts.
- Document the exact existing routes and redirects.
- Map existing permissions to routes and database tables.
- Record baseline performance and error rates.
- Confirm existing migrations are applied in the target environment.
- Add/extend authorization and core workflow tests before changing UI flows.

Deliverables:

- Baseline screenshot set (desktop + mobile).
- Updated route/role matrix.
- Design-system scan report.
- Initial failure-mode tracker.
- Test and performance baseline.

### Phase 1 — Frontend foundation and navigation

**Goal:** consistent components and a clearer information architecture.

Tasks:

- Define typography, spacing, status, colour and radius tokens.
- Establish shared Button/Input/Select/Badge/Card/Modal/Confirm/Toast/EmptyState/ErrorState patterns.
- Migrate high-traffic pages incrementally; do not remove old CSS until migration is complete.
- Replace native `alert`/`confirm` calls with shared app patterns.
- Set the ordinary UI type floor and mobile touch-target target.
- Group competition navigation into five sections while keeping old deep links working.
- Add the new Organization/People/Matchday information architecture without hiding existing capabilities.
- Add command-palette search shortcut.

Acceptance:

- No key route is lost or inaccessible.
- Existing deep links continue to work.
- Core controls have consistent loading/error/focus behaviour.
- Main navigation is understandable on phone and desktop.
- No visible regression against the captured baseline screenshots.

### Phase 2 — Organization Operations Centre

**Goal:** turn the dashboard into a reliable daily work queue.

Tasks:

- Implement task/exception derivation for fixture readiness, lineups, result confirmation, report review, media moderation, registration and delivery failures.
- Add the Needs Attention panel with direct actions.
- Improve today's/next matches and competition progress.
- Link recent activity to records.
- Add role-aware quick actions.
- Add independent loading/error boundaries to dashboard sections.

Acceptance:

- The dashboard surfaces real, actionable tasks.
- Every task resolves to the record/action that fixes it.
- No fabricated or unsupported task types appear.
- Season, competition and timezone scope are correct.

### Phase 3 — Matchday Hub and Match Workspace

**Goal:** make a fixture the central operational workspace.

Tasks:

- Add organization-wide Matchday Hub.
- Add filters and Today/Live/Needs action/Upcoming/Recently completed views.
- Build canonical Match Workspace with Overview, Live Events, Lineups, Media and Report sections.
- Move/reuse current fixture-card actions inside the workspace.
- Integrate match checklist and separate match/operational states.
- Add result confirmation and correction workflow.
- Connect event, score, statistics, standings and public Match Centre updates.
- Reuse the existing lineup and media implementation.

Acceptance:

- A match can be operated end-to-end from the workspace.
- Existing fixture-card entry points navigate to the same match workspace.
- No duplicate media or event systems are created.
- Event correction and final result flows are consistent and auditable.

### Phase 4 — Staff roles and team self-service

**Goal:** enable multiple accountable people to run an organization.

Tasks:

- Build Members/Staff management UI on the existing member API.
- Extend roles/capabilities for competition manager and match official.
- Add team/competition/fixture assignments.
- Add invitation acceptance, revoke, suspend/reactivate and account lifecycle.
- Add match official assignment to fixtures.
- Add coach lineup and reschedule-request workflows.
- Introduce individual staff accounts alongside existing team accounts.

Acceptance:

- Permission matrix tests pass for cross-organization and cross-team cases.
- Each member's capabilities are enforced in route handlers and RLS.
- Old team-account users continue to work during migration.
- A staff action is attributable to an individual.

### Phase 5 — Player registration, eligibility and season setup

**Goal:** make registration and new-season setup efficient and auditable.

Tasks:

- Add configurable player registration identifiers such as matric/student/membership number.
- Add registration status and eligibility states.
- Improve CSV mapping, preview, duplicate resolution, import history and rejected-row download.
- Add discipline/suspension and matchday eligibility rules.
- Build season setup wizard with clone-from-previous-season support.
- Add fixture/venue/team conflict detection and `.ics` exports.

Acceptance:

- Player identifiers survive import, edit, export and season transitions.
- Eligibility is checked server-side at lineup submission.
- Import errors are actionable and no silent partial failures occur.
- Season cloning never copies old match results/events into the new season.

### Phase 6 — Communication, reports and analytics

**Goal:** close the loop between operations, participants and public audiences.

Tasks:

- Introduce durable notification outbox and channel delivery tracking.
- Add announcements and audience targeting.
- Add notification deep links to exact match/team/competition destinations.
- Add reviewed AI-assisted reports and report revision history.
- Add season summary and team/player exports.
- Add entity history drawers.
- Add public Match Centre preview.
- Expand organization and competition analytics after query performance is measured.

Acceptance:

- Notification attempts are traceable, retried safely and do not duplicate across server instances.
- Reports are not auto-published without human review.
- Exports show correct scope and do not clip wide data.
- Public preview matches anonymous visibility rules.

### Phase 7 — Scale, resilience and operational polish

**Goal:** prove the product behaves reliably under realistic load and partial failures.

Tasks:

- Run k6 or equivalent load scenarios for public reads, matchday operations and imports.
- Optimize slow queries and large dashboard payloads.
- Add queue-lag and notification-delivery monitoring.
- Test Redis/provider/database outages and degraded modes.
- Verify offline/stale UI behaviours where relevant.
- Perform accessibility checks with keyboard and screen reader.
- Test on small Android and iOS viewport sizes, including pitch-side conditions.

Acceptance:

- Measured latency/error goals are documented.
- Failure scenarios have an explicit recovery path.
- Critical write flows remain consistent under retries/concurrent requests.
- No cross-organization data leakage is observed in test scenarios.

---

## 16. Suggested repository work map

These are likely starting points based on the inspected branch. Confirm exact route/file locations before implementation; some workflows may be implemented under competition-scoped routes rather than organization-level routes.

| Workstream | Existing starting points | Likely additions/changes |
|---|---|---|
| Organization dashboard | `app/org/[slug]/dashboard/page.tsx`, `components/dashboard/*`, `components/dashboard/setup-checklist.tsx` | Operations Centre task components, task aggregation API/service |
| Organization shell/navigation | `app/org/[slug]/layout.tsx`, `components/layout/org-context-bar.tsx`, `components/layout/sidebar.tsx` | Matchday and People navigation, route grouping |
| Competition navigation | `app/org/[slug]/competitions/[cId]/layout.tsx` | Five-group navigation and compatibility mapping |
| Matchday hub | `components/fixtures/fixture-card.tsx`, competition fixture pages, organization fixture APIs | `app/org/[slug]/matchday/*`, task/status query API |
| Match workspace | `components/fixtures/add-event-modal.tsx`, `fixture-lineups.tsx`, `match-media-manager.tsx`, fixture/report APIs | Canonical match workspace page, checklist and state aggregation |
| Player import | `components/players/player-import-modal.tsx`, `lib/utils/csv.ts`, `lib/types.ts`, player import API | Player registration fields, import job/history and error export |
| Staff management | `app/api/org/members/route.ts`, `app/org/[slug]/team-accounts/page.tsx`, `app/api/org/team-accounts/*` | Members UI, scoped assignments, role/capability tables and lifecycle |
| Competition rules | Competition settings page and competition/season APIs | Rule schema, validation service and standings tie-break tests |
| Calendar | `components/calendar/calendar-view.tsx` | Week/day/list views, conflict checking, `.ics` generation |
| Notifications | `lib/notifications/dispatch.ts`, `lib/public-push.ts`, notification APIs | Outbox table, worker/cron, delivery status UI |
| Audit history | `components/dashboard/recent-activity.tsx`, audit APIs | Reusable entity history drawer |
| Design system | `components/ui/*`, `components/shared/*`, global styles and Tailwind config | Token cleanup, control migration, accessibility tests |

### Database/migration areas to assess

Do not write migrations from this table without checking the actual schema first. The likely schema additions are:

- Player registration identifier fields and registration/eligibility state.
- Staff scope assignments and additional permission capabilities.
- Match official assignment.
- Competition rule configuration.
- Explicit result confirmation/dispute metadata.
- Notification outbox and delivery attempts.
- Import job and per-row results.
- Persisted organization tasks only if derived tasks are insufficient.
- Organization timezone and venue records if not already represented.

All migrations should be additive, dated and reversible where practical. Preserve existing foreign keys and historical relationships. Avoid editing an already-applied migration.

---

## 17. QA, testing and release controls

### 17.1 Required test layers

**Unit tests**

- Competition points/tie-break logic.
- Match lifecycle and task derivation.
- Eligibility and suspension calculations.
- CSV mapping and duplicate resolution.
- Notification idempotency/backoff decisions.

**API and authorization tests**

- Anonymous, player, coach, competition manager, match official, organization admin and super admin.
- Own organization/team/competition/fixture versus another organization's/team's/competition's/fixture's record.
- Service-role-backed route scope checks.
- Result confirmation and event correction permissions.

**Integration tests**

- Goal creates one event and one score update.
- Correcting/deleting an event updates all derived values.
- Completing a fixture produces correct standings/statistics.
- Lineup submit/approve/reject updates the right tasks and notifications.
- Published media becomes visible publicly.
- Outbox retries do not duplicate notifications.
- Player import handles partial row failures safely.

**End-to-end tests**

- Organization creates a competition and season.
- Organization registers teams and imports players.
- Coach submits a lineup.
- Administrator reviews it.
- Official records events.
- Administrator confirms result.
- Report and media are published.
- Public viewer sees the correct match and result.

**Visual/accessibility tests**

- Desktop and mobile screenshots for high-traffic pages.
- Keyboard navigation and focus state.
- Colour contrast in light/dark themes.
- 44px touch target checks on primary mobile actions.
- Table scrolling and export image dimensions.

### 17.2 Release strategy

- Build features behind organization-level flags when introducing new workflows.
- Pilot with one test organization and a small number of real users.
- Keep compatibility routes while navigation is changing.
- Use additive schema migrations and verify them in staging before production.
- Take a database backup before data-model changes or bulk backfills.
- Release one workflow at a time; do not launch Matchday, permissions migration and registration overhaul in one unreviewable release.
- Provide a rollback plan for each release.

### 17.3 Product success metrics

Measure improvements using actual usage rather than subjective impressions:

| Metric | What it tells us |
|---|---|
| Time to create and publish a competition season | Whether setup wizard reduces administrative effort |
| Time from kickoff to confirmed result | Whether matchday operations are more efficient |
| Percentage of lineups submitted before deadline | Whether coach self-service is working |
| Percentage of fixtures with complete date/time/venue | Scheduling quality |
| Player import failure rate and correction time | Registration quality |
| Percentage of match reports/media published within target window | Post-match workflow health |
| Notification delivery success and queue lag | Communication reliability |
| Support requests per organization/season | Overall usability and clarity |
| p95 page/API latency and API error rate | System performance and resilience |

Set numeric targets after establishing a baseline from real usage.

---

## 18. Definition of Done

A workstream is not complete merely because its UI renders.

Every release must satisfy the relevant points below:

- The workflow is accessible to the intended role and inaccessible to unauthorized roles.
- API authorization and database RLS agree.
- Organization, competition and season context is correct.
- All required loading, empty, error, success and disabled states exist.
- Mobile and desktop layouts have been tested.
- Keyboard focus and screen-reader labels are present for key interactions.
- Important writes are idempotent or otherwise protected against duplicate submission.
- Failed requests do not show false success or erase user input.
- Audit history records sensitive changes.
- Notifications and exports use the correct scope and source data.
- Unit/integration/E2E tests cover the new workflow's critical path.
- Documentation and tracker status are updated.

---

## 19. Recommended execution order for the next sprint

To keep the next release focused, start with this sequence:

1. **Baseline the current screens and rerun Claude's design-system scan.** Confirm the counts and capture mobile/desktop screenshots.
2. **Approve the five-group competition navigation and organization navigation.** This is the information architecture decision on which later screens depend.
3. **Define the Matchday data contract and task/status model.** Keep match status separate from operational completion.
4. **Build the first version of the Organization Operations Centre's Needs Attention queue.** Start with missing fixture details, lineup review, result confirmation and pending media/report work that already exists in the data model.
5. **Build the Matchday Hub and Match Workspace using existing event, lineup and media components.** Reuse rather than fork existing features.
6. **Complete the staff permission and assignment design.** Start with organization member UI and scoped coach/official actions; preserve existing team-account compatibility.
7. **Then move to registration/eligibility and the season setup wizard.**

This sequence provides visible value early while avoiding a large redesign or an uncontrolled database refactor.

---

## 20. Implementation instruction for a coding agent

Use this guide as the product source of truth, but implement only one phase or one independently testable slice at a time.

Before changing code:

1. Inspect the current branch and the exact files involved.
2. Identify the existing component/API/schema that should be reused.
3. State the user journey and acceptance criteria for the requested slice.
4. List the database migrations, route changes, permission changes and UI changes required.
5. Identify regressions and add/update tests before or alongside the implementation.

During implementation:

- Do not create duplicate feature systems when an existing component can be extended.
- Do not weaken RLS or bypass an authorization helper for convenience.
- Do not introduce new dependencies without explaining the need.
- Do not silently change current business rules.
- Do not remove old routes until compatibility is verified.
- Do not use mock data in production screens or present illustrative metrics as real data.

Before marking a task done:

- Run typecheck, lint, tests and production build.
- Run the relevant local Supabase/RLS tests.
- Test the main workflow using each affected role.
- Verify desktop and mobile states.
- Update the failure/improvement tracker with evidence and status.

**Recommended first implementation slice:** competition navigation consolidation plus the first Needs Attention queue, after the Phase 0 baseline is complete. Then build Matchday Hub around the existing fixture, event, lineup and media systems.

---

## Appendix A — Decisions to confirm during implementation

These are product decisions, not blockers to beginning Phase 0:

- Whether Matchday is organization-wide only or also exposed inside each competition as a filtered view. Recommendation: one reusable Matchday page with organization and competition filters.
- Whether result confirmation requires one or two authorized approvers. Recommendation: configurable by competition, with one approver as the default.
- Whether match reports are required for every fixture or selected fixture types. Recommendation: competition-level setting.
- Whether a match official may confirm a final score or only submit it for administrator confirmation. Recommendation: make this configurable and auditable.
- Which player registration identifiers are required by each organization. Recommendation: configurable field labels, with matric/student number as a common default for university organizations.
- Whether the app should keep a shared team-account login during a transition. Recommendation: yes, until named staff accounts are fully adopted.
- Which notification channels are enabled per organization. Recommendation: in-app by default, with push/email/WhatsApp opt-in and independent delivery status.

## Appendix B — Non-goals for the first release

- Replacing the entire design system in one pass.
- Rebuilding the application in a new framework or changing the database provider without evidence.
- Implementing billing before the operational workflows are stable.
- Building every proposed staff role before the first permission model is tested.
- Publishing AI-generated reports without human review.
- Hard-deleting historical teams, players, competitions or match records.
- Claiming scale or reliability targets without load-test evidence.

---

**End of guide.**
