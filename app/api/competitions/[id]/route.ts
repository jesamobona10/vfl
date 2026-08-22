import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  requireOrgMember,
  writeAuditEvent,
} from "@/lib/security";

const ALLOWED_UPDATE_FIELDS = ["name", "type", "status", "settings", "current_season_id"] as const;

const MAX_SETTINGS_BYTES = 8192;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function containsDangerousKey(value: unknown, depth = 0): boolean {
  if (depth > 10) return true;
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => containsDangerousKey(v, depth + 1));
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) return true;
    if (containsDangerousKey(v, depth + 1)) return true;
  }
  return false;
}

/**
 * Validate the free-form competition `settings` JSONB: must be a small plain
 * object without prototype-pollution keys. Unknown keys are preserved (the
 * schema is UI-owned) but dangerous keys are rejected outright.
 */
function validateSettings(value: unknown): { data?: Record<string, unknown>; error?: string } {
  if (value === null) return { data: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: "settings must be a JSON object." };
  }
  if (containsDangerousKey(value)) {
    return { error: "settings contains a forbidden key." };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { error: "settings is not JSON-serializable." };
  }
  if (!serialized || serialized.length > MAX_SETTINGS_BYTES) {
    return { error: "settings is too large." };
  }
  return { data: value as Record<string, unknown> };
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const { data: competition, error } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const memberError = requireOrgMember(auth, competition.organization_id);
    if (memberError) {
      logSecurityEvent("competition_get_forbidden", {
        userId: auth.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
      });
      return memberError;
    }

    return json({ competition });
  } catch (error) {
    logApiError("competition_get_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();

    const { data: competition, error } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, competition.organization_id);
    if (adminError) {
      logSecurityEvent("competition_update_forbidden", {
        userId: auth.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
        isAdmin: auth.isAdmin,
      });
      return adminError;
    }

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `competitions:update:${ip}:${auth.userId}`,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("competition_update_rate_limited", { ip, userId: auth.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const update: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (parsed.data![field] !== undefined) {
        const value = parsed.data![field];
        if (field === "type" && !["league", "cup", "friendly"].includes(value as string)) {
          return json({ error: "type must be league, cup, or friendly." }, { status: 400 });
        }
        if (
          field === "status" &&
          !["draft", "active", "completed", "archived"].includes(value as string)
        ) {
          return json(
            { error: "status must be draft, active, completed, or archived." },
            { status: 400 }
          );
        }
        if (field === "current_season_id") {
          if (value !== null && typeof value !== "string") {
            return json(
              { error: "current_season_id must be a season id or null." },
              { status: 400 }
            );
          }
          // Ownership check: the season must belong to THIS competition —
          // otherwise an org admin could point their competition at another
          // org's season via the service-role client.
          if (value) {
            const { data: season } = await sb
              .from("seasons")
              .select("id")
              .eq("id", value)
              .eq("competition_id", params.id)
              .maybeSingle();
            if (!season) {
              return json(
                { error: "Season does not belong to this competition." },
                { status: 400 }
              );
            }
          }
          update.current_season_id = value || null;
        } else if (field === "settings") {
          const check = validateSettings(value);
          if (check.error) return json({ error: check.error }, { status: 400 });
          update.settings = check.data;
        } else {
          update[field] = value;
        }
      }
    }

    if (Object.keys(update).length === 0) {
      return json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await sb
      .from("competitions")
      .update(update)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      logApiError("competition_update_error", updateError, {
        userId: auth.userId,
        competitionId: params.id,
      });
      return json({ error: "Failed to update competition." }, { status: 500 });
    }

    logSecurityEvent("competition_updated", {
      ip: getClientIp(request),
      userId: auth.userId,
      orgId: competition.organization_id,
      competitionId: params.id,
    });

    return json({ competition: updated });
  } catch (error) {
    logApiError("competition_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const { data: competition, error } = await sb
      .from("competitions")
      .select("id, name, organization_id")
      .eq("id", params.id)
      .single();

    if (error || !competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, competition.organization_id);
    if (adminError) {
      logSecurityEvent("competition_delete_forbidden", {
        userId: auth.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
        isAdmin: auth.isAdmin,
      });
      return adminError;
    }

    const ip = getClientIp(_request);
    const limited = await rateLimit({
      key: `competitions:delete:${ip}:${auth.userId}`,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("competition_delete_rate_limited", { ip, userId: auth.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const { error: deleteError } = await sb.from("competitions").delete().eq("id", params.id);

    if (deleteError) {
      logApiError("competition_delete_error", deleteError, {
        userId: auth.userId,
        competitionId: params.id,
      });
      return json({ error: "Failed to delete competition." }, { status: 500 });
    }

    logSecurityEvent("competition_deleted", {
      ip,
      userId: auth.userId,
      orgId: competition.organization_id,
      competitionId: params.id,
      name: competition.name,
    });
    writeAuditEvent("competition_deleted", auth.userId, competition.organization_id, {
      ip,
      competitionId: params.id,
      name: competition.name,
    });

    return json({ success: true });
  } catch (error) {
    logApiError("competition_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
