import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
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
} from "@/lib/security";

const ALLOWED_UPDATE_FIELDS = ["name", "type", "season", "status", "settings"] as const;

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const limited = rateLimit({ key: `competitions:update:${ip}:${auth.userId}`, limit: 60, windowMs: 60 * 60_000 });
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
        if (field === "status" && !["draft", "active", "completed", "archived"].includes(value as string)) {
          return json({ error: "status must be draft, active, completed, or archived." }, { status: 400 });
        }
        if (field === "season") {
          update.season = asString(value as string, 20) || null;
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
      logApiError("competition_update_error", updateError, { userId: auth.userId, competitionId: params.id });
      return json({ error: "Failed to update competition." }, { status: 500 });
    }

    return json({ competition: updated });
  } catch (error) {
    logApiError("competition_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
