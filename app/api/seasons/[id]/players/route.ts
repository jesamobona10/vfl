import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireOrgMember } from "@/lib/security";
import { resolveSeasonOrganization } from "@/lib/season-org";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { season, organizationId } = await resolveSeasonOrganization(sb, params.id);

    if (!season) return json({ error: "Season not found." }, { status: 404 });

    const memberError = requireOrgMember(auth, organizationId as string);
    if (memberError) return memberError;

    // Fetch season team ids first (supabase-js doesn't support subquery IN)
    const { data: seasonTeams } = await sb
      .from("season_teams")
      .select("id")
      .eq("season_id", params.id);
    const seasonTeamIds = (seasonTeams || []).map((st: any) => st.id);

    let registrations: any[] = [];
    if (seasonTeamIds.length > 0) {
      const { data, error } = await sb
        .from("season_team_players")
        .select(
          "*, player:player_id(id, name, position, jersey_number, photo_url), season_team:season_team_id(team_id, display_name, team:team_id(id, name, logo_url))"
        )
        .in("season_team_id", seasonTeamIds)
        .order("created_at", { ascending: true });

      if (error) {
        logApiError("season_players_error", error);
        return json({ error: "Failed to fetch season players." }, { status: 500 });
      }
      registrations = data || [];
    }

    return json({ players: registrations });
  } catch (error) {
    logApiError("season_players_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
