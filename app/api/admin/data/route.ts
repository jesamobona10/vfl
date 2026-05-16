import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Team, Player, FixtureRound, Match } from "@/lib/types";
import { roundByeId } from "@/lib/logic/standings";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const sb = createServiceRoleClient();

    const { data: dbTeams } = await sb
      .from("teams")
      .select("*")
      .order("id");

    const teams: Team[] = (dbTeams || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      logo: t.logo_url || undefined,
      rating: t.rating ?? 6.0,
    }));

    const { data: dbPlayers } = await sb
      .from("players")
      .select("*")
      .order("id");

    const players: Player[] = (dbPlayers || []).map((p: any) => ({
      id: p.id,
      teamId: p.team_id,
      name: p.name,
      position: p.position as Player["position"],
      number: p.jersey_number || 0,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
      ownGoals: 0,
      yellowCards: p.yellow_cards ?? 0,
      redCards: p.red_cards ?? 0,
      saves: p.saves ?? 0,
      penaltySaves: 0,
      cleanSheets: p.clean_sheets ?? 0,
      motm: 0,
      tackles: p.tackles ?? 0,
      interceptions: 0,
      blocks: 0,
      aerialDuelsWon: 0,
      errorsLeadingToGoal: 0,
      penaltiesConceded: 0,
      goalsConceded: 0,
      matchWins: 0,
      bonus5Saves: 0,
      captain: p.is_captain ?? false,
      rating: p.rating ?? 6.0,
      matchRatings: {},
    }));

    const { data: dbMatches } = await sb
      .from("fixtures")
      .select("*")
      .order("round")
      .order("id");

    const grouped = new Map<number, Match[]>();
    const roundSet = new Set<number>();

    for (const m of dbMatches || []) {
      const match: Match = {
        id: m.id,
        round: m.round,
        homeId: m.home_team_id,
        awayId: m.away_team_id,
        homeScore: m.home_score,
        awayScore: m.away_score,
        status: m.status || "scheduled",
        date: m.date || "",
        time: m.time || "",
        venue: m.venue || "",
        events: [],
      };
      if (!grouped.has(m.round)) grouped.set(m.round, []);
      grouped.get(m.round)!.push(match);
      roundSet.add(m.round);
    }

    const sortedRounds = Array.from(roundSet).sort((a, b) => a - b);
    const fixtures: FixtureRound[] = sortedRounds.map((round) => {
      const matches = grouped.get(round)!;
      const roundObj: FixtureRound = { round, byeId: null, matches };
      roundObj.byeId = roundByeId(roundObj, teams);
      return roundObj;
    });

    return NextResponse.json({ teams, players, fixtures });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
