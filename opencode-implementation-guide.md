# 🤖 OpenCode Implementation Guide — VFL Project

This guide sets up **OpenCode** (the open-source terminal/IDE coding agent, opencode.ai) for this repository and hands it a concrete, prioritized backlog — synthesizing the security review and the org-admin CRUD gap analysis from this conversation into tasks OpenCode can plan and execute directly.

It has three parts:
1. **Setup** — install, connect, and give OpenCode durable project context (`AGENTS.md` + `opencode.json`)
2. **An optional review subagent** — codifies the audit methodology used earlier so it's repeatable
3. **The backlog** — every task from the security review and CRUD analysis, written as small, agent-executable units with acceptance criteria

---

# 1. Setup

## Step 1: Install and connect

```bash
curl -fsSL https://opencode.ai/install | bash
cd vfl
opencode /connect   # authenticate your model provider
```

## Step 2: Don't rely on auto-generated context — write `AGENTS.md` by hand

`opencode /init` will scan the repo and draft an `AGENTS.md` automatically, but a generic scan won't know about the RLS-vs-API dual-enforcement rule, the two eras of this codebase (single-league → multi-tenant), or which docs are load-bearing. Use this instead — save as `AGENTS.md` at the repo root:

```markdown
# AGENTS.md — VFL (Football League Management App)

## What this is
A Next.js 14 (App Router) app for running football leagues, now multi-tenant
("organizations" layer bolted on top of an original single-league design).
Stack: Zustand (client state), Supabase (Postgres + Auth + Storage), Tailwind.

## Directory map
- `app/api/*`            — ~44 route handlers, one per resource/action
- `app/org/[slug]/*`     — org admin / team / player workspace (multi-tenant)
- `app/admin/*`          — legacy super-admin console (single-tenant era)
- `lib/logic/*`          — pure business logic, no framework/DB code
  (round-robin.ts, standings.ts, validation.ts, repair.ts, ratings.ts, cup.ts)
- `lib/store/*`          — Zustand slices (auth, teams, players, fixtures, org, competition, cup)
- `lib/security.ts`      — auth/permission primitives — READ THIS FIRST before touching any route
- `lib/supabase/*`       — 4 client factories: client (browser), server (cookie-bound),
  service-role (privileged, bypasses RLS), public (anon, for public endpoints)
- `supabase/migration.sql` + `supabase/migrations/*.sql` — schema + RLS policies, applied in order

## Commands
```bash
npm run dev      # local dev server
npm run build    # production build — run before considering any task done
npm run lint      # next lint
```
There is currently **no automated test suite**. Until one exists, "done" means:
lint passes, build succeeds, and the manual verification steps listed in the task are followed.

## Critical conventions — do not deviate from these

1. **Every permission check has two layers: API route AND Row Level Security policy.**
   Use `lib/security.ts`'s `requireAdmin` / `requireOrgAdmin` / `requireOrgMember` / `ownsTeam`
   in the route handler, AND make sure the corresponding RLS policy on the table matches the
   same boundary. If you add or change one without the other, you've reintroduced the exact
   bug this backlog exists to fix — an app-layer check that a raw Supabase REST call bypasses.
   Never assume `USING (true)` / unconditional policies are fine "because the app checks it."

2. **RLS policies are OR'd, not overridden.** Adding a stricter policy does NOT replace a
   looser one on the same table+command. If you're narrowing access, you must explicitly
   `DROP POLICY` the old one in the same migration.

3. **Migrations are additive and dated**, named `YYYYMMDD_description.sql` in
   `supabase/migrations/`. Never edit a past migration — write a new one, even for a
   one-line policy fix.

4. **Never build HTML strings by hand.** No `dangerouslySetInnerHTML` fed by anything that
   originated from user input (CSV cells, form fields, API responses). Render with normal
   JSX/`{}` interpolation, which React escapes automatically.

5. **Prefer soft-delete/archive over hard-delete** for any resource that can carry historical
   data once matches have been played (teams, competitions, fixtures with recorded results).
   Hard-delete is fine only for records with no dependent history.

6. **Match the existing shape of a route handler** before adding a new one — auth resolution
   via `getAuthContext(supabase)`, a permission guard, `parseJsonObject`/`asString`/`asInteger`
   for input, `rateLimit()` for state-changing endpoints, `json()` for responses,
   `logApiError`/`logSecurityEvent` for observability. Copy an existing route in the same
   folder as your starting point rather than writing one from scratch.

## Reference docs (load these before planning security or permissions work)
- `docs/security-review-2026-07-22.md` — full findings, evidence, and fixes for 6 issues
- `docs/org-admin-crud-plan.md` — current-state vs. target CRUD matrix for the Organization
  Admin role
- `docs/PROJECT-DOCUMENTATION.md` — original project documentation

## Things to avoid
- Don't add a new permission check that only exists in one layer (see convention #1).
- Don't touch `/admin` (legacy single-tenant console) as part of multi-tenancy fixes unless
  a task explicitly says to — it's intentionally a separate, older code path.
- Don't introduce a new HTTP client pattern — always go through the four factories in
  `lib/supabase/`.
```

## Step 3: Add `opencode.json` so the reference docs load automatically

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "docs/security-review-2026-07-22.md",
    "docs/org-admin-crud-plan.md",
    "docs/PROJECT-DOCUMENTATION.md"
  ]
}
```

Copy the security review generated earlier into the repo at `docs/security-review-2026-07-22.md`, and save the CRUD matrix from the "Part 1 / Part 2" analysis as `docs/org-admin-crud-plan.md` (both referenced above) so OpenCode pulls them into context automatically on every session, instead of you having to paste them in each time.

```bash
git add AGENTS.md opencode.json docs/security-review-2026-07-22.md docs/org-admin-crud-plan.md
git commit -m "Add OpenCode project context and security/CRUD reference docs"
```

---

# 2. Optional: a review subagent that mirrors the audit methodology

OpenCode supports custom subagents with restricted permissions — useful for re-running the same kind of review that produced the security report, on-demand, without risk of it editing anything. Save as `.opencode/agents/security-reviewer.md`:

```markdown
---
description: Audits auth guards, RLS policies, and unsafe rendering — read-only, never edits code
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
    exceptions: ["grep", "cat", "find", "git log", "git diff"]
---

You are auditing this repo for the same class of issues catalogued in
docs/security-review-2026-07-22.md. For every route in app/api/*, check:
1. Does it call an auth guard from lib/security.ts appropriate to what it does?
2. If it reads/writes org-scoped data, does the corresponding RLS policy match the same
   boundary — and could an older, looser policy on the same table still be active?
3. Does it interpolate any request-derived string into HTML, SQL, or a shell command?
4. Does it rate-limit state-changing calls?

Report findings the same way the existing report does: severity-ranked, with file/line
evidence and a concrete fix. Never edit files — this agent is read-only by design.
```

Invoke it with `@security-reviewer` inside a session whenever you want a fresh pass — e.g. after finishing Epic A below, to confirm nothing was missed.

---

# 3. The Backlog

Work through these in **Plan mode first** (`Tab` to Plan, describe the task, let OpenCode draft an approach and confirm it matches the acceptance criteria below) — **then switch to Build mode** (`Tab`) to implement. Each task is scoped to be a single small PR, per the task-sizing convention in `AGENTS.md`.

## Epic A — Critical Security Fixes
*(Source: `docs/security-review-2026-07-22.md`. Do these in order — #1 first, always.)*

### A1. Drop the public RLS policies leaking cross-org data 🔴
- **Files:** new migration `supabase/migrations/20260723_close_public_rls.sql`
- **Do:** `DROP POLICY "teams_read_public" ON teams;` and `DROP POLICY "fixtures_read_public" ON fixtures;`. Add a new `fixtures_read_org_members` policy mirroring the existing `teams_read_org_members` shape (org-membership join, plus an admin_users bypass).
- **Acceptance criteria:**
  - [ ] Querying `teams`/`fixtures` with the anon key and no session returns nothing (or a 401/empty set, not data).
  - [ ] A logged-in org member can still read their own org's teams and fixtures.
  - [ ] `/api/public/live` still works — it uses the service-role client, so it's unaffected by these policy changes; verify this explicitly since it's the thing most likely to look "broken" if someone assumes it depended on the public policy.

### A2. Scope `/api/player/data` to the player's own organization 🟠
- **Files:** `app/api/player/data/route.ts`
- **Do:** resolve the player's `organization_id` via their team before querying `allFixtures`/`allPlayers`; filter both by teams belonging to that org.
- **Acceptance criteria:**
  - [ ] A player in Org A no longer receives players/fixtures/standings from Org B in the response.
  - [ ] The player's own stats and their team's fixtures are unaffected.

### A3. Remove `dangerouslySetInnerHTML` from CSV import feedback 🟠
- **Files:** `components/players/csv-import.tsx`
- **Do:** replace the single `<div dangerouslySetInnerHTML>` with normal JSX — a `<p>` for the summary line and a `<ul>`/`<li>` map over `result.errors`.
- **Acceptance criteria:**
  - [ ] Importing a CSV with a player name like `<img src=x onerror=alert(1)>` shows the literal text in the error list, not an executed script.
  - [ ] Existing success/error styling is preserved.

### A4. Add the missing org-ownership check to fixture generation 🟠
- **Files:** `app/api/competitions/[id]/generate-fixtures/route.ts`
- **Do:** fetch the competition's `organization_id`, call `requireOrgAdmin(auth, organization_id)` before generating, matching the pattern already used in `app/api/competitions/route.ts`.
- **Acceptance criteria:**
  - [ ] A team account or player from any org gets 403 when calling this endpoint.
  - [ ] An org admin for the competition's own org can still generate fixtures normally.

### A5. Apply `rateLimit()` to remaining write endpoints 🟡
- **Files:** `app/api/admin/teams/route.ts`, `admin/players/route.ts`, `admin/orgs/*`, `teams/route.ts`, `players/route.ts`, `competitions/route.ts`, `competitions/[id]/route.ts`, `fixtures/[id]/route.ts`
- **Do:** copy the `rateLimit({ key: \`<route>:${ip}:${auth.userId}\`, limit, windowMs })` pattern already used in `app/api/upload/logo/route.ts` into each mutation handler. Reasonable default: `limit: 60, windowMs: 60 * 60_000` unless the resource warrants tighter (e.g. account-creation endpoints stay at their existing lower limits).
- **Acceptance criteria:**
  - [ ] Every POST/PUT/DELETE handler in the listed files calls `rateLimit()` before performing its write.
  - [ ] Exceeding the limit returns the existing `rateLimitResponse()` shape, consistent with other endpoints.

### A6. Close the admin-bootstrap race condition ⚪
- **Files:** `app/api/auth/admin-signup/route.ts`, new migration for a guard constraint
- **Do:** either wrap the count-check + insert in a Postgres advisory lock (`pg_advisory_xact_lock`), or add a partial unique constraint that makes a second admin row physically impossible to insert concurrently, then handle the resulting DB error gracefully in the route.
- **Acceptance criteria:**
  - [ ] Firing two concurrent `admin-signup` requests against a fresh database results in exactly one admin being created; the second gets the existing "Admin already exists" error.

---

## Epic B — Organization Admin CRUD Completeness
*(Source: the CRUD matrix comparison — current-state vs. target. Do after Epic A, since several of these touch the same permission primitives.)*

### B1. Let org admins edit their own organization profile
- **Files:** new `PUT` handler in `app/api/org/[slug]/route.ts`, RLS: allow org-admin-role update on `organizations` (currently `orgs_update_admin_only` is Super-Admin-only — add an org-admin-scoped policy alongside it, or extend that policy) 
- **Do:** allow updating `name`, `logo_url`, and non-structural settings; explicitly disallow `slug` changes here (or handle separately with collision-checking, matching `register`'s slugify logic) and never allow self-deletion through this route.
- **Acceptance criteria:**
  - [ ] An org admin (owner/admin role) can update their org's name/logo via the API.
  - [ ] A member with a non-admin org role (if ever introduced) cannot.
  - [ ] There is still no DELETE path for organizations reachable by anyone but Super Admin.

### B2. Organization membership management (invite/remove co-admins)
- **Files:** new `app/api/org/members/route.ts` POST/DELETE (GET already exists), RLS already supports this shape (see `org_members_insert_admin_or_owner` etc. in `20260605_organizations.sql`) — wire the API to it
- **Do:** implement invite (create membership by email, `owner` role only) and remove (delete membership, `owner` role only, cannot remove yourself if you're the last owner). Add the `owner`/`admin` distinction check using the existing `OrgRole` type rather than treating all org-admin members as equal.
- **Acceptance criteria:**
  - [ ] An `owner` can invite a new admin and remove an existing one.
  - [ ] A plain `admin` (non-owner) gets 403 on invite/remove.
  - [ ] Removing the last remaining `owner` of an org is blocked with a clear error.

### B3. Team account lifecycle — reset password / deactivate
- **Files:** new `app/api/org/team-accounts/[id]/route.ts` with `PATCH` (reset password) and `DELETE` (deactivate)
- **Do:** `PATCH` generates and sets a new password following the same `validatePassword` rules as creation, returns it once. `DELETE` disables login (e.g. flip a status flag, or delete the Supabase Auth user — pick whichever matches how `admin_users`/`player` deactivation is expected to behave elsewhere in the app, since there's no existing precedent to copy for a "soft disable").
- **Acceptance criteria:**
  - [ ] Org admin can reset a coach's password; old password no longer works, new one does.
  - [ ] Org admin can deactivate a team account; that account can no longer log in.
  - [ ] Both actions are scoped to teams within the caller's own org (reuse `requireOrgAdmin`).

### B4. Org-scoped audit log read access
- **Files:** `app/api/admin/audit-logs/route.ts` (or a new `app/api/org/audit-logs/route.ts`), RLS: extend `auth_audit_logs_admin_read` (or add a parallel policy) to also allow org admins to see events tagged with their `organization_id`
- **Do:** this requires audit log rows to actually carry an `organization_id` where applicable — check whether `logSecurityEvent`/`auth_audit_logs` currently records one; if not, that's a prerequisite sub-task (add the column, populate it going forward — historical rows won't have it, that's fine).
- **Acceptance criteria:**
  - [ ] An org admin can fetch a list of security events scoped to their own org (account created, credential regenerated, etc.).
  - [ ] They cannot see events from other organizations or platform-level (Super Admin) events.

### B5. Competition archive (soft-delete)
- **Files:** `app/api/competitions/[id]/route.ts`
- **Do:** add a way to move a competition to an `archived` status (extending the existing `draft/active/completed` lifecycle) rather than a hard DELETE, since competitions may have fixtures with recorded results.
- **Acceptance criteria:**
  - [ ] Org admin can archive a competition; it no longer appears in the default competitions list but is still fetchable by ID.
  - [ ] A competition with zero fixtures can also just be archived the same way (no special-casing needed for "safe to hard-delete").

### B6. Org admin notifications visibility
- **Files:** `app/api/notifications/route.ts`
- **Do:** the current `GET`/`PATCH` only branch on `auth.isAdmin` (Super Admin) or a `teamAccount`. Add a branch for org-admin sessions that returns notifications for all teams within their org (join through `teams.organization_id`).
- **Acceptance criteria:**
  - [ ] An org admin session now receives a non-empty notifications list scoped to their org, instead of the current empty result.
  - [ ] Team accounts and Super Admin behavior is unchanged.

---

## Epic C — Match Flyer Generator
*(Already has its own complete implementation guide from earlier in this project — treat it as a single epic here rather than re-deriving tasks.)*

### C1. Implement the flyer generator feature
- **Reference:** `docs/match-flyer-generator-implementation-guide.md` (copy this into the repo alongside the other reference docs if you want OpenCode to load it automatically the same way)
- **Do:** follow that guide's phases in order — migration, theme module, template, API route, client hook + modal, fixture-card button.
- **Acceptance criteria:** as listed in that guide's Phase 7 testing checklist.

---

# 4. Suggested execution order

```
A1 → A2 → A3 → A4 → A5 → A6        (security — do first, in this order)
   ↓
B2 → B1 → B3 → B4 → B5 → B6        (CRUD completeness — B2/B1 unblock the rest conceptually,
                                     but each is independently shippable)
   ↓
C1                                  (feature work — independent of A/B, can be parallelized
                                     by a second session if needed)
```

After Epic A is complete, run the `@security-reviewer` subagent from Part 2 once as a regression check before moving on — it costs nothing but a session and confirms the fixes actually closed what they were meant to.
