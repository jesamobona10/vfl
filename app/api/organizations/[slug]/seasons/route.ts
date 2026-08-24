import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asOptionalString,
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

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const memberError = requireOrgMember(auth, org.id);
    if (memberError) return memberError;

    const { data: seasons, error } = await sb
      .from("organization_seasons")
      .select("*")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("org_seasons_list_error", error);
      return json({ error: "Failed to fetch seasons." }, { status: 500 });
    }

    return json({ seasons: seasons || [] });
  } catch (error) {
    logApiError("org_seasons_list_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `org_season_create:${ip}`, limit: 30, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = asString(parsed.data!.name, 80);
    if (!name) {
      return json({ error: "Season name is required." }, { status: 400 });
    }

    const shortName = asOptionalString(parsed.data!.short_name, 40);
    const startDate = asOptionalString(parsed.data!.start_date, 10);
    const endDate = asOptionalString(parsed.data!.end_date, 10);

    // First season for the org becomes the current one
    const { count } = await sb
      .from("organization_seasons")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id);
    const isFirst = (count ?? 0) === 0;

    const { data: season, error } = await sb
      .from("organization_seasons")
      .insert({
        organization_id: org.id,
        name,
        short_name: shortName || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status: isFirst ? "active" : "upcoming",
        is_current: isFirst,
      })
      .select()
      .single();

    if (error) {
      logApiError("org_season_create_error", error);
      return json({ error: "Failed to create season." }, { status: 500 });
    }

    logSecurityEvent("org_season_created", {
      ip,
      userId: auth!.userId,
      orgId: org.id,
      seasonId: season.id,
      name,
    });

    return json({ season });
  } catch (error) {
    logApiError("org_season_create_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
