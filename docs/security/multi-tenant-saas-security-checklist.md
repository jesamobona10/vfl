# Multi-Tenant SaaS Security & Performance Checklist
### Football Management System — Implementation Guide

**How to use this:** work top to bottom within each section. Every item is tagged by priority — treat 🔴 as launch-blocking, 🟡 as "before you have real tenants relying on you," and 🟢 as scale-driven or genuinely optional. Notes under an item explain the *why*, especially where multi-tenancy or the football domain creates a constraint a generic SaaS checklist wouldn't surface. Compliance items are engineering considerations, not legal advice — get counsel for jurisdiction-specific requirements.

**Priority legend:** 🔴 Non-negotiable &nbsp;·&nbsp; 🟡 Strongly recommended &nbsp;·&nbsp; 🟢 Nice-to-have / Phase 2

---

## 1. Data Isolation & Multi-Tenancy

### Tenant boundary design
- [ ] 🔴 Every tenant-owned table has an explicit `organization_id` (or equivalent) column — never infer tenant ownership through a join chain alone.
- [ ] 🔴 Decide and document your isolation model explicitly: shared schema + row-level filtering (most common, cheapest to scale), schema-per-tenant, or database-per-tenant. Don't let this be an implicit accident of how the first table happened to get built.
- [ ] 🔴 **Domain-specific:** decide *deliberately* how inter-tenant fixtures work. Football is one of the few SaaS domains where two different tenants' data legitimately needs to interact — Team A (Org 1) plays Team B (Org 2). This is exactly the scenario that tempts teams into a blanket "make it publicly readable" shortcut, which then quietly exposes *all* of both orgs' data, not just the shared fixture. Model cross-org fixtures as an explicit, narrow-scoped sharing relationship (e.g. a join table or a policy that only exposes the two teams/players involved in that fixture), never a table-wide public policy.

### Enforcement — defense in depth, not defense in one place
- [ ] 🔴 Enforce the tenant boundary at **both** the application layer (every query filtered by the caller's org) **and** the database layer (Row Level Security or equivalent). Never rely on app-layer filtering alone — a single missed `.eq('organization_id', ...)` in one endpoint, or a raw query run outside the app entirely, becomes a full cross-tenant leak if the database has no independent enforcement.
- [ ] 🔴 If using Postgres RLS: audit for **overlapping policies** every time you add a new one. RLS policies are OR'd together per table/command — a new, correctly-scoped policy does *not* revoke an older, looser one on the same table. A common real-world failure mode: an early-stage single-tenant app has a permissive "authenticated users can read all X" policy; multi-tenancy gets added later with a properly org-scoped policy sitting *next to* the old one instead of replacing it, and the old one silently wins for anyone it still matches. Make "grep for every existing policy on this table before adding a new one" a standing step, not a one-time audit.
- [ ] 🔴 Any endpoint using a privileged/service-role database client (bypasses RLS by design — needed for admin operations like provisioning accounts) must perform its own explicit tenant-scoping in code. Treat every service-role usage as a place where the database provides *zero* protection — the route's own logic is the only safety net.
- [ ] 🟡 Write an automated test (or at minimum a scripted manual check) that authenticates as Tenant A and asserts every list/read endpoint returns zero rows belonging to Tenant B. Run it after every schema or policy change, not just at launch.
- [ ] 🟡 For any unauthenticated/public endpoint (e.g. a public live-scores or public-roster view), build it as a narrow, purpose-built API response using a curated query — never expose it as unrestricted table-level access, even for "public" data, since a public endpoint's intended scope (today's matches) tends to drift from what a raw public policy actually grants (every match, ever).

### Query filtering hygiene
- [ ] 🔴 Centralize tenant-scoped queries behind a shared data-access layer or query-builder helper so `organization_id` filtering isn't hand-repeated (and occasionally forgotten) in every route.
- [ ] 🟡 Add a lint rule, code-review checklist item, or automated test that flags any new query against a tenant-owned table with no visible tenant filter.
- [ ] 🟢 Consider a Postgres session variable (`SET app.current_org_id`) set per-request, so RLS policies can reference it directly rather than every policy re-deriving org membership via a join — reduces both policy complexity and query cost at scale.

