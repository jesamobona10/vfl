import { createClient } from "@/lib/supabase/server";
import {
  asInteger,
  asOptionalString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
  requireAuth,
  sanitizeText,
} from "@/lib/security";
import { sortMatchesByDateTime } from "@/lib/utils/helpers";
import { roundByeId } from "@/lib/logic/standings";
import type { FixtureRound, Match, MatchEvent, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id") || auth!.orgMembership?.organization_id;

    let query = supabase
      .from("fixtures")
      .select("*, match_events(*)")
      .order("round")
      .order("id");

    if (orgId) {
      const { data: orgTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", orgId);
      const teamIds = (orgTeams || []).map((t) => t.id);
      if (teamIds.length > 0) {
        const conditions = teamIds.flatMap((id) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`]);
        query = query.or(conditions.join(","));
      } else {
        return json({ fixtures: [] });
      }
    } else if (!auth!.isAdmin && !auth!.orgMembership) {
      const teamId = auth!.teamAccount?.team_id;
      if (!teamId) return json({ fixtures: [] });
      query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
    }
    const { data, error } = await query;

    if (error) {
      logApiError("fixtures_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load fixtures." }, { status: 500 });
    }

    const rawFixtures: any[] = data || [];

    const grouped = new Map<number, Match[]>();
    const roundSet = new Set<number>();

    for (const m of rawFixtures) {
      const events: MatchEvent[] = (m.match_events || []).map((e: any) => ({
        playerId: e.player_id,
        type: e.event_type,
        teamId: e.team_id,
        minute: e.minute ?? undefined,
      }));

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
        events,
        competition_id: m.competition_id ?? null,
      };
      if (!grouped.has(m.round)) grouped.set(m.round, []);
      grouped.get(m.round)!.push(match);
      roundSet.add(m.round);
    }

    const sortedRounds = Array.from(roundSet).sort((a, b) => a - b);

    const fixtures: FixtureRound[] = sortedRounds.map((round) => {
      const matches = sortMatchesByDateTime(grouped.get(round)!);
      const roundObj: FixtureRound = { round, byeId: null, matches };
      return roundObj;
    });

    return json({ fixtures });
  } catch (error) {
    logApiError("fixtures_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({ key: `fixture_create:${ip}`, limit: 15, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const round = asInteger(parsed.data!.round, 1, 999);
    const homeTeamId = asInteger(parsed.data!.home_team_id ?? parsed.data!.homeTeamId, 1);
    const awayTeamId = asInteger(parsed.data!.away_team_id ?? parsed.data!.awayTeamId, 1);
    const date = asOptionalString(parsed.data!.date, 10);
    const time = asOptionalString(parsed.data!.time, 8);
    const venue = asOptionalString(parsed.data!.venue, 120);

    if (!round || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      return json({ error: "Valid round, home team, and away team are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("fixtures")
      .insert({
        round,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        date,
        time,
        venue: venue ? sanitizeText(venue) : null,
      })
      .select()
      .single();

    if (error) {
      logApiError("fixture_create_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to create fixture." }, { status: 400 });
    }
    return json({ fixture: data });
  } catch (error) {
    logApiError("fixture_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
