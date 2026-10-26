# VFL implementation baseline — 26 October 2026

This is the source-level baseline before the first implementation slice from
`VFL_IMPLEMENTATION_GUIDE.md`. Counts are an `rg` scan of the current checkout;
they are occurrence counts, not unique component counts.

## Design-system scan

| Signal | Count |
|---|---:|
| JSX button tags | 203 |
| Native select tags | 30 |
| `window.alert` / `window.confirm` calls | 1 |
| `text-xs`, `text-[10px]`, `text-[11px]` occurrences | 513 |
| `<img>` and Next `<Image>` tags | 55 |
| App `page.tsx` routes | 36 |
| Organization `page.tsx` routes | 23 |
| Competition `page.tsx` routes | 10 |

## Existing route and role baseline

The organization shell is `app/org/[slug]/layout.tsx`. It currently exposes
Dashboard, Competitions, Players, Teams, Team Accounts and Public Match Centre
to organization administrators; team accounts see Dashboard, Players and
Public Match Centre; player accounts see Dashboard and Public Match Centre.
The competition workspace is `app/org/[slug]/competitions/[cId]/layout.tsx`
and currently exposes Overview, Standings, Statistics, Team of the Round,
Schedule, Teams, Players, Final Match Results and Settings. Existing routes
will remain addressable while the navigation is grouped.

## Scope and verification limits

- Source-level route and role mapping was reviewed in the files above.
- No live Supabase connection is configured in this workspace, so applied
  production migrations and production error/performance rates could not be
  inspected here.
- No authenticated browser session was available for representative desktop
  and mobile screenshots. Those visual baselines remain a manual release check.
- The scan is reproducible with `rg` in this repository and can be compared
  with a later run; counts may change as components are consolidated.

## Initial failure/improvement tracker

| ID | Area | Failure mode / improvement | Prevention / detection | Recovery | Priority | Status |
|---|---|---|---|---|---|---|
| NAV-01 | Competition navigation | Nine peer links make common tasks harder to scan | Group links while preserving their existing destinations | Use existing route URLs and browser history | P1 | Done — five groups, existing route URLs retained |
| OPS-01 | Dashboard | Setup and operational exceptions are spread across existing cards | Derive actionable tasks from selected-season records and expose direct links | Refresh the selected-season task list | P0 | In review — missing fixture details, pending lineup review and pending media review are derived |
| OPS-02 | Dashboard | Failures in optional dashboard panels can obscure operational work | Load the attention queue independently with its own error/retry state | Retry only the queue request | P0 | Done — queue has separate loading, error, retry and empty states |

## First implementation slice

Competition links are grouped as Overview, Matches, Table & Stats,
Participants, and Settings. Schedule, results, standings, statistics, Team of
the Round, teams, players and settings continue to use their original paths.

The dashboard attention queue is scoped to the selected organization season
and currently derives only actionable records that already have persisted
states: scheduled fixtures missing date/time/venue, lineups awaiting review,
and match media awaiting approval. Result confirmation, reports, registration
eligibility and notification-delivery tasks are not shown because the current
data model does not provide the required states reliably.
