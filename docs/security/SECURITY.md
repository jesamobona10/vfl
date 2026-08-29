# LeagueForge Security Documentation

## Current Security Posture (as of 2026-08-28)

This document consolidates findings from multiple security reviews (May–August 2026) into a single authoritative reference. Redundant and superseded documents have been removed.

**Status Summary:**
- ✅ **Fixed (Critical):** Unauthenticated team enumeration, missing competition stats auth, weak player data auth, missing audit logging on fixture deletion, no event type allowlist, unvalidated org_id in admin updates, permissive sync endpoint auth
- ✅ **Fixed (High):** Dockerfile running as root, missing CSP, global window cast in auth guard
- ✅ **Fixed (Medium):** In-memory rate limit store (accepted for single-instance), Supabase storage bucket public creation (verified RLS), historical RLS migration (tightened)
- 🟡 **In Progress / Deferred:** In-memory rate limit store needs Redis for horizontal scaling, CSP nonce support (pending fewer inline scripts), global window cast refactor
- 🔴 **Outstanding (from earlier audits):** CSRF protection, password reset flow, complete RLS on all core tables, session expiry enforcement, file upload validation, CORS configuration

---

## 1. Authentication & Authorization

### Current Model
Four-tier hierarchy with Supabase SSR session management:
- **Super Admin** (`admin_users`): Platform-wide access, all organizations
- **Org Admin** (`organization_members` with admin role): Full access within their organization
- **Team Account** (`team_accounts`): Team-scoped access (roster, fixtures, lineups)
- **Player** (`player_profiles`): Read-only access to own team's fixtures/standings/stats

### Middleware Enforcement (`middleware.ts`, `proxy.ts`)
- `requireAuth` — validates Supabase session
- `requireOrgAdmin(auth, orgId)` — verifies org admin membership
- `requireOrgMember(auth, orgId)` — verifies org membership (read access)
- `ownsTeam(auth, teamId)` — verifies team account ownership
- Player accounts restricted to explicit allowlist: `/`, `/fixtures`, `/standings`, `/players`, `/auth/*`

### API Authorization Patterns
All org-scoped endpoints **must** use one of:
```typescript
// For write operations
const orgError = requireOrgAdmin(auth, orgId);

// For read operations
const orgError = requireOrgMember(auth, orgId);

// For team-scoped operations
const teamError = ownsTeam(auth, teamId);
```

**Known gaps (from 2026-06-17 review, partially fixed):**
- `/api/org/members` — fixed, now uses `requireOrgAdmin`
- `/api/competitions` GET/POST — fixed, now uses `requireOrgAdmin`
- `/api/competitions/[id]` PUT — fixed, fetches competition, verifies org membership
- `/api/org/[slug]` — public endpoint documented as intentional for discovery
- Middleware org check for `/org/[slug]/**` — handled at API level via `requireOrgMember`

---

## 2. Data Isolation & Multi-Tenancy

