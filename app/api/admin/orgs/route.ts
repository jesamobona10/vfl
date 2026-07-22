import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, getClientIp, json, logApiError, logSecurityEvent, parseJsonObject, rateLimit, rateLimitResponse, requireAdmin, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const sb = createServiceRoleClient();
    const { data: orgs, error } = await sb.from("organizations").select("*").order("created_at", { ascending: false });

    if (error) {
      logApiError("admin_orgs_list_error", error);
      return json({ error: "Failed to list organizations." }, { status: 500 });
    }

    const orgsWithCounts = await Promise.all(
      (orgs || []).map(async (org) => {
        const [{ count: teamCount }, { count: memberCount }, { count: compCount }] = await Promise.all([
          sb.from("teams").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
          sb.from("organization_members").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
          sb.from("competitions").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
        ]);
        return { ...org, teamCount: teamCount ?? 0, memberCount: memberCount ?? 0, competitionCount: compCount ?? 0 };
      })
    );

    return json({ orgs: orgsWithCounts });
  } catch (error) {
    logApiError("admin_orgs_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `admin:orgs:create:${ip}:${auth!.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_org_create_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = sanitizeText(parsed.data!.name as string || "");
    const type = parsed.data!.type as string;
    const slug = (parsed.data!.slug as string || "").toLowerCase().replace(/[^a-z0-9-]/g, "");

    if (!name || name.length > 100) return json({ error: "Organization name is required (max 100 chars)." }, { status: 400 });
    if (!["school", "academy", "club"].includes(type)) return json({ error: "Type must be school, academy, or club." }, { status: 400 });
    if (!slug || slug.length < 2 || slug.length > 60) return json({ error: "Slug is required (2-60 chars, lowercase alphanumeric with hyphens)." }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: existing } = await sb.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (existing) return json({ error: "An organization with this slug already exists." }, { status: 409 });

    const { data, error } = await sb.from("organizations").insert({ name, type, slug }).select().single();

    if (error) {
      logApiError("admin_org_create_error", error);
      return json({ error: "Failed to create organization." }, { status: 500 });
    }

    await sb.from("organization_members").insert({
      organization_id: data.id,
      user_id: auth!.userId,
      role: "owner",
    });

    return json({ org: data });
  } catch (error) {
    logApiError("admin_org_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