---

## 2. Authentication & Authorization

### Identity & login flows
- [ ] 🔴 Support the reality of a multi-role hierarchy explicitly: platform-level admin, tenant (organization) admin, team/coach-level accounts, and player-level accounts each need distinct provisioning flows — don't force them through one generic "sign up" form.
- [ ] 🔴 **Domain-specific:** many players in youth football are minors. Player accounts are typically provisioned *for* them by a coach/org admin, not self-registered — design the credential-issuance flow (system-generated username + temporary password, forced change on first login) rather than assuming an email-based self-service flow for every role.
- [ ] 🔴 Enforce a real password policy at every account-creation path (minimum length, complexity) — and enforce it identically whether the account is self-registered or bulk-provisioned by an admin, since bulk-provisioning code paths are an easy place for this check to get skipped.
- [ ] 🟡 SSO/OAuth for organization-admin and platform-admin tiers (Google Workspace / Microsoft Entra are common for schools and clubs) — reduces credential-reuse risk for the roles with the most privilege. Player/team accounts, given the provisioning model above, are lower priority for SSO.
- [ ] 🟢 Passwordless/magic-link login as an option for organization admins — phase 2, not launch-blocking.

### Role-based access control
- [ ] 🔴 Model roles as **resolved from data, not trusted from the client** — never accept a role claim from a request body or an unsigned token field. Resolve role server-side from the authenticated identity every time.
- [ ] 🔴 Build a small set of reusable permission-check primitives (e.g. `requirePlatformAdmin`, `requireOrgAdmin(orgId)`, `requireOrgMember(orgId)`, `ownsResource(resourceId)`) and require every protected route to use one — don't let permission logic get reinvented ad hoc per endpoint. Consistency here is what makes audits tractable later.
- [ ] 🔴 Distinguish "can read within my tenant" from "can write within my tenant" from "can manage my tenant's membership/ownership" as three separate permission tiers, not one collapsed "admin" flag — a coach who can edit their roster shouldn't automatically be able to remove another admin or delete the organization.
- [ ] 🟡 Write down, in one table, every role × every resource × every CRUD verb. If you can't produce this table, you don't actually know your authorization model — you're inferring it from scattered route code.
- [ ] 🟡 Restrict the lowest-privilege role (players) to an explicit **allowlist** of pages/endpoints rather than a denylist — allowlists fail closed when someone forgets to update them; denylists fail open.

### Session & token management
- [ ] 🔴 Set short-lived access tokens with refresh-token rotation; never issue a long-lived token that, if leaked, grants indefinite access.
- [ ] 🔴 If your auth layer is enforced primarily in a framework-level middleware/gateway, confirm every protected route *also* checks authorization independently in its own handler. Middleware-only enforcement has a specific, well-documented failure mode: a crafted request header or framework-level bug that causes middleware to be skipped leaves routes with no fallback check completely open. This has happened as a real, disclosed vulnerability class in mainstream web frameworks — don't architect as if middleware is an unbypassable choke point.
- [ ] 🟡 If you plan to ship a mobile client, note now that mobile traffic typically bypasses browser-based session middleware entirely (no shared cookie jar) and authenticates via bearer tokens directly against your API. Every route's authorization needs to already be self-sufficient before mobile ships — don't treat this as a mobile-specific concern to solve later, treat it as validation that your API-layer auth was never actually optional.
- [ ] 🟡 Rate-limit login attempts per account and per IP, with stricter limits on auth endpoints than general API traffic.
- [ ] 🟢 Device/session management UI (view and revoke active sessions) — phase 2.

