# Security Review: Authentication & Authorization

**Date:** 2026-06-17  
**Project:** VUNA Football League (Next.js)

## Executive Summary

The application implements a multi-tier authentication system (super admin, org admin, team account, player) with Supabase for session management. While the foundation is solid, several authorization gaps create **moderate severity vulnerabilities** allowing unauthorized data access.

---

## Findings

### 🔴 CRITICAL ISSUES

#### 1. **Organization Member Data Exposure** 
**Endpoint:** `/api/org/members`  
**Severity:** HIGH  
**Issue:** Requires authentication but no organization membership validation
```typescript
// Current code only checks if user is authenticated
const authError = requireAuth(auth);
if (authError) return authError;

// Missing: validation that user belongs to the organization
```
**Impact:** Any authenticated user (team account, player, any org admin) can list all members of any organization by querying `GET /api/org/members?org_id=<org-id>`

**Fix:** Add organization membership check before returning members
```typescript
const orgError = requireOrgAdmin(auth, orgId);
if (orgError) return orgError;
```

---

#### 2. **Public Organization Information Disclosure**
**Endpoint:** `/api/org/[slug]`  
**Severity:** MEDIUM  
**Issue:** No authentication or authorization check - completely public
```typescript
export async function GET(_request: Request, { params }) {
  const sb = createServiceRoleClient();
  const { data: org } = await sb
    .from("organizations")
    .select("*")
    .eq("slug", params.slug)
    .single();
  return json({ org });
}
```
**Impact:** Organization details (name, type, ID) are publicly accessible via slug enumeration

**Risk Assessment:** 
- Low impact if organization data is non-sensitive
- Could enable further enumeration attacks
- Consider if org IDs should be derivable from slugs

**Recommendation:** Either document this as intentional (public discovery) or add authentication

---

#### 3. **Competition Authorization Bypass**
**Endpoint:** `/api/competitions` (GET and POST)  
**Severity:** HIGH  
**Issue:** No organization membership validation

**GET Request:**
```typescript
const orgId = searchParams.get("org_id");
// No check that user belongs to this organization
const { data: competitions } = await sb
  .from("competitions")
  .select("*")
  .eq("organization_id", orgId);
```

**POST Request:**
```typescript
// Only checks authentication, not authorization
if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

// Missing check that user can create in this organization
const { data: competition } = await sb
  .from("competitions")
  .insert({
    organization_id, // User can specify ANY organization
    ...
  });
```

**Impact:** 
- Any authenticated user can read all competitions from any organization
- Any authenticated user can create competitions in any organization
- Allows privilege escalation (team account creates org-level resources)

**Fix:**
```typescript
const orgError = requireOrgAdmin(auth, orgId);
if (orgError) return orgError;
```

---

#### 4. **Competition Update Authorization Bypass**
**Endpoint:** `/api/competitions/[id]` (PUT)  
**Severity:** MEDIUM  
**Issue:** Minimal authorization check
```typescript
if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
// No validation that user owns/belongs to this competition's organization

await sb
  .from("competitions")
  .update(body)  // User can update ANY field of ANY competition
  .eq("id", params.id);
```

**Impact:** Any authenticated user can modify competitions from other organizations

**Fix:** Fetch competition, verify organization membership, then allow update

---

### 🟡 MEDIUM ISSUES

#### 5. **Org Admin Privileges Not Enforced in Frontend Routes**
**Endpoint:** `/app/org/[slug]/**`  
**Severity:** MEDIUM  
**Issue:** Middleware allows "admin" role (line 52 in middleware.ts) to include org members
```typescript
const { data: orgMember } = await supabase
  .from("organization_members")
  .select("id")
  .eq("user_id", userId)
  .maybeSingle();
if (orgMember) return "admin";  // Treats org member as same as super_admin
```

**Impact:** Organization members get treated like super admins in middleware, even for non-org pages

**Mitigated by:** Endpoint-level authorization checks (like `requireOrgAdmin`), but inconsistent

---

