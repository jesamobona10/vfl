import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireOrgAdmin } from "@/lib/security";
import { resolveSeasonOrganization } from "@/lib/season-org";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { season, organizationId } = await resolveSeasonOrganization(sb, params.id);

    if (!season) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, organizationId as string);
    if (adminError) return json({ error: "Forbidden" }, { status: 403 });

    const { data: fixtures, error } = await sb
      .from("fixtures")
      .select("*, home_team:home_team_id(name, logo_url), away_team:away_team_id(name, logo_url)")
      .eq("season_id", params.id)
      .order("round")
      .order("id");

    if (error) {
      logApiError("season_fixtures_error", error);
      return json({ error: "Failed to fetch fixtures." }, { status: 500 });
    }

    return json({ fixtures: fixtures || [] });
  } catch (error) {
    logApiError("season_fixtures_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
