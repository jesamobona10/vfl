import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";
import { calculateStandings } from "@/lib/logic/standings";
import { generatePlayoffs, generateCupBracket, generateCupBracketFromTeams, resetCupIdCounter } from "@/lib/logic/cup";
import type { Team, FixtureRound, Match, CupMatch } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: competition } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const { data: dbTeams } = await sb
      .from("teams")
      .select("*")
      .eq("organization_id", competition.organization_id)
      .order("id");

    if (!dbTeams || dbTeams.length < 2) {
      return json({ error: "Need at least 2 teams in the organization." }, { status: 400 });
    }

    const teams: Team[] = dbTeams.map((t: any) => ({
      id: t.id, name: t.name, rating: t.rating ?? 6.0,
    }));

    let allCupMatches: CupMatch[];

    if (competition.type === "cup") {
      resetCupIdCounter();
      allCupMatches = generateCupBracketFromTeams(teams);
    } else {
      const { data: dbMatches } = await sb
        .from("fixtures")
        .select("*")
        .eq("competition_id", params.id)
        .order("round");

      const grouped = new Map<number, Match[]>();
      for (const m of dbMatches || []) {
        const match: Match = {
          id: m.id, round: m.round, homeId: m.home_team_id, awayId: m.away_team_id,
          homeScore: m.home_score, awayScore: m.away_score,
          status: m.status || "scheduled", date: m.date || "", time: m.time || "",
          venue: m.venue || "", events: [],
        };
        if (!grouped.has(m.round)) grouped.set(m.round, []);
        grouped.get(m.round)!.push(match);
      }

      const sortedRounds = Array.from(grouped.keys()).sort((a, b) => a - b);
      const fixtures: FixtureRound[] = sortedRounds.map((round) => ({
        round, byeId: null, matches: grouped.get(round)!,
      }));

      if (teams.length < 11) {
        return json({ error: "Need at least 11 teams in the organization for league knockout." }, { status: 400 });
      }

      const standings = calculateStandings(teams, fixtures);
      resetCupIdCounter();

      const playoffMatches: CupMatch[] = generatePlayoffs(standings);
      const bracketMatches: CupMatch[] = generateCupBracket(standings, playoffMatches);
      allCupMatches = [...playoffMatches, ...bracketMatches];
    }

    const cupInserts = allCupMatches.map((m) => ({
      competition_id: params.id,
      round: m.round,
      match_index: m.matchIndex,
      home_id: m.homeId,
      away_id: m.awayId,
      away_from_match_id: m.awayFromMatchId,
      home_from_match_id: m.homeFromMatchId,
      home_score: m.homeScore,
      away_score: m.awayScore,
      home_et_score: m.homeETScore,
      away_et_score: m.awayETScore,
      home_pen_score: m.homePenScore,
      away_pen_score: m.awayPenScore,
      status: m.status,
      winner_id: m.winnerId,
      completed_via: m.completedVia,
      playoff_pairing: m.playoffPairing,
      date: m.date || null,
      time: m.time || null,
      venue: m.venue,
    }));

    if (cupInserts.length > 0) {
      const { error: insertError } = await sb
        .from("cup_matches")
        .insert(cupInserts);

      if (insertError) {
        logApiError("knockout_generate_insert_error", insertError);
        return json({ error: "Failed to save cup matches." }, { status: 500 });
      }
    }

    const playoffCount = allCupMatches.filter((m) => m.round === "playoff").length;
    const bracketCount = allCupMatches.filter((m) => m.round !== "playoff").length;

    return json({
      success: true,
      playoffCount,
      bracketCount,
    });
  } catch (error) {
    logApiError("knockout_generate_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
