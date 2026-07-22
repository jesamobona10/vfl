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

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    if (!orgId) {
      return json({ error: "org_id query parameter is required." }, { status: 400 });
    }

    const memberError = requireOrgMember(auth, orgId);
    if (memberError) {
      logSecurityEvent("competitions_list_forbidden", {
        userId: auth?.userId,
        orgId,
        isAdmin: auth?.isAdmin,
      });
      return memberError;
    }
    const authed = auth!;

    const sb = createServiceRoleClient();
    const { data: competitions, error } = await sb
      .from("competitions")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("competitions_list_error", error, { userId: authed.userId, orgId });
      return json({ error: "Failed to fetch competitions." }, { status: 500 });
    }

    return json({ competitions: competitions || [] });
  } catch (error) {
    logApiError("competitions_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `competitions:create:${ip}:${auth?.userId || "anon"}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("competition_create_rate_limited", { ip, userId: auth?.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const organization_id = asString(parsed.data!.organization_id, 40);
    const name = asString(parsed.data!.name, 80);
    const type = asString(parsed.data!.type, 10);
    const season = asString(parsed.data!.season, 20);

    if (!organization_id || !name || !type) {
      return json({ error: "organization_id, name, and type are required." }, { status: 400 });
    }

    const adminError = requireOrgAdmin(auth, organization_id);
    if (adminError) {
      logSecurityEvent("competition_create_forbidden", {
        userId: auth?.userId,
        organizationId: organization_id,
        isAdmin: auth?.isAdmin,
      });
      return adminError;
    }
    const authed = auth!;

    if (!["league", "cup", "friendly"].includes(type)) {
      return json({ error: "type must be league, cup, or friendly." }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: competition, error } = await sb
      .from("competitions")
      .insert({
        organization_id,
        name,
        type,
        season: season || null,
        created_by: authed.userId,
        settings: type === "league" ? { includeCup: true } : {},
      })
      .select()
      .single();

    if (error) {
      logApiError("competition_create_error", error, { userId: authed.userId, organizationId: organization_id });
      return json({ error: "Failed to create competition." }, { status: 500 });
    }

    return json({ competition });
  } catch (error) {
    logApiError("competition_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