#### 6. **Inconsistent Authorization Patterns**
**Severity:** MEDIUM  
**Issue:** Three different authorization approaches create maintenance burden:
1. `requireAdmin()` - Super admin only
2. `requireOrgAdmin(auth, orgId)` - Organization admin validation
3. `ownsTeam(auth, teamId)` - Team-level check
4. `requireAuth(auth)` - Just authentication, no authorization

**Problem:** Some endpoints use pattern #4 where they should use #2 or #3, creating inconsistent protection

**Affected Endpoints:**
- `/api/org/members` - uses `requireAuth()` 
- `/api/competitions` - uses `requireAuth()` 
- `/api/competitions/[id]` - uses `requireAuth()`

---

#### 7. **Missing Org Authorization in Frontend Navigation**
**Endpoint:** `/app/org/[slug]/**`  
**Severity:** MEDIUM  
**Issue:** Middleware redirects non-admin players to `/fixtures` but doesn't restrict org pages by membership

While team accounts cannot access `/admin` pages, there's no explicit check in middleware that users accessing `/org/[slug]` actually belong to that organization. This is caught at the API level but not at page access level.

---

### 🟢 POSITIVE FINDINGS

#### ✅ Strong Points

1. **Session Management:** Supabase SSR with automatic token refresh and secure cookie handling
2. **Rate Limiting:** Implemented across all auth endpoints (5 attempts/15min for login, 10/min for general API)
3. **Security Headers:** HSTS, X-Frame-Options, X-Content-Type-Options, CSP-adjacent rules in middleware
4. **Password Policy:** Enforced 12+ chars with uppercase, lowercase, numbers
5. **Email Validation:** RFC-compliant email validation with length limits
6. **SQL Injection Prevention:** Supabase parameterized queries throughout
7. **XSS Protection:** Text sanitization with `sanitizeText()`, input type coercion with `asString()`, etc.
8. **HTTPS Enforcement:** Redirect from HTTP to HTTPS in production
9. **Player Access Control:** Player accounts properly restricted to read-only pages (`/fixtures`, `/standings`, `/players`)
10. **Logging:** Security events logged (failed logins, rate limits, authorization failures)
11. **Service Role Isolation:** Service role client used for privileged operations, not user context

---

## Summary of Required Fixes

| Endpoint | Issue | Priority | Fix |
|----------|-------|----------|-----|
| `/api/org/members` | Missing org membership check | HIGH | Add `requireOrgAdmin()` |
| `/api/competitions` (GET) | No org authorization | HIGH | Add `requireOrgAdmin()` |
| `/api/competitions` (POST) | No org authorization | HIGH | Add `requireOrgAdmin()` and validate `organization_id` |
| `/api/competitions/[id]` (PUT) | No org authorization | HIGH | Fetch competition, verify org membership |
| `/api/org/[slug]` | Public endpoint | MEDIUM | Document or add auth requirement |
| Middleware org check | Unclear org access | MEDIUM | Add org membership validation for `/org/[slug]/**` routes |

---

## Recommendations

1. **Immediate (High Priority):**
   - Add `requireOrgAdmin(auth, orgId)` checks to all org-scoped API endpoints
   - Validate that competition IDs belong to the organization being accessed
   - Create a helper: `requireOrgMember(auth, orgId)` for read-only org access

2. **Short Term (Medium Priority):**
   - Add organization membership check in middleware for `/org/[slug]/**` routes
   - Create consistent authorization patterns across all endpoints
   - Add integration tests for cross-organization access attempts

3. **Long Term (Maintenance):**
   - Document authorization rules per endpoint
   - Create middleware that validates organization context automatically
   - Add a test suite for authorization bypass scenarios
   - Consider adding audit logging for all data access

---

## Testing Recommendations

Create security tests for:
1. **Cross-organization access:** Verify org admin of Org A cannot access Org B data
2. **Team account escalation:** Verify team accounts cannot create competitions
3. **Player account escapes:** Verify players cannot access APIs outside `isPlayerAllowedApi()`
4. **Slug enumeration:** Track if organization slugs should be discoverable

---

## References

- OWASP A1:2021 - Broken Access Control
- CWE-639: Authorization Bypass Through User-Controlled Key
- CWE-276: Incorrect Default Permissions

