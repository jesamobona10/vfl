import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export type OrgMembership = {
  organization_id: string;
  role: string;
  slug?: string;
};

export type AuthContext = {
  userId: string;
  isAdmin: boolean;
  teamAccount: { id: string; team_id: number | null; username?: string | null } | null;
  orgMembership: OrgMembership | null;
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions) {
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

export function json(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function logSecurityEvent(
  event: string,
  details: Record<string, unknown> = {}
) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event,
      at: new Date().toISOString(),
      ...details,
    })
  );
}

export function logApiError(
  event: string,
  error: unknown,
  details: Record<string, unknown> = {}
) {
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

export function asString(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function asOptionalString(value: unknown, maxLength = 255): string | null {
  if (value == null || value === "") return null;
  return asString(value, maxLength);
}

export function asInteger(value: unknown, min?: number, max?: number): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(num)) return null;
  if (min != null && num < min) return null;
  if (max != null && num > max) return null;
  return num;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function validatePassword(password: unknown) {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 128) return "Password is too long.";
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, and numeric characters.";
  }
  return null;
}

export function sanitizeText(value: string) {
  return value.replace(/[\u0000-\u001F\u007F<>]/g, "").trim();
}

export async function getAuthContext(supabase: any): Promise<AuthContext | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return null;

  const [{ data: adminUser }, { data: teamAccount }, { data: orgMember }] = await Promise.all([
    supabase.from("admin_users").select("id").eq("id", session.user.id).maybeSingle(),
    supabase.from("team_accounts").select("id, team_id, username").eq("id", session.user.id).maybeSingle(),
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

export function ownsTeam(auth: AuthContext, teamId: number) {
  return auth.isAdmin || auth.teamAccount?.team_id === teamId;
}

export function requireAuth(auth: AuthContext | null) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export function requireAdmin(auth: AuthContext | null) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isAdmin) return json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export function requireOrgAdmin(auth: AuthContext | null, orgId: string) {
  if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isAdmin) return null;
  if (!auth.orgMembership) return json({ error: "Forbidden" }, { status: 403 });
  if (auth.orgMembership.organization_id !== orgId) return json({ error: "Forbidden" }, { status: 403 });
  if (!["owner", "admin"].includes(auth.orgMembership.role)) return json({ error: "Forbidden" }, { status: 403 });
  return null;
}
