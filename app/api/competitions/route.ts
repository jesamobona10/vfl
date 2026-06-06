import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    if (!orgId) {
      return json({ error: "org_id query parameter is required." }, { status: 400 });
    }

    const sb = createServiceRoleClient();
    const { data: competitions, error } = await sb
      .from("competitions")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("competitions_list_error", error);
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
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { organization_id, name, type, season } = body;

    if (!organization_id || !name || !type) {
      return json({ error: "organization_id, name, and type are required." }, { status: 400 });
    }

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
        created_by: auth.userId,
        settings: type === "league" ? { includeCup: true } : {},
      })
      .select()
      .single();

    if (error) {
      logApiError("competition_create_error", error);
      return json({ error: "Failed to create competition." }, { status: 500 });
    }

    return json({ competition });
  } catch (error) {
    logApiError("competition_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
