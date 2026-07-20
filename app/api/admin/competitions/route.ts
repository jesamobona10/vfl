import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, parseJsonObject, requireAdmin, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id");

    const sb = createServiceRoleClient();
    let query = sb.from("competitions").select("*, organizations(name, slug)").order("created_at", { ascending: false });
    if (orgId) query = query.eq("organization_id", orgId);

    const { data: competitions, error } = await query;

    if (error) {
      logApiError("admin_competitions_list_error", error);
      return json({ error: "Failed to list competitions." }, { status: 500 });
    }

    const compsWithCounts = await Promise.all(
      (competitions || []).map(async (c) => {
        const [{ count: fixtureCount }, { count: cupMatchCount }] = await Promise.all([
          sb.from("fixtures").select("*", { count: "exact", head: true }).eq("competition_id", c.id),
          sb.from("cup_matches").select("*", { count: "exact", head: true }).eq("competition_id", c.id),
        ]);
        return { ...c, fixtureCount: fixtureCount ?? 0, cupMatchCount: cupMatchCount ?? 0 };
      })
    );

    return json({ competitions: compsWithCounts });
  } catch (error) {
    logApiError("admin_competitions_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = sanitizeText(parsed.data!.name as string || "");
    const organization_id = parsed.data!.organization_id as string;
    const type = parsed.data!.type as string;
    const season = parsed.data!.season as string || null;

    if (!name || name.length > 100) return json({ error: "Competition name is required (max 100 chars)." }, { status: 400 });
    if (!organization_id) return json({ error: "Organization ID is required." }, { status: 400 });
    if (!["league", "cup", "friendly"].includes(type)) return json({ error: "Type must be league, cup, or friendly." }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: org } = await sb.from("organizations").select("id").eq("id", organization_id).maybeSingle();
    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const { data, error } = await sb.from("competitions").insert({ name, organization_id, type, season, status: "draft", created_by: auth!.userId }).select().single();

    if (error) {
      logApiError("admin_competition_create_error", error);
      return json({ error: "Failed to create competition." }, { status: 500 });
    }

    return json({ competition: data });
  } catch (error) {
    logApiError("admin_competition_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
