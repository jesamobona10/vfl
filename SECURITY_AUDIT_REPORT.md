# VUNA Football League - Comprehensive Security & Code Audit Report

**Project:** VUNA Football League (Next.js 14.1)
**Date:** May 22, 2026
**Status:** ⚠️ Multiple Security Issues Identified

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Structure Overview](#project-structure-overview)
3. [Authentication System Review](#authentication-system-review)
4. [API Endpoints Security Analysis](#api-endpoints-security-analysis)
5. [Database Security & RLS Policies](#database-security--rls-policies)
6. [Input Validation & Sanitization](#input-validation--sanitization)
7. [Secrets & Environment Variables](#secrets--environment-variables)
8. [Rate Limiting & Abuse Protection](#rate-limiting--abuse-protection)
9. [Frontend Code Security](#frontend-code-security)
10. [Deployment & HTTPS Configuration](#deployment--https-configuration)
11. [Logging & Monitoring](#logging--monitoring)
12. [Critical Vulnerabilities Found](#critical-vulnerabilities-found)
13. [Medium Risk Issues](#medium-risk-issues)
14. [Low Risk Issues](#low-risk-issues)
15. [Recommendations & Remediation](#recommendations--remediation)

---

## Executive Summary

### ✅ Strengths
- Security utilities exist in `lib/security.ts`.
- Supabase Auth is used for login and session handling.
- Middleware enforces HTTPS and security-related response headers.
- Some RLS policies are defined for select tables.

### ⚠️ Critical Issues Found
1. **Exposed Supabase service role key in `.env`**
2. **Lack of CSRF protection** on state-changing endpoints
3. **Incomplete RLS coverage for core tables**
4. **Missing session expiry handling in authentication**
5. **Weak input validation in multiple APIs**
6. **Missing file upload sanitization and size limits**

### 📊 Risk Summary
- **Critical:** 4 issues
- **High:** 7 issues
- **Medium:** 10 issues
- **Low:** 5 issues

---

## Project Structure Overview

```
football-league-next/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── admin-login/
│   │   │   ├── admin-signup/
│   │   │   ├── team-login/
│   │   │   ├── logout/
│   │   │   └── session/
│   │   ├── players/
│   │   ├── teams/
│   │   ├── fixtures/
│   │   ├── transfers/
│   │   ├── notifications/
│   │   ├── public/
│   │   └── sync/
│   ├── auth/
│   ├── admin/
│   └── ...
├── components/
│   ├── admin/
│   ├── layout/
│   ├── players/
│   ├── teams/
│   └── fixtures/
├── lib/
│   ├── security.ts
│   ├── store/
│   ├── supabase/
│   ├── logic/
│   └── types.ts
├── middleware.ts
├── package.json
├── .env
├── supabase/migration.sql
└── SECURITY_AUDIT_REPORT.md
```

---

## Authentication System Review

### Current Implementation

- `lib/store/auth-slice.ts` handles auth state and login functions.
- `/api/auth/admin-login/route.ts` authenticates admin users via Supabase.
- `/api/auth/admin-signup/route.ts` creates admin accounts through Supabase admin API.
- `/api/auth/team-login/route.ts` logs in team accounts.
- `middleware.ts` protects routes and validates sessions.

### Positive Findings
- Authentication is centralized.
- Login and signup include IP-based rate limiting.
- Security events are logged for auth failures and successes.
- Sensitive frontend credentials are not directly leaked from API responses.

### Issues Found

#### CRITICAL: Exposed Supabase Service Role Key
- `.env` contains `SUPABASE_SERVICE_ROLE_KEY`.
- This key bypasses RLS and should never be committed or exposed.
- Remediation: rotate keys immediately and move secrets into environment variables stored securely.

#### CRITICAL: No CSRF Protection
- State-changing endpoints do not verify CSRF tokens.
- This exposes the app to cross-site request forgery.
- Remediation: implement CSRF verification for POST/PUT/DELETE requests.

#### HIGH: Weak Password Validation
- `validatePassword()` exists but does not enforce a strong rule set.
- Remediation: require at least 12 characters, uppercase, lowercase, digits, and special characters.

#### HIGH: Session Expiration Not Enforced
- Middleware validates session existence but does not enforce token expiry or refresh.
- Remediation: validate JWT expiration on every request and enforce session logout.

#### HIGH: Missing Password Reset Flow
- There is no password reset or recovery endpoint.
- Remediation: add password reset token generation and expiration.

#### MEDIUM: Plain Password Storage in Client State
- `auth-slice.ts` uses a `password` field on `currentTeamAccount`.
- Remediation: remove password from client state entirely.

---

## API Endpoints Security Analysis

### Authentication Endpoints

| Endpoint | Auth Required | Validation | Rate Limit | Notes |
|----------|---------------|------------|------------|-------|
| `/api/auth/admin-login` | No | yes | yes | Good, but no CSRF |
| `/api/auth/admin-signup` | No | yes | yes | Good, but needs strong password validation |
| `/api/auth/team-login` | No | partial | no | Needs stronger validation and rate limiting |
| `/api/auth/session` | yes | partial | no | Should validate session expiry |
| `/api/auth/logout` | yes | partial | no | OK if session invalidation is implemented |

### Player Endpoints

| Endpoint | Auth Required | Ownership Check | Validation | Notes |
|----------|---------------|----------------|------------|-------|
| `/api/players` | yes | partial | partial | Needs stronger schema validation |
| `/api/players/[id]` | yes | partial | partial | Ownership enforced but input sanitization missing |

### Team Endpoints

| Endpoint | Auth Required | Ownership Check | Validation | Notes |
|----------|---------------|----------------|------------|-------|
| `/api/teams/[id]` | yes | partial | partial | Need explicit admin-only checks and URL validation |
| `/api/teams/[id]/lineups` | yes | partial | partial | RLS present, API should enforce ownership too |
| `/api/teams/[id]/lineups/[lineupId]` | yes | partial | partial | Similar improvements needed |

### Fixtures Endpoints

| Endpoint | Auth Required | Ownership Check | Validation | Notes |
|----------|---------------|----------------|------------|-------|
| `/api/fixtures` | yes | partial | partial | Needs date/time validation and conflict checks |
| `/api/fixtures/[id]` | yes | partial | partial | Should enforce admin-only editing in API if required |

### Public & Sync Endpoints

| Endpoint | Auth Required | Notes |
|----------|---------------|-------|
| `/api/public/live` | no | Good for public access, limited info |
| `/api/sync/*` | yes | Needs strict admin access and validation |

### Transfer & Notifications

| Endpoint | Auth Required | Ownership Check | Notes |
|----------|---------------|----------------|-------|
| `/api/transfers` | yes | partial | Needs stronger validation and ownership enforcement |
| `/api/notifications` | yes | partial | Good RLS, but API should verify user team ownership as well |

---

## Database Security & RLS Policies

### Current Status

- `supabase/migration.sql` enables RLS on key tables.
- `team_lineups`, `player_transfers`, and `notifications` have explicit RLS policies.
- `teams`, `players`, `fixtures`, `admin_users`, and `team_accounts` lack explicit RLS policies.

### Critical Findings

#### CRITICAL: Core Tables Missing RLS Policies
- `teams`, `players`, `fixtures`, `admin_users`, `team_accounts` need explicit policies.
- Without them, user session access is not properly restricted.
- If the service role key is compromised, all data is exposed.

#### Recommendation
- Add explicit RLS for SELECT/INSERT/UPDATE/DELETE on core tables.
- Restrict access to:
  - admin users
  - team accounts owning the data

Example:
```sql
CREATE POLICY "players_read_admin_or_team" ON players
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_accounts
      WHERE id = auth.uid() AND team_id = players.team_id
    )
  );
```

---

## Input Validation & Sanitization

### Positive Findings
- `lib/security.ts` includes utilities for safe JSON parsing and rate limiting.
- Email validation is implemented.
- Password validation is present.

### Issues Found
- Player names, team names, venue strings, and notes do not have strict validation.
- URL fields (logo, photo) are not validated for only safe HTTP/HTTPS image sources.
- File uploads lack size and MIME checks.
- Several API handlers accept raw JSON with minimal schema verification.

### Recommended Validation Patterns
- Use a schema validator like `zod` or `joi`.
- Enforce strict types on every request body.
- Sanitize HTML-like input before storing or rendering.
- Validate all URL fields using `new URL()` and allow only safe protocols.
- Restrict numeric values to reasonable ranges.

Example:
```ts
const playerSchema = z.object({
  name: z.string().min(2).max(100),
  position: z.enum(['GK','DEF','MID','ATT']),
  teamId: z.number().int().positive(),
  jerseyNumber: z.number().int().min(1).max(99),
  photoUrl: z.string().url().optional(),
});
```

---

## Secrets & Environment Variables

### Critical Exposure
- `.env` currently contains:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Why this is critical
- `SUPABASE_SERVICE_ROLE_KEY` is sensitive and allows bypassing RLS.
- `.env` must never be committed to version control.

### Recommended Fix
1. Rotate Supabase keys immediately.
2. Add `.env` and `.env.local` to `.gitignore`.
3. Use `.env.example` for templates.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` only in server-side environment variables.

---

## Rate Limiting & Abuse Protection

### Current Implementation
- Middleware rate limits auth and API requests.
- Admin login is limited to 5 attempts per 15 minutes.
- Admin signup is limited to 3 attempts per hour.

### Issues
- Rate limiting is likely in-memory and not distributed.
- Many endpoints lack dedicated per-user rate limits.
- Uploads, account creation, and data sync endpoints do not have explicit protection.

### Recommended Enhancements
- Use Redis or persistent storage for rate limit state.
- Add endpoint-specific rate limits for creation and update operations.
- Track abusive patterns and log them as security events.

---

## Frontend Code Security

### Strengths
- Sensitive routes are blocked behind auth middleware.
- Login form uses masked password inputs.
- No direct password exposure in API responses.

### Issues
- State persistence may store auth and user info in browser storage.
- No Content Security Policy header is configured.
- Some user-entered strings are rendered without sanitization.
- `NEXT_PUBLIC` variables expose public keys to the browser, which is expected but requires strict RLS.

### Recommendations
- Do not persist auth state or tokens in local storage.
- Add CSP and CORS headers in middleware.
- Sanitize user-generated content before display.

---

## Deployment & HTTPS Configuration

### What is good
- `middleware.ts` redirects HTTP to HTTPS in production.
- Security headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and HSTS are set.

### Missing
- Content Security Policy (CSP).
- CORS restrictions for API origins.
- `.env.example` and secret management documentation.
- Backup and secrets rotation policy.

---

## Logging & Monitoring

### Existing Coverage
- Auth attempts are logged via `logSecurityEvent()`.
- API errors are logged via `logApiError()`.

### Gaps
- Sensitive actions like player transfers and team edits are not fully audited.
- No alerting for anomalous activity.
- No integration with an external monitoring system.

### Recommended Logging
- Log user ID, IP, action, and resource ID for critical operations.
- Track failed logins and rate limit events.
- Add an audit log for admin operations.

---

## Critical Vulnerabilities Found

### 🔴 Exposed Supabase Service Role Key
- File: `.env`
- Fix: Rotate keys and remove `.env` from Git.

### 🔴 Missing CSRF Protection
- Scope: All state-changing requests.
- Fix: Implement CSRF tokens and header validation.

### 🔴 Incomplete RLS Policies
- Tables: `teams`, `players`, `fixtures`, `admin_users`, `team_accounts`
- Fix: Add explicit RLS policies and use least privilege.

### 🔴 Missing Session Expiry Enforcement
- Fix: Enforce JWT expiration and refresh flow.

---

## Medium Risk Issues

- Weak password rules
- No password reset flow
- In-memory rate limiting
- Insufficient file upload validation
- Missing CORS headers
- Generic error handling exposing internals
- Potential XSS via unsanitized strings

---

## Low Risk Issues

- Missing `.env.example`
- Missing dependency security scan
- No API documentation
- No security testing automation
- Incomplete frontend sanitization guidance

---

## Recommendations & Remediation

### Phase 1: Urgent
1. Rotate Supabase keys.
2. Remove `.env` from Git and add `.env` to `.gitignore`.
3. Implement CSRF protection.
4. Audit and fix admin-only endpoint checks.
5. Add strong password validation.

### Phase 2: High
6. Implement session expiration and refresh.
7. Add password reset flow.
8. Enforce strict input validation with `zod`.
9. Use persistent rate limiting storage.
10. Complete RLS coverage on all tables.

### Phase 3: Medium
11. Add CORS and CSP headers.
12. Introduce audit logging for sensitive operations.
13. Integrate error monitoring and alerting.
14. Document secret handling and rotation.
15. Run automated security scans.

---

## File-by-File Checklist

### Auth & Security
- [ ] `lib/store/auth-slice.ts`
- [ ] `app/api/auth/admin-login/route.ts`
- [ ] `app/api/auth/admin-signup/route.ts`
- [ ] `app/api/auth/team-login/route.ts`
- [ ] `middleware.ts`

### API Endpoints
- [ ] `app/api/players/route.ts`
- [ ] `app/api/players/[id]/route.ts`
- [ ] `app/api/teams/[id]/route.ts`
- [ ] `app/api/teams/[id]/lineups/route.ts`
- [ ] `app/api/teams/[id]/lineups/[lineupId]/route.ts`
- [ ] `app/api/fixtures/route.ts`
- [ ] `app/api/transfers/route.ts`
- [ ] `app/api/notifications/route.ts`
- [ ] `app/api/upload/logo/route.ts`

### Database
- [ ] `supabase/migration.sql`

### Deployment
- [ ] `.env` / `.env.example`
- [ ] `middleware.ts`
- [ ] `package.json`

---

## Testing Checklist

### Security Tests
- [ ] Test failed login rate limiting.
- [ ] Test CSRF protection.
- [ ] Test session expiry.
- [ ] Test user ownership on all resources.
- [ ] Test input validation rejection.
- [ ] Test file upload limits.
- [ ] Test admin endpoints from non-admin account.

### Example Commands
```bash
curl -X POST http://localhost:3000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrong"}'
```

```bash
curl -X POST http://localhost:3000/api/players \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: invalid" \
  -d '{"name":"Test"}'
```

---

## Conclusion

This application has a solid security foundation in place, but it requires immediate remediation for critical issues before production use. The most urgent tasks are key rotation, CSRF protection, complete RLS policy coverage, and stronger session handling.

**Next steps:** fix critical issues first, then move to rate limiting, validation, and monitoring.
