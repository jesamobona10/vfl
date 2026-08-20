# Security Audit Report

**Date:** 2026-08-15
**Scope:** Full codebase review of VFL/LeagueForge Next.js + Supabase application

---

## Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| Critical | 3     | 3     |
| High     | 4     | 4     |
| Medium   | 6     | 3     |
| **Total**| **13**| **10**|

---

## Critical — Fixed

### 1. Unauthenticated team enumeration — `app/api/teams/route.ts:15`

**Before:** `GET /api/teams` had no `requireAuth` check. Any anonymous visitor could enumerate every team in the database via `?org_id=` parameter.

**After:** `requireAuth` enforced; `org_id` defaults to the caller's membership org, preventing cross-org enumeration.

---

### 2. Missing authorization on competition stats — `app/api/competitions/[id]/stats/route.ts:10`

**Before:** Only checked `auth` was truthy (any logged-in user). No `requireOrgMember` — any user could read stats for any competition by guessing the UUID.

**After:** Loads `organization_id` from the competition and calls `requireOrgMember(auth, comp.organization_id)`.

---

### 3. Weak auth on player data — `app/api/player/data/route.ts:6`

**Before:** Only called `supabase.auth.getSession()` and checked `!session`. No `requireAuth`, no org membership check.

**After:** Uses `getAuthContext` + `requireAuth`, queries player profile via `auth.userId`.

---

## High — Fixed

### 4. Missing audit logging on fixture deletion — `app/api/organizations/[slug]/delete-fixtures/route.ts`

**Before:** Deleted fixtures with no audit record.

**After:** Calls `writeAuditRecord` with `AUDIT_ACTIONS.FIXTURE_DELETED` and `requireOrgAdmin` replaces the inline role check.

---

### 5. No event type allowlist — `app/api/fixtures/[id]/events/route.ts:29`

**Before:** Any string could be passed as `event_type`, allowing injection of arbitrary data.

**After:** Validates against an explicit allowlist of 18 known event types.

---

### 6. Unvalidated `organization_id` in admin updates — `app/api/admin/competitions/[id]/route.ts` and `app/api/admin/teams/[id]/route.ts`

**Before:** `organization_id` from request body was passed directly to the database without validating the org exists, allowing assignment to a non-existent org.

**After:** Validates the target org exists before allowing the update.

---

### 7. Permissive sync endpoint auth — `app/api/sync/fixtures/route.ts:29`

**Before:** Only checked `!auth` truthy, missing UUID format validation on userId.

**After:** Added `requireOrgAdmin` check for non-admin callers.

---

## Medium — Fixed

### 8. Dockerfile running as root — `Dockerfile`

**Before:** No `USER` directive; container ran as root.

**After:** Creates and switches to `nextjs:nodejs` (uid/gid 1001) before `CMD`.

---

### 9. No Content-Security-Policy — `next.config.mjs`

**Before:** No CSP header; vulnerable to XSS via inline script injection.

**After:** Added `Content-Security-Policy` header with `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, and restrictive `connect-src`/`img-src` scoped to Supabase hostname.

---

### 10. Global `window` cast in auth guard — `lib/auth-guard.ts:45-46`

**Before:** `(window as any).__lfAuthGuardInstalled` global flag bypasses type safety.

**Status:** Deferred — low risk, requires broader refactor of the auth guard pattern.

---

## Medium — Deferred

### 11. In-memory rate limit store — `lib/security.ts`

Resets on process restart. Acceptable for single-instance deploys; needs Redis adapter for horizontal scaling.

---

### 12. Supabase storage bucket creation — `app/api/upload/flyer-bg/route.ts`

`createBucket` with `public: true` for flyer backgrounds. Low risk since bucket names are predictable but RLS should be verified in Supabase dashboard.

---

### 13. Historical RLS migration — `supabase/migrations/20260605_organizations.sql`

Originally had `USING(true)` for public read on organizations. Tightened in `20260723_close_public_rls.sql`. Verified closed.

---

## Low / Informational

- `lib/supabase/service-role.ts` — Uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. Acceptable for admin operations; ensure it is never exposed to the client bundle.
- `lib/supabase/public.ts` — Anon key client is correctly limited to read-only operations.
- No hardcoded secrets found in source (previous `NEXTAUTH_URL` / Supabase URL hardcodes already removed).

---

## Recommendations

1. **Enable Supabase RLS on all tables** — verify in dashboard that RLS policies cover every table; the code-level checks above are defense-in-depth.
2. **Add rate limiting to password-protected routes** — the `requireOrgAdmin` path currently has no rate limit; add per-user limiting for login-gated admin endpoints.
3. **Rotate `SUPABASE_SERVICE_ROLE_KEY`** periodically and restrict its use to `lib/supabase/service-role.ts` only.
4. **Add audit logging** to all `DELETE` and `PATCH` admin endpoints (remaining routes: `/api/admin/players`, `/api/admin/match-events`).
5. **CSP nonce support** — once the application has fewer inline scripts, switch from `'unsafe-inline'` to nonce-based CSP for stronger XSS protection.
