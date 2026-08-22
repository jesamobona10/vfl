/**
 * Central security module for authentication, authorization, rate limiting,
 * input validation, and audit logging.
 *
 * Provides reusable guard functions for API route handlers, a secure JSON
 * response wrapper with security headers, and structured audit recording.
 *
 * @module security
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  /** Unique key identifying the rate limit bucket (e.g. `api:ip:path`). */
  key: string;
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Time window in milliseconds. */
  windowMs: number;
};

/** In-memory rate limit store. Resets on server restart. Single-instance only. */
const rateLimitStore = new Map<string, RateLimitEntry>();

type RateLimitResult = {
  limited: boolean;
  remaining: number;
  resetAt: number;
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Fixed-window counter in Upstash Redis via its REST API (plain fetch — no
 * SDK dependency). Shared across instances so limits survive restarts and
 * apply fleet-wide. Returns null when unconfigured or on any error so the
 * caller can fall back to the in-memory store (fail open per instance).
 */
async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const redisKey = `ratelimit:${key}`;
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const res = await fetch(`${UPSTASH_URL.replace(/\/+$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSeconds), "NX"],
        ["TTL", redisKey],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ result?: unknown }>;
    const count = results?.[0]?.result;
    if (typeof count !== "number") return null;
    const ttl =
      typeof results?.[2]?.result === "number" && results[2].result > 0
        ? results[2].result
        : windowSeconds;
    return {
      limited: count > limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + ttl * 1000,
    };
  } catch {
    return null;
  }
}

/** An organization membership record resolved from the session. */
export type OrgMembership = {
  organization_id: string;
  role: string;
  /** Organization URL slug (resolved from the organizations table join). */
  slug?: string;
};

/** Resolved authentication context for the current request. */
export type AuthContext = {
  userId: string;
  isAdmin: boolean;
  teamAccount: { id: string; team_id: number | null; username?: string | null } | null;
  orgMembership: OrgMembership | null;
};

/**
 * Extract the client IP address from a request, checking standard
 * proxy headers (`x-forwarded-for`, `x-real-ip`).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Check and update the rate limit counter for a given key.
 *
 * When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set the
 * counter lives in Redis and is shared across all app instances. Otherwise
 * (or if Redis errors) an in-memory store is used — accurate only for a
 * single instance.
 */
export async function rateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const shared = await upstashRateLimit(key, limit, windowMs);
  if (shared) return shared;

  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return {
    limited: current.count > limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

/** Generate a 429 Too Many Requests response with a `Retry-After` header. */
export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

/**
 * Create a JSON response with standard security headers applied
 * (nosniff, DENY frame, strict referrer, no-store cache).
 */
export function json(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Write a simple audit event to `auth_audit_logs`. Fire-and-forget: never throws.
 */
export async function writeAuditEvent(
  event_type: string,
  userId: string,
  organization_id?: string,
  metadata?: Record<string, unknown>
) {
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
    const sb = createServiceRoleClient();
    await sb.from("auth_audit_logs").insert({
      user_id: userId,
      event_type,
      organization_id: organization_id || null,
      ip_address: (metadata?.ip as string) || null,
      user_agent: (metadata?.user_agent as string) || null,
      metadata: metadata || {},
    });
  } catch {
    // Audit write failures are non-critical; don't throw
  }
}

export interface AuditRecordInput {
  organizationId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | number | null;
  description?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  success?: boolean;
  category?: string;
  severity?: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Write a structured audit record. Central entry point for all
 * important administrative / security-sensitive actions. Never throw:
 * business operations must not fail because auditing failed.
 */
export async function writeAuditRecord(input: AuditRecordInput) {
  try {
    const [{ createServiceRoleClient }, { categoryFor, severityFor }, { sanitizeAuditData }] =
      await Promise.all([
        import("@/lib/supabase/service-role"),
        import("@/lib/audit/actions"),
        import("@/lib/audit/sanitize"),
      ]);
    const sb = createServiceRoleClient();
    await sb.from("auth_audit_logs").insert({
      user_id: input.actorId || null,
      organization_id: input.organizationId || null,
      actor_role: input.actorRole || null,
      action: input.action,
      event_type: input.action,
      resource_type: input.resourceType || null,
      resource_id: input.resourceId != null ? String(input.resourceId) : null,
      description: input.description || null,
      before: sanitizeAuditData(input.before) ?? null,
      after: sanitizeAuditData(input.after) ?? null,
      metadata: input.metadata || {},
      success: input.success ?? true,
      category: input.category || categoryFor(input.action),
      severity: input.severity || severityFor(input.action),
      ip_address: input.ip || null,
      user_agent: input.userAgent || null,
    });
  } catch {
    // Audit write failures are non-critical; don't throw
  }
}

/**
 * Log a security-related event to console and persist to audit logs (fire-and-forget).
 */
export function logSecurityEvent(event: string, details: Record<string, unknown> = {}) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event,
      at: new Date().toISOString(),
      ...details,
    })
  );

  // Persist to auth_audit_logs (fire-and-forget — never block on audit)
  const userId = details.userId || details.forgottenUserId;
  if (typeof userId === "string") {
    const orgId = (details.orgId || details.organization_id) as string | undefined;
    void writeAuditEvent(event, userId, orgId, details).catch(() => {
      /* swallow */
    });
  }
}

/** Log an API error to console in structured JSON format. */
export function logApiError(event: string, error: unknown, details: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      ...details,
    })
  );
}

/** Safely parse the request body as a JSON object. Returns `{ data, error }`. */
export async function parseJsonObject(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { data: null, error: "Request body must be a JSON object." };
    }
    return { data: body as Record<string, unknown>, error: null };
  } catch {
    return { data: null, error: "Invalid JSON body." };
  }
}

/** Validate and trim a string value, returning null if invalid or too long. */
export function asString(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

/** Validate an optional string. Returns null for null/undefined/empty. */
export function asOptionalString(value: unknown, maxLength = 255): string | null {
  if (value == null || value === "") return null;
  return asString(value, maxLength);
}

/** Validate and parse an integer, optionally within a range. */
export function asInteger(value: unknown, min?: number, max?: number): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(num)) return null;
  if (min != null && num < min) return null;
  if (max != null && num > max) return null;
  return num;
}

/** Validate a boolean value. Returns null for non-boolean inputs. */
export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Validate email format and length (max 254 chars). */
export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Validate password strength (min 12, max 128, mixed case + digits).
 * Returns null if valid, or an error message.
 */
export function validatePassword(password: unknown) {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, and numeric characters.";
  }
  return null;
}

/** Sanitize text by removing control characters and HTML-adjacent chars. */
export function sanitizeText(value: string) {
  return value.replace(/[\u0000-\u001F\u007F<>]/g, "").trim();
}

/**
 * Resolve the full auth context for the current session.
 * Queries admin_users, team_accounts, and organization_members in parallel.
 */
export async function getAuthContext(supabase: SupabaseClient): Promise<AuthContext | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return null;

  const [{ data: adminUser }, { data: teamAccount }, { data: orgMember }] = await Promise.all([
    supabase.from("admin_users").select("id").eq("id", session.user.id).maybeSingle(),
    supabase
      .from("team_accounts")
      .select("id, team_id, username")
      .eq("id", session.user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, role, organizations(slug)")
      .eq("user_id", session.user.id)
      .maybeSingle(),
  ]);

  let orgMembership: OrgMembership | null = null;
  if (orgMember) {
    const orgs = orgMember.organizations as unknown as { slug: string } | null;
    orgMembership = {
      organization_id: orgMember.organization_id,
      role: orgMember.role,
      slug: orgs?.slug,
    };
  }

  return {
    userId: session.user.id,
    isAdmin: Boolean(adminUser),
    teamAccount: teamAccount ?? null,
    orgMembership,
  };
}

/** Check whether the authenticated user owns or manages the given team. */
export function ownsTeam(auth: AuthContext, teamId: number) {
  return auth.isAdmin || auth.teamAccount?.team_id === teamId;
}

/** Get a human-readable actor role string for audit records. */
export function actorRole(auth: AuthContext | null): string {
  if (!auth) return "anonymous";
  if (auth.isAdmin) return "super_admin";
  if (auth.teamAccount) return "team_account";
  if (auth.orgMembership) return `org_${auth.orgMembership.role}`;
  return "user";
}

/** Guard: require any authenticated user. Returns 401 if not authed. */
export function requireAuth(auth: AuthContext | null) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/** Guard: require super admin role. Returns 401/403 if not authorized. */
export function requireAdmin(auth: AuthContext | null) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isAdmin) return json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Guard: require org admin (or super admin) for the given organization. */
export function requireOrgAdmin(auth: AuthContext | null, orgId: string) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isAdmin) return null;
  if (!auth.orgMembership) return json({ error: "Forbidden" }, { status: 403 });
  if (auth.orgMembership.organization_id !== orgId)
    return json({ error: "Forbidden" }, { status: 403 });
  if (!["owner", "admin"].includes(auth.orgMembership.role))
    return json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Guard: require any org member (or super admin) for the given organization. */
export function requireOrgMember(auth: AuthContext | null, orgId: string) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isAdmin) return null;
  if (!auth.orgMembership) return json({ error: "Forbidden" }, { status: 403 });
  if (auth.orgMembership.organization_id !== orgId)
    return json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Guard: require org owner (or super admin) for the given organization. */
export function requireOrgOwner(auth: AuthContext | null, orgId: string) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isAdmin) return null;
  if (!auth.orgMembership) return json({ error: "Forbidden" }, { status: 403 });
  if (auth.orgMembership.organization_id !== orgId)
    return json({ error: "Forbidden" }, { status: 403 });
  if (auth.orgMembership.role !== "owner")
    return json({ error: "Only org owners can perform this action." }, { status: 403 });
  return null;
}
