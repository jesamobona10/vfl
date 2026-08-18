import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireOrgMember } from "@/lib/security";
import { resolveSeasonOrganization } from "@/lib/season-org";
import { calculateStandings } from "@/lib/logic/standings";

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

    // Fetch teams for season
    const { data: seasonTeams } = await sb
      .from("season_teams")
      .select("team:team_id(id, name, logo_url, rating), display_name")
      .eq("season_id", params.id);

    const teams = (seasonTeams || []).map((st: any) => ({
      id: st.team.id,
      name: st.display_name || st.team.name,
      logo_url: st.team.logo_url,
      rating: st.team.rating || 6.0,
    }));

    // Fetch fixtures grouped by round
    const { data: fixtures } = await sb
      .from("fixtures")
      .select("*, home_team:home_team_id(id), away_team:away_team_id(id)")
      .eq("season_id", params.id)
      .order("round", { ascending: true });

    // Convert fixtures into rounds array expected by calculateStandings
    const roundsBy = new Map<number, any>();
    (fixtures || []).forEach((f: any) => {
      const r = f.round || 0;
      if (!roundsBy.has(r)) roundsBy.set(r, { round: r, matches: [] });
      roundsBy.get(r).matches.push({
        id: f.id,
        homeId: f.home_team_id,
        awayId: f.away_team_id,
        homeScore: f.home_score,
        awayScore: f.away_score,
        status: f.status,
      });
    });

    const fixtureRounds = Array.from(roundsBy.values()).sort((a, b) => a.round - b.round);

    const standings = calculateStandings(teams, fixtureRounds);

    return json({ standings });
  } catch (error) {
    logApiError("season_standings_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