### API token management (for integrations, not user sessions)
- [ ] 🟡 If you offer API tokens for third-party integrations (e.g. a club's own website pulling live standings), scope tokens to a single tenant and a defined set of read/write permissions — never issue a token with implicit platform-wide access.
- [ ] 🟡 Store only a hash of API tokens server-side (same principle as passwords); show the raw token once at creation.
- [ ] 🟢 Per-token usage analytics and expiry policies — phase 2.

---

## 3. API Security

- [ ] 🔴 Validate and type-check every input server-side, regardless of client-side validation — treat client validation as UX, not security.
- [ ] 🔴 Rate-limit every state-changing endpoint (POST/PUT/PATCH/DELETE), not just authentication endpoints. Bulk-operation endpoints (roster CSV import, bulk credential generation) deserve tighter limits given their blast radius per call.
- [ ] 🔴 If running more than one application instance (horizontal scaling, auto-scaling containers), **do not rely on in-memory rate limiting** — an in-memory counter is per-process, so a limit of "20 requests/hour" silently becomes "20 × N instances/hour" the moment you scale past one instance, and resets on every deploy/restart. Move to a shared store (Redis, or your platform's equivalent) before horizontal scaling is live, not after you notice the limiter isn't working.
- [ ] 🔴 CORS: allow-list your own known front-end origins explicitly; never reflect `Access-Control-Allow-Origin` from the request or use a wildcard on any endpoint that reads authenticated/tenant data.
- [ ] 🔴 Set a real Content-Security-Policy — and verify it actually restricts inline scripts. A CSP with `unsafe-inline`/`unsafe-eval` in `script-src` provides close to zero XSS mitigation regardless of how complete the rest of the header looks; if you need inline scripts (e.g. a small bootstrap snippet), use a per-request nonce rather than blanket-allowing inline execution.
- [ ] 🟡 Version your API (`/api/v1/...` or a header-based scheme) before you have external integration consumers — retrofitting versioning after tenants depend on undocumented current behavior is expensive.
- [ ] 🟡 Enforce HTTPS/TLS everywhere, including internal service-to-service calls if applicable; redirect HTTP to HTTPS at the edge.
- [ ] 🟡 Return generic error messages to clients; log full error detail server-side only. A stack trace or raw database error returned to the client is both an information leak and, occasionally, a direct confirmation of a successful injection probe.
- [ ] 🟢 Request/response payload encryption beyond TLS (field-level encryption for especially sensitive fields) — usually phase 2 unless a specific compliance requirement demands it.

---

## 4. Database Security

- [ ] 🔴 Encrypt data at rest (most managed database providers do this by default — confirm it's actually enabled, don't assume).
- [ ] 🔴 Enforce TLS for all database connections, including from your application servers.
- [ ] 🔴 Use parameterized queries / a query builder exclusively — no string-concatenated SQL, anywhere, including in ad hoc admin scripts or migration seed data.
- [ ] 🔴 Secrets (database credentials, service-role/privileged keys, third-party API keys) live in environment variables or a secrets manager — never committed to the repository, including in `.env` files, example configs with real values, or CI logs.
- [ ] 🔴 Distinguish clearly, in code and in documentation, between your **anonymous/public** database key (safe to ship in client bundles) and your **privileged/service-role** key (bypasses row-level security — server-only, never in any client-reachable code path). Mixing these up is a one-line mistake with a total-data-exposure blast radius.
- [ ] 🟡 Rotate database credentials and service-role keys on a defined schedule, and immediately on suspected compromise or offboarding of anyone who had access.
- [ ] 🟡 Encrypt backups, and store them with access controls at least as strict as the primary database — a backup is a full copy of every tenant's data.
- [ ] 🟡 Test backup restoration on a schedule, not just backup creation. An untested backup is a hope, not a recovery plan.
- [ ] 🟡 Guard bulk-import paths (roster/player CSV upload is a near-universal feature in this domain) against injection at two layers: SQL injection (parameterized queries cover this) **and** formula/CSV injection — sanitize any field that could be re-exported later, since a player or team name is attacker-influenceable input the moment self-registration or admin-entered free text exists, and a cell value starting with `=`, `+`, `-`, or `@` becomes a live formula the instant someone opens an exported report in a spreadsheet program.
- [ ] 🟢 Row-level encryption for especially sensitive fields (e.g. medical/injury notes, if the product stores them) beyond standard at-rest encryption — phase 2, driven by specific compliance need.

---

## 5. Infrastructure & Deployment

- [ ] 🔴 Keep framework and core dependency versions current, with particular attention to the framework layer that enforces your auth/tenant boundaries (middleware, routing). A vulnerability in that specific layer has outsized impact in a multi-tenant system, since it's often the single choke point every tenant's request flows through. Track CVEs for your framework as a recurring task, not a one-time check.
- [ ] 🔴 Principle of least privilege on every service account and deployment credential — CI/CD pipelines, container registries, and cloud provider roles should each have the minimum access needed, not broad admin credentials reused everywhere for convenience.
- [ ] 🔴 Network-level restriction on database access — the database should not be reachable from the public internet; only your application tier (and specific admin tooling, via VPN/bastion) should have a path to it.
- [ ] 🟡 Container hardening if using containers: non-root user, minimal base image, no build tools/dev dependencies in the final production image, no secrets baked into image layers.
- [ ] 🟡 Automate secret rotation where your provider supports it; at minimum, document a manual rotation runbook and rehearse it once.
- [ ] 🟡 Design the application tier to be stateless (no in-process session storage, no in-memory data that a second instance wouldn't have) so horizontal scaling is a capacity decision, not an architecture change, when you need it.
- [ ] 🟡 Health checks and readiness probes configured so an auto-scaling platform doesn't route traffic to an instance that isn't actually ready.
- [ ] 🟢 Web Application Firewall (WAF) in front of the API — genuinely useful, but a layer to add once you have traffic patterns to tune it against rather than at day one.
- [ ] 🟢 Infrastructure-as-code for full environment reproducibility — high value, but reasonable to defer until post-launch if it's slowing initial delivery.

---

## 6. Data Privacy & Compliance

- [ ] 🔴 Inventory what PII you actually store, per role: for players this commonly includes name, date of birth, contact info, and possibly medical/injury notes (a sensitive category in most privacy frameworks) — know exactly where each field lives before you need to answer a data-subject access request under time pressure.
- [ ] 🔴 **Domain-specific:** if you have players under the age of consent in your operating jurisdictions, this is not an edge case — it's likely your median user in youth leagues. Build consent/guardian-notification flows and data-minimization practices for minors as a first-class requirement, not an add-on. Requirements differ meaningfully by jurisdiction (GDPR's provisions on children's data, COPPA in the US, and others) — treat this as a legal-review item, not something to infer from a checklist.
- [ ] 🔴 Audit logging for every access to, and modification of, sensitive data — who viewed a player's profile, who exported a roster, who changed a permission. This is both a security control and frequently a compliance requirement.
- [ ] 🔴 Scope audit-log visibility itself by tenant — an organization admin should be able to see their own org's audit trail (accountability for their own team), but never another tenant's, and platform-wide audit visibility stays restricted to platform admins.
- [ ] 🟡 Build a real data-deletion workflow, not just a `DELETE FROM` query someone runs manually — deletion needs to cascade correctly, respect anything with retention requirements (e.g. financial/audit records that may need to persist even after a user requests deletion of their profile), and be triggerable via a documented process for data-subject requests.
- [ ] 🟡 Prefer soft-delete/archive over hard-delete for records with historical significance once real match data exists against them (a team or competition with recorded results shouldn't just vanish and break every other team's historical stats) — but make sure your deletion-workflow item above still provides a real hard-delete path where privacy law requires one. These two needs coexist; don't let "we soft-delete everything" become an excuse for never fulfilling an actual erasure request.
- [ ] 🟡 Data residency: if you operate across regions with data-residency requirements, decide and document where each tenant's data physically lives — this is much cheaper to design correctly at the schema/infrastructure level up front than to retrofit per-tenant.
- [ ] 🟢 Configurable per-tenant data-retention policies (auto-purge inactive player data after N years) — phase 2, valuable but not launch-blocking for most.

---

## 7. Performance Under Load

- [ ] 🔴 Index `organization_id` (or your tenant key) as the leading column on every composite index for tenant-owned tables — nearly every query in a multi-tenant system filters by tenant first, and an unindexed or poorly-ordered index here is the most common source of "the app was fine in testing, then fell over with real tenant volume."
- [ ] 🔴 Use connection pooling (e.g. PgBouncer or your provider's built-in pooler) rather than letting each request/serverless-function invocation open a raw database connection — this is especially critical in serverless/edge deployments, where connection counts can spike far faster than a traditional long-running server would produce.
- [ ] 🔴 **Domain-specific:** design for football's genuinely spiky load pattern, which doesn't look like typical steady B2B SaaS traffic — weekend match days produce concentrated bursts (live score checks, notification fan-out) across many tenants simultaneously, not an evenly distributed load. Load-test against a "Saturday afternoon, every org's matches kicking off at once" scenario specifically, not just average daily traffic.
- [ ] 🟡 Cache read-heavy, publicly-consumed data aggressively — standings and live scores are exactly this shape (computed from match results, read far more often than they change) — with explicit invalidation on the events that actually change them (a match result being recorded), not a blind time-based expiry that either serves stale scores or invalidates too often to help.
- [ ] 🟡 Paginate every list endpoint that could return an unbounded set (all players in a large multi-team organization, all historical fixtures across seasons) — don't let "org with 40 teams and 5 seasons of history" be the first time someone discovers an endpoint has no pagination.
- [ ] 🟡 Avoid N+1 query patterns in anything that joins across the natural hierarchy here (organization → teams → players → stats) — a single query with proper joins/embedding beats N sequential lookups every time this pattern shows up, and it shows up constantly in this domain's data shape.
- [ ] 🟡 Load-test with realistic **multi-tenant** concurrency, not single-tenant concurrency — verify that one tenant's heavy usage (e.g. an org bulk-importing a 40-team league at once) doesn't degrade response times for every other tenant sharing the same database and app instances. This is the scenario a single-tenant load test structurally cannot catch.
- [ ] 🟢 Read replicas for reporting/analytics queries, separated from the primary transactional path — phase 2, driven by actual measured contention rather than anticipated need.
- [ ] 🟢 Per-tenant rate/usage tiers tied to a pricing plan (not just flat rate limiting) — phase 2, a product decision as much as a technical one.

---

## 8. Incident Response & Monitoring

- [ ] 🔴 Centralized, structured logging for authentication events, authorization failures, and any privileged/service-role database access — these are the three signal types you'll need first in an actual investigation, and they're the hardest to reconstruct after the fact if you didn't log them going in.
- [ ] 🔴 Alert on anomalous cross-tenant access patterns specifically — e.g. a single credential suddenly querying data scoped to organizations it has no membership in is a strong signal of either a bug or an active exploit, and multi-tenant systems are exactly where this class of alert earns its keep.
- [ ] 🔴 Have a written incident response plan before you need one: who gets paged, what the tenant-notification process is, and what "contain, assess, notify, remediate" looks like concretely for this system. A plan written during an actual incident is a much worse plan.
- [ ] 🟡 Alert on rate-limit threshold breaches, repeated authorization failures from a single identity, and unusual bulk-export volume (a sudden large roster/player-data export is worth a second look, especially from an account that doesn't normally do that).
- [ ] 🟡 Define and rehearse a tenant-breach notification process — if Tenant A's data is exposed, you need to know quickly which specific tenants (and which specific records) were affected, not just that "a leak happened somewhere." This is only fast if your logging already captures tenant-scoped access (see the first item in this section).
- [ ] 🟡 Monitor for the specific multi-tenant failure signature described in Section 1 — a spike in successful reads against a table from sessions with no matching tenant membership is close to a direct indicator of a stale/overlapping policy problem, and is worth its own dashboard panel rather than being buried in general traffic metrics.
- [ ] 🟢 Automated security regression testing in CI (dependency vulnerability scanning, basic cross-tenant-isolation smoke tests) — high value, reasonable to phase in after initial launch if it's not already part of your pipeline.
- [ ] 🟢 A public status page / uptime history — reasonable trust-building feature, not a security control, genuinely phase 2.

---

## Quick-reference: the five items to not ship without

If you use nothing else from this document, these five are the ones where the failure mode is silent, total, and specific to multi-tenant systems:

1. Tenant boundary enforced at **both** app layer and database layer (§1)
2. A repeatable audit for **overlapping/stale RLS policies** whenever a new one is added (§1)
3. Every route's authorization is self-sufficient — never dependent solely on a middleware/gateway layer that could be bypassed or skipped (§2)
4. Shared (not in-memory) rate limiting the moment you run more than one instance (§3)
5. Cross-tenant access anomaly alerting wired up before launch, not added after the first incident (§8)
