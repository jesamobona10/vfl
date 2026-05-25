import { createClient } from "@/lib/supabase/server";
import { json, logApiError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("player_profiles")
      .select("player_id, display_name, jersey_number, position as profile_position, photo_url")
      .eq("id", session.user.id)
      .single();

    if (!profile || !profile.player_id) {
      return json({ error: "Player profile not found" }, { status: 404 });
    }

    const playerId = profile.player_id;

    const { data: player } = await supabase
      .from("players")
      .select("*, teams(name, logo, rating)")
      .eq("id", playerId)
      .single();

    if (!player) return json({ error: "Player not found" }, { status: 404 });

    const teamId = player.team_id;

    const { data: rawFixtures } = await supabase
      .from("fixtures")
      .select("*")
      .or(`home_id.eq.${teamId},away_id.eq.${teamId}`)
      .order("round")
      .order("date")
      .order("time");

    const { data: allFixtures } = await supabase
      .from("fixtures")
      .select("*")
      .order("round")
      .order("date")
      .order("time");

    const { data: matchEvents } = await supabase
      .from("match_events")
      .select("*")
      .eq("player_id", playerId);

    const { data: allPlayers } = await supabase
      .from("players")
      .select("*, teams(name, logo)")
      .order("goals", { ascending: false });

    const standings = computeStandings(allPlayers || []);

    return json({
      player: {
        id: player.id,
        teamId: player.team_id,
        name: player.name,
        position: profile.profile_position || player.position,
        number: profile.jersey_number || player.number,
        photoUrl: profile.photo_url || null,
        goals: player.goals,
        assists: player.assists,
        ownGoals: player.own_goals,
        yellowCards: player.yellow_cards,
        redCards: player.red_cards,
        saves: player.saves,
        penaltySaves: player.penalty_saves,
        cleanSheets: player.clean_sheets,
        motm: player.motm,
        tackles: player.tackles,
        interceptions: player.interceptions,
        blocks: player.blocks,
        aerialDuelsWon: player.aerial_duels_won,
        errorsLeadingToGoal: player.errors_leading_to_goal,
        penaltiesConceded: player.penalties_conceded,
        goalsConceded: player.goals_conceded,
        matchWins: player.match_wins,
        bonus5Saves: player.bonus_5_saves,
        captain: player.captain || false,
        rating: player.rating,
        matchRatings: player.match_ratings || {},
      },
      team: player.teams || null,
      teamFixtures: (rawFixtures || []).map(normalizeFixture),
      allFixtures: (allFixtures || []).map(normalizeFixture),
      matchEvents: matchEvents || [],
      allPlayers: (allPlayers || []).map(normalizePlayer),
      standings,
    });
  } catch (error) {
    logApiError("player_data_error", error);
    return json({ error: "Failed to load player data." }, { status: 500 });
  }
}

function normalizeFixture(f: any) {
  return {
    id: f.id,
    round: f.round,
    homeId: f.home_id,
    awayId: f.away_id,
    homeScore: f.home_score,
    awayScore: f.away_score,
    status: f.status,
    date: f.date || "",
    time: f.time || "",
    venue: f.venue || "",
    events: f.events || [],
  };
}

function normalizePlayer(p: any) {
  const team = p.teams;
  return {
    id: p.id,
    teamId: p.team_id,
    name: p.name,
    position: p.position,
    number: p.number,
    goals: p.goals,
    assists: p.assists,
    motm: p.motm,
    rating: p.rating,
    saves: p.saves,
    cleanSheets: p.clean_sheets,
    teamName: team?.name || "Unknown",
    teamLogo: team?.logo || null,
  };
}

function computeStandings(players: any[]) {
  const teamMap = new Map<number, any>();
  for (const p of players || []) {
    const tid = p.team_id;
    if (!teamMap.has(tid)) {
      const team = p.teams;
      teamMap.set(tid, {
        id: tid,
        name: team?.name || "Unknown",
        logo: team?.logo || null,
        goals: 0,
        wins: 0,
        rating: team?.rating || 0,
      });
    }
    teamMap.get(tid).goals += p.goals || 0;
  }
  return Array.from(teamMap.values()).sort((a, b) => b.goals - a.goals);
}
