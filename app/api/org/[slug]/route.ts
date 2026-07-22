import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asOptionalString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();
    const { data: org, error } = await sb
      .from("organizations")
      .select("*")
      .eq("slug", params.slug)
      .single();

    if (error || !org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    return json({ org });
  } catch (error) {
    logApiError("org_get_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: org, error: orgError } = await sb
      .from("organizations")
      .select("*")
      .eq("slug", params.slug)
      .single();

    if (orgError || !org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) {
      logSecurityEvent("org_update_forbidden", {
        userId: auth!.userId,
        orgId: org.id,
        slug: params.slug,
      });
      return adminError;
    }

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `org:update:${ip}:${auth!.userId}`, limit: 30, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("org_update_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const update: Record<string, unknown> = {};
    const name = asOptionalString(parsed.data!.name, 100);
    const logo_url = asOptionalString(parsed.data!.logo_url, 500);
    const settings = parsed.data!.settings;

    if (name) update.name = name;
    if (logo_url !== null) update.logo_url = logo_url;
    if (settings !== undefined && typeof settings === "object" && !Array.isArray(settings)) {
      update.settings = settings;
    }

    if (Object.keys(update).length === 0) {
      return json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await sb
      .from("organizations")
      .update(update)
      .eq("id", org.id)
      .select()
      .single();

    if (updateError) {
      logApiError("org_update_error", updateError, { userId: auth!.userId, orgId: org.id });
      return json({ error: "Failed to update organization." }, { status: 500 });
    }

    return json({ org: updated });
  } catch (error) {
    logApiError("org_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