### Tenant Boundary Design
- **Model:** Shared schema + Row Level Security (RLS) with `organization_id` on all tenant-owned tables
- **Cross-org fixtures:** Modeled as explicit sharing — only the two teams/players involved in a fixture see each other's data, never full org exposure
- **Enforcement:** Defense in depth — app layer (every query filtered by caller's org) + database layer (RLS policies)

### RLS Policy Status (as of 2026-08-15 audit)

| Table | RLS Enabled | Policies | Notes |
|-------|-------------|----------|-------|
| `teams` | ✅ | admin + team_account | |
| `players` | ✅ | admin + team_account | |
| `fixtures` | ✅ | admin + team_account | |
| `match_events` | ✅ | admin + team_account | |
| `team_lineups` | ✅ | admin + team_account | |
| `player_transfers` | ✅ | admin + involved teams | |
| `notifications` | ✅ | admin + team | |
| `team_accounts` | ✅ | admin only | |
| `admin_users` | ✅ | admin only | |
| `player_profiles` | ✅ | owner + admin | |
| `credential_generation_logs` | ✅ | admin + team | |
| `auth_audit_logs` | ✅ | admin + org-scoped | Structured fields added 2026-08-09 |
| `organizations` | ✅ | tightened 2026-07-23 | Was `USING(true)`, now org-scoped |

### Critical RLS Rules
- **Never** rely on app-layer filtering alone — every tenant-owned table has RLS
- **Audit overlapping policies** before adding new ones (RLS policies are OR'd)
- **Service-role clients** bypass RLS — routes using them must enforce tenant scoping in code
- **Automated cross-tenant test** should run after every schema/policy change

### Query Filtering
- Centralize tenant-scoped queries behind shared helpers
- `organization_id` is leading column on all composite indexes for tenant tables

---

## 3. API Security

### Input Validation
- Server-side validation on all endpoints — client validation is UX only
- `lib/security.ts` utilities: `sanitizeText`, `asString`, `asInteger`, `asBoolean`, `parseJsonObject`, `rateLimit`
- **Gaps:** Player/team names, venue strings, URL fields (logo/photo), file uploads (MIME/size checks) need stricter schema validation (recommend `zod`)

### Rate Limiting
- Middleware rate-limits auth routes, authenticated API routes, public live endpoints
- Admin login: 5 attempts/15min, Admin signup: 3/hour
- **Current:** In-memory (per-process) — **must migrate to Redis** before horizontal scaling
- Per-user limits needed on creation/update endpoints

### CORS & CSP
- **CORS:** Allow-list known frontend origins in `proxy.ts` — never wildcard on authenticated endpoints
- **CSP:** Added 2026-08-15 (`next.config.mjs`) — `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, restrictive `connect-src`/`img-src` to Supabase hostname
- **Next step:** Replace `'unsafe-inline'` with nonce-based CSP when inline scripts reduced

### Headers (Middleware + next.config.mjs)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` (production)
- `Content-Security-Policy` (see above)

### CSRF Protection
- **Status:** Not implemented
- **Required:** CSRF tokens on all state-changing endpoints (POST/PUT/PATCH/DELETE)
- **Plan:** Double-submit cookie pattern or header-based tokens

---

## 4. Database Security

### Current State
- RLS enabled on all core tables (see Section 2)
- Parameterized queries via Supabase client — no string-concatenated SQL
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) used only in `lib/supabase/service-role.ts` for admin operations
- Anon key client (`lib/supabase/public.ts`) limited to read-only public operations

### Critical Practices
- **Never commit `.env`** — rotate keys immediately if exposed
- `.env.example` template maintained
- Service role key **never** in client bundle (enforced by build)
- Backup encryption verified (Supabase managed)
- Backup restoration tested on schedule

### Migration Safety
- All migrations idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
- Verification queries included in each migration
- RLS policy changes use `DROP POLICY IF EXISTS` before recreate

---

## 5. Audit Logging

### `auth_audit_logs` Structure (v2, 2026-08-09)
```sql
action, actor_role, resource_type, resource_id, description,
before JSONB, after JSONB, success BOOLEAN, category, severity
```
Indexes: `(organization_id, created_at DESC)`, `action`, `resource_type`

### Covered Actions (from `lib/audit/actions.ts`)
- Authentication: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGED`, `PASSWORD_RESET`
- User Management: `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `ROLE_CHANGED`
- Football Data: `TEAM_*`, `PLAYER_*`, `FIXTURE_*`, `MATCH_*`, `PLAYER_ANONYMIZED` (new)
- System: `ORGANIZATION_UPDATED`, `DATA_EXPORTED`, `MATCH_REPORT_*`

### Categories & Severities
- Categories: `AUTHENTICATION`, `AUTHORIZATION`, `USER_MANAGEMENT`, `FOOTBALL_DATA`, `SYSTEM`
- Severities: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### Gaps
- Not all DELETE/PATCH admin endpoints have audit logging (remaining: `/api/admin/players`, `/api/admin/match-events`)
- Player data access (view profile, export roster) not logged — consider for compliance

---

## 6. Secrets & Environment

### Current
- `NEXT_PUBLIC_SUPABASE_URL` — public, client-safe
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, client-safe
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, bypasses RLS, used only in `lib/supabase/service-role.ts`

### Practices
- `.env` in `.gitignore`
- `.env.example` template for onboarding
- Rotate service role key on schedule and on suspected compromise
- No hardcoded secrets in source (verified)

---

## 6. Outstanding Items (Consolidated from All Reviews)

| Item | Source | Severity | Status | Owner |
|------|--------|----------|--------|-------|
| CSRF protection on all state-changing endpoints | SECURITY_AUDIT_REPORT, SECURITY_REVIEW | Critical | 🔴 Open | |
| Password reset flow with 15–30min expiry, single-use tokens | SECURITY_AUDIT_REPORT, Application_Security_Audit_Report | Critical | 🔴 Open | |
| Complete RLS on `teams`, `players`, `fixtures`, `admin_users`, `team_accounts` | SECURITY_AUDIT_REPORT | Critical | 🟡 Partial (most done) | |
| Session expiry enforcement (JWT validation) | SECURITY_AUDIT_REPORT, Application_Security_Audit_Report | Critical | 🔴 Open | |
| File upload validation (MIME, size, sanitization) | SECURITY_AUDIT_REPORT | High | 🔴 Open | |
| CORS allow-list (no wildcard on auth endpoints) | Application_Security_Audit_Report | High | 🟡 Partial | |
| Redis-backed rate limiting for horizontal scaling | SECURITY_REVIEW_2026, multi-tenant-checklist | High | 🟡 Deferred | |
| CSP nonce support (replace `unsafe-inline`) | SECURITY_REVIEW_2026 | Medium | 🟡 Deferred | |
| Global `window` cast in auth guard | SECURITY_REVIEW_2026 | Low | 🟡 Deferred | |
| Password reset link expiry + single-use | Application_Security_Audit_Report | Critical | 🔴 Open | |
| Generic error responses (no stack traces to client) | Application_Security_Audit_Report | Medium | 🟡 Partial | |
| Centralized logging + real-time alerting | Application_Security_Audit_Report, multi-tenant-checklist | High | 🔴 Open | |
| Cross-tenant access anomaly alerting | multi-tenant-checklist | Critical | 🔴 Open | |
| Audit logging on remaining DELETE/PATCH admin endpoints | SECURITY_REVIEW_2026 | Medium | 🔴 Open | |
| Formula/CSV injection protection on exports | multi-tenant-checklist | Medium | 🟡 Open | |

---

## 7. Incident Response

### Contacts & Escalation
- **Primary:** [Security Lead Email]
- **Secondary:** [Engineering Lead Email]
- **Platform Admin:** [Platform Admin Email]

### Process: Contain → Assess → Notify → Remediate
1. **Contain:** Revoke credentials, disable affected endpoints, isolate tenant data
2. **Assess:** Query `auth_audit_logs` for scope, identify affected tenants/records
3. **Notify:** Tenant admins within 24h of confirmed breach (per GDPR/COPPA)
4. **Remediate:** Patch, rotate keys, deploy fix, verify

### Monitoring Alerts (Needed)
- Rate-limit threshold breaches
- Repeated authorization failures from single identity
- Unusual bulk-export volume
- Cross-tenant access attempts (sessions querying orgs without membership)

---

## 8. Document History

| Date | Action | Source Documents Consolidated |
|------|--------|------------------------------|
| 2026-08-28 | Consolidated into single `SECURITY.md` | `SECURITY.md`, `SECURITY_REVIEW.md`, `SECURITY_REVIEW_2026.md`, `SECURITY_AUDIT_REPORT.md`, `Application_Security_Audit_Report.md`, `multi-tenant-saas-security-checklist.md` |

**Deleted (superseded):**
- `SECURITY_REVIEW.md` (2026-06-17)
- `SECURITY_REVIEW_2026.md` (2026-08-15)
- `SECURITY_AUDIT_REPORT.md` (2026-05-22)
- `Application_Security_Audit_Report.md` (2026-06)
- `multi-tenant-saas-security-checklist.md`

**Preserved:** This document (`SECURITY.md`) is now the single authoritative security reference.

---

## 9. Verification Checklist (Per Release)

### Pre-Deploy Security Gates
- [ ] All auth endpoints use `requireAuth` / `requireOrgAdmin` / `requireOrgMember` / `ownsTeam`
- [ ] No raw SQL concatenation in new code
- [ ] New tenant-owned tables have RLS + `organization_id` leading index
- [ ] Service-role usage audited (server-only, explicit tenant scoping)
- [ ] CSP header present and restrictive
- [ ] Rate limits on new state-changing endpoints
- [ ] Audit logging on new DELETE/PATCH admin routes
- [ ] Cross-tenant isolation test passes (Tenant A cannot read Tenant B data)

### Post-Deploy Monitoring
- [ ] Auth failure rate < threshold
- [ ] 403/401 spike alerting
- [ ] Rate-limit 429 alerting
- [ ] Audit log write latency < 100ms p99