import { createClient } from "@/lib/supabase/server";
import { getAuthContext, json, logApiError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const competitionId = params.id;
    const url = new URL(request.url);
    const seasonId = url.searchParams.get("season_id");

    let fixturesQuery = supabase.from("fixtures").select("id").eq("competition_id", competitionId);

    if (seasonId) {
      fixturesQuery = fixturesQuery.eq("season_id", seasonId);
    }

    const { data: fixtures, error: fixturesError } = await fixturesQuery;

    if (fixturesError) {
      logApiError("stats_fixtures_failed", fixturesError);
      return json({ error: "Failed to load fixtures." }, { status: 500 });
    }

    const fixtureIds = (fixtures || []).map((f) => f.id);
    if (fixtureIds.length === 0) {
      return json({
        goalScorers: [],
        assists: [],
        yellowCards: [],
        redCards: [],
      });
    }

    const { data: events, error: eventsError } = await supabase
      .from("match_events")
      .select("id, player_id, team_id, event_type, match_id")
      .in("match_id", fixtureIds);

    if (eventsError) {
      logApiError("stats_events_failed", eventsError);
      return json({ error: "Failed to load events." }, { status: 500 });
    }

    const playerIds = [...new Set((events || []).map((e) => e.player_id))];

    const { data: players } = await supabase
      .from("players")
      .select("id, name, team_id")
      .in("id", playerIds);

    const playerMap = new Map(
      (players || []).map((p: any) => [p.id, { name: p.name, teamId: p.team_id }])
    );

    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", [...new Set((players || []).map((p: any) => p.team_id))]);

    const teamMap = new Map((teams || []).map((t: any) => [t.id, t.name]));

    const goalMap = new Map<
      number,
      { playerId: number; name: string; teamId: number; teamName: string; count: number }
    >();
    const assistMap = new Map<
      number,
      { playerId: number; name: string; teamId: number; teamName: string; count: number }
    >();
    const yellowMap = new Map<
      number,
      { playerId: number; name: string; teamId: number; teamName: string; count: number }
    >();
    const redMap = new Map<
      number,
      { playerId: number; name: string; teamId: number; teamName: string; count: number }
    >();

    const increment = (
      map: Map<number, any>,
      playerId: number,
      name: string,
      teamId: number,
      teamName: string
    ) => {
      const existing = map.get(playerId);
      if (existing) {
        existing.count++;
      } else {
        map.set(playerId, { playerId, name, teamId, teamName, count: 1 });
      }
    };

    for (const event of events || []) {
      const playerInfo = playerMap.get(event.player_id);
      if (!playerInfo) continue;
      const teamName = teamMap.get(event.team_id) || "";

      if (event.event_type === "goal") {
        increment(goalMap, event.player_id, playerInfo.name, playerInfo.teamId, teamName);
      } else if (event.event_type === "assist") {
        increment(assistMap, event.player_id, playerInfo.name, playerInfo.teamId, teamName);
      } else if (event.event_type === "yellow") {
        increment(yellowMap, event.player_id, playerInfo.name, playerInfo.teamId, teamName);
      } else if (event.event_type === "red") {
        increment(redMap, event.player_id, playerInfo.name, playerInfo.teamId, teamName);
      }
    }

    const sortByCount = (a: any, b: any) => b.count - a.count;

    return json({
      goalScorers: [...goalMap.values()].sort(sortByCount),
      assists: [...assistMap.values()].sort(sortByCount),
      yellowCards: [...yellowMap.values()].sort(sortByCount),
      redCards: [...redMap.values()].sort(sortByCount),
    });
  } catch (error) {
    logApiError("stats_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
