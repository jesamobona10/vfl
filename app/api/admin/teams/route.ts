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
    let query = sb.from("teams").select("*, organizations(name, slug)").order("id");
    if (orgId) query = query.eq("organization_id", orgId);

    const { data: teams, error } = await query;

    if (error) {
      logApiError("admin_teams_list_error", error);
      return json({ error: "Failed to list teams." }, { status: 500 });
    }

    const teamsWithCounts = await Promise.all(
      (teams || []).map(async (t) => {
        const { count } = await sb.from("players").select("*", { count: "exact", head: true }).eq("team_id", t.id);
        return { ...t, playerCount: count ?? 0 };
      })
    );

    return json({ teams: teamsWithCounts });
  } catch (error) {
    logApiError("admin_teams_list_error", error);
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
    const rating = typeof parsed.data!.rating === "number" ? parsed.data!.rating : 6.0;

    if (!name || name.length > 80) return json({ error: "Team name is required (max 80 chars)." }, { status: 400 });
    if (!organization_id) return json({ error: "Organization ID is required." }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: org } = await sb.from("organizations").select("id").eq("id", organization_id).maybeSingle();
    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const { data, error } = await sb.from("teams").insert({ name, organization_id, rating }).select().single();

    if (error) {
      logApiError("admin_team_create_error", error);
      if (error.code === "23505") return json({ error: "A team with this name already exists." }, { status: 409 });
      return json({ error: "Failed to create team." }, { status: 500 });
    }

    return json({ team: data });
  } catch (error) {
    logApiError("admin_team_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
