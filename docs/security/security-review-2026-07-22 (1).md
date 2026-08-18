# Security Review — VFL (Football League Management App)

**Original review:** 2026-07-22 · **Updated:** 2026-07-28 (re-pulled and re-reviewed at commit `4da7135`, following the OpenCode backlog work)
**Scope:** Full sweep of `app/api/*` route handlers, all RLS migrations, `middleware.ts`, client components rendering unescaped content — plus, in this pass, the substantial new surface added since the original review (event persistence, the redesigned fixtures UI, org audit logging, season handling).
**Method:** Static review against a fresh clone of the current `main` branch.

The repo already contains four prior security documents (`SECURITY.md`, `SECURITY_REVIEW.md` dated 2026-06-17, `SECURITY_AUDIT_REPORT.md`, `Application_Security_Audit_Report.md`) plus this one, now in its second pass.

## Executive Summary — real progress, one new critical

Six days and ~30 commits since the last pass. The good news first: **four of the original nine findings are fixed, and fixed correctly** — not superficially. The RLS fix in particular (#1) matches the recommended remediation almost line-for-line, including the reasoning about `/api/public/live` being unaffected. That's a genuinely well-executed backlog pass.

The bad news: this pass also built substantial new functionality — server-side match-event persistence, specifically — and it shipped with the **same class of bug** #1 was: a route that bypasses every access boundary the rest of the app relies on. This is now the single most severe issue in the codebase, worse than anything in the original report because it's a **write/tampering** vulnerability, not a read one — it lets an authenticated user from any organization inject or corrupt another organization's match results.

| # | Finding | Severity | Status (2026-07-28) |
|---|---|---|---|
| **9** | **NEW — match-event creation has no ownership check, bypasses RLS via service-role** | 🔴 **Critical** | 🆕 Open |
| 0 | Next.js vulnerable to CVE-2025-29927 (middleware bypass) | 🔴 Critical | ❌ Still open |
| 1 | Public RLS policies leaked cross-org teams/fixtures | 🔴 Critical | ✅ **Fixed** |
| 2 | `/api/player/data` returned cross-org data | 🟠 High | ✅ **Fixed** |
| 3 | Stored XSS via CSV player import | 🟠 High | ✅ **Fixed** |
| 4 | Competition fixture generation missing org check | 🟠 High | ✅ **Fixed** |
| **10** | **NEW (minor) — event deletion silently no-ops for Team accounts** | 🟡 Medium | 🆕 Open |
| 5 | CSP allows `unsafe-inline`/`unsafe-eval` | 🟡 Medium | ❌ Still open |
| 6 | CSV/export formula-injection sanitization missing | 🟡 Medium | ❌ Still open |
| 7 | Rate limiting inconsistent on write endpoints | 🟡 Medium | ✅ **Fixed** (sampled) |
| 8 | TOCTOU race in first-admin bootstrap | ⚪ Low | ❌ Still open |

---

## 🔴 9. NEW — Match-event creation accepts writes for any organization

**Where:** `app/api/fixtures/[id]/events/route.ts` (`POST`) — this is the backend for the Add Event flow built this week.

```ts
const authError = requireAuth(auth);   // only checks *someone* is logged in
if (authError) return authError;
// requireOrgAdmin is imported... but never called anywhere in this file
...
const sb = createServiceRoleClient();   // bypasses RLS entirely
const { data, error } = await sb.from('match_events').insert({
  match_id: fixtureId, player_id: playerId, team_id: teamId,
  event_type: eventType, minute: minute || null,
}).select().single();
```

**Why it's critical:** this route fetches the fixture only to confirm it exists — it never checks that the fixture belongs to the caller's organization, never checks that `team_id`/`player_id` in the request body actually belong to one of the two teams in that fixture, and never calls the `requireOrgAdmin` it imports. It then writes through the **service-role client**, which bypasses the properly org-scoped `match_events_write_org_admin` RLS policy that `20260727_fix_player_stats_rls.sql` just added — so that policy provides zero protection here regardless of how correct it is.

Net effect: **any authenticated user — Org Admin, Team account, or Player, from any organization — can POST a fabricated match event for any fixture and any player in the entire database.** Concretely: a coach at Org A can inject a goal for a player at Org B, silently corrupting Org B's score, standings, and player ratings (since these events feed the rating engine). This doesn't require the CVE-2025-29927 middleware bypass (#0) to reach for Org Admin/Team roles, since neither is restricted by the player-only allowlist in `middleware.ts` — but for a Player-role account, which *is* supposed to be blocked from non-GET requests by that allowlist, this is exactly the compounding scenario #0 described: middleware bypass + an endpoint with no in-route check of its own.

**Fix:** resolve the fixture's organization and check it before writing, matching the pattern already used correctly in `app/api/org/audit-logs/route.ts` and `generate-fixtures` (post-fix):
```ts
const { data: fixture } = await supabase
  .from('fixtures')
  .select('home_team_id, away_team_id, teams:teams!fixtures_home_team_id_fkey(organization_id)')
  .eq('id', fixtureId)
  .single();
if (!fixture) return json({ error: 'Fixture not found.' }, { status: 404 });

const orgId = fixture.teams?.organization_id;
const orgError = requireOrgAdmin(auth, orgId);
const isTeamOwner = ownsTeam(auth, fixture.home_team_id) || ownsTeam(auth, fixture.away_team_id);
if (orgError && !isTeamOwner) return json({ error: 'Forbidden' }, { status: 403 });

// also validate teamId is actually one of fixture.home_team_id / away_team_id,
// and playerId belongs to that team, before inserting
```
This also removes the dead `requireOrgAdmin` import's misleading appearance of being enforced — right now it reads as protected in a code review and isn't.

## 🟡 10. NEW (minor) — Event deletion silently no-ops for Team accounts

**Where:** `app/api/events/[id]/route.ts` (`DELETE`)

This route uses the cookie-bound client (correct — RLS applies), but never calls an app-layer ownership check either, relying on RLS alone. That's *accidentally* safe from a security standpoint since the RLS policy is correctly scoped — but the policy (`match_events_delete_org_admin`) only covers `admin_users` and `organization_members` with `owner`/`admin` role; it doesn't cover `team_accounts` at all. A coach deleting an event they logged themselves gets RLS-filtered to zero rows affected, and because Supabase returns no error for a filtered delete, the route returns `{success: true}` anyway — so the UI reports success while nothing happened. Low severity (no data exposure, just a confusing no-op that undermines the feature for its primary intended users), but worth a matching `match_events_delete_team_account` policy (or an app-layer `ownsTeam` check) alongside fixing #9, since both routes are part of the same feature.

---

## Findings from the original review — status update

### ✅ Fixed — 🔴 0 → wait, this one's still open. See below.

### ✅ 1. Public RLS policies (originally 🔴 Critical)
**Fixed in `supabase/migrations/20260723_close_public_rls.sql`.** Verified the actual migration: it drops `teams_read_public`, `fixtures_read_public`, and the superseded `fixtures_read_all_authenticated`/`fixtures_read_for_authenticated`/`fixtures_read_admin_or_involving_team`, then adds a correctly-scoped `fixtures_read_org_members` policy mirroring `teams_read_org_members`. This matches the recommended fix almost exactly, including the note that `/api/public/live` is unaffected since it uses the service-role client. Good fix, nothing further needed here.

### ✅ 2. `/api/player/data` cross-org leak (originally 🟠 High)
**Fixed.** Verified both `allFixtures` (filtered via `teamIdsInOrg`, itself derived from the player's own `organization_id`) and `allPlayers` (`.in("team_id", teamIdsInOrg)`) are now properly org-scoped. Confirmed by reading the current route in full.

### ✅ 3. Stored XSS via CSV import (originally 🟠 High)
**Fixed.** `dangerouslySetInnerHTML` no longer appears in `components/players/csv-import.tsx` — grepped the current file, zero matches.

### ✅ 4. Competition fixture generation missing org check (originally 🟠 High)
**Fixed.** `app/api/competitions/[id]/generate-fixtures/route.ts` now calls `requireOrgAdmin(auth, competition.organization_id)` before generating, exactly as recommended.

### ❌ 0. Next.js CVE-2025-29927 (🔴 Critical) — still open
`package-lock.json` still resolves `next` to `14.1.0`. Not addressed. This is a one-line fix (`npm install next@^14.2.25`) and remains the cheapest high-value item on this list — doubly so now that #9 shows a concrete example of what "an endpoint with no in-route check, reachable if middleware is skipped" actually looks like in this codebase.

### ❌ 5. CSP `unsafe-inline`/`unsafe-eval` (🟡 Medium) — still open
`middleware.ts` is unchanged. Still provides no real XSS mitigation, though this is lower urgency now that #3 (the concrete XSS vector) is fixed — it remains worth doing as defense-in-depth for whatever XSS vector hasn't been found yet.

### ❌ 6. CSV formula injection (🟡 Medium) — still open
`lib/utils/csv.ts` / `lib/utils/export.ts` still have no `sanitizeCsvCell`-style guard. Unchanged from the original finding.

### ✅ 7. Rate limiting inconsistency (🟡 Medium) — appears fixed
Sampled `admin/teams`, `teams`, and `players` routes — all three now call `rateLimit()`, where none did before. Noting this as a sampled confirmation rather than an exhaustive re-check of all 44 routes; worth a full pass to confirm complete coverage, but the pattern looks like it was applied broadly rather than to just these three.

### ❌ 8. Admin-bootstrap race (⚪ Low) — still open
`app/api/auth/admin-signup/route.ts` is unchanged — still a plain count-check with no advisory lock or unique constraint. Lowest priority, as before.

---

## What's already solid (updated)

Everything from the original list still holds, plus:
- **`app/api/org/audit-logs/route.ts`** (new) is a good reference for exactly the pattern #9 is missing: resolve the resource's `organization_id`, call `requireOrgAdmin` *before* touching the service-role client, scope the query with `.eq("organization_id", orgId)` even after the guard passes. This is the fix for #9, already proven correct elsewhere in the same codebase — it just wasn't applied to the events route.
- The RLS migration discipline is genuinely good now — `20260723_close_public_rls.sql` and `20260727_fix_player_stats_rls.sql` both explicitly `DROP POLICY IF EXISTS` the superseded policy before creating the replacement, which is exactly the habit the original review asked for.

---

## Suggested priority order (revised)

1. **Fix #9 (match-event write vulnerability)** — this is now live functionality with an active data-tampering hole, more urgent than anything carried over from the last review.
2. **Upgrade Next.js past 14.2.25 (#0)** — still a one-line fix closing a CVSS 9.1 bypass; also directly relevant to #9's blast radius for Player-role accounts.
3. Fix #10 (event delete RLS gap for Team accounts) — small, ship alongside #9 since it's the same feature.
4. Tighten the CSP (#5).
5. Add CSV-cell sanitization (#6).
6. Harden the admin-bootstrap race (#8) — lowest urgency, unchanged.

Items #1–#4 and #7 from the original list: no action needed, verified fixed.
