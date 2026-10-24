import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireOrgMember } from "@/lib/security";
import { resolveSeasonOrganization } from "@/lib/season-org";
import { calculateStandings } from "@/lib/logic/standings";
import { updateTeamRatings } from "@/lib/logic/ratings";
import type { Match, Player, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { season, organizationId } = await resolveSeasonOrganization(sb, params.id);

    if (!season) return json({ error: "Season not found." }, { status: 404 });

    const memberError = requireOrgMember(auth, organizationId as string);
    if (memberError) return json({ error: "Forbidden" }, { status: 403 });

    // Friendly (and other non-counting) competitions have no standings.
    const { data: competition } = await sb
      .from("competitions")
      .select("counts_toward_stats")
      .eq("id", season.competition_id)
      .maybeSingle();

    if (competition?.counts_toward_stats === false) {
      return json({ standings: [] });
    }

    // Fetch teams for season
    const { data: seasonTeams, error: seasonTeamsError } = await sb
      .from("season_teams")
      .select("team:team_id(id, name, logo_url, rating), display_name")
      .eq("season_id", params.id);
    if (seasonTeamsError) throw seasonTeamsError;

    const teams: Team[] = (seasonTeams || []).filter((st: any) => st.team).map((st: any) => ({
      id: st.team.id,
      name: st.team.name || st.display_name,
      logo_url: st.team.logo_url,
      rating: st.team.rating || 6.0,
    }));

    // Fetch fixtures grouped by round
    const { data: fixtures, error: fixturesError } = await sb
      .from("fixtures")
      .select("id, round, home_team_id, away_team_id, home_score, away_score, status, date, time, venue")
      .eq("season_id", params.id)
      .order("round", { ascending: true });
    if (fixturesError) throw fixturesError;

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
        date: f.date || "",
        time: f.time || "",
        venue: f.venue || "",
        events: [],
      });
    });

    const fixtureRounds = Array.from(roundsBy.values()).sort((a, b) => a.round - b.round);
    const matches = fixtureRounds.flatMap((round) => round.matches) as Match[];
    const teamIds = teams.map((team) => team.id);
    const { data: playerRows, error: playersError } = teamIds.length
      ? await sb.from("players").select("id, team_id, rating").in("team_id", teamIds)
      : { data: [], error: null };
    if (playersError) throw playersError;

    const players: Player[] = (playerRows || []).map((player: any) => ({
      id: player.id,
      teamId: player.team_id,
      // Legacy rows may store 0 as the uninitialized player rating. Treat
      // that as the neutral baseline so it cannot cancel match results.
      rating: typeof player.rating === "number" && player.rating > 0 ? player.rating : 6.0,
    }) as Player);
    const teamsWithPlayers = new Set(players.map((player) => player.teamId));
    for (const team of teams) {
      if (!teamsWithPlayers.has(team.id)) {
        // An empty roster should not erase the effect of match results.
        players.push({ id: -team.id, teamId: team.id, rating: 6.0 } as Player);
      }
    }

    updateTeamRatings(teams, matches, players);

    const standings = calculateStandings(teams, fixtureRounds);

    return json({ standings });
  } catch (error) {
    logApiError("season_standings_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
