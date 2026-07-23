import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { FixtureRound, Match, Team } from "@/lib/types";
import { roundByeId } from "@/lib/logic/standings";
import { sortMatchesByDateTime } from "@/lib/utils/helpers";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const competitionId = url.searchParams.get("competition_id");
    const seasonId = url.searchParams.get("season_id");

    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    if (!auth!.isAdmin && (!auth!.orgMembership || auth!.orgMembership.organization_id !== org.id)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: dbTeams } = await sb
      .from("teams")
      .select("id, name, logo_url, rating")
      .eq("organization_id", org.id)
      .order("id");

    const teams: Team[] = (dbTeams || []).map((t: any) => ({
      id: t.id, name: t.name, logo: t.logo_url || undefined, rating: t.rating ?? 6.0,
    }));

    let query = sb
      .from("fixtures")
      .select("*")
      .order("round")
      .order("id");

    if (competitionId) {
      query = query.eq("competition_id", competitionId);
    } else {
      const teamIds = teams.map((t) => t.id);
      if (teamIds.length > 0) {
        const conditions = teamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(",");
        query = query.or(conditions);
      } else {
        return json({ fixtures: [] });
      }
    }

    if (seasonId) {
      query = query.eq("season_id", seasonId);
    }

    const { data: dbMatches, error } = await query;

    if (error) {
      logApiError("org_fixtures_query_error", error);
      return json({ error: "Failed to load fixtures." }, { status: 500 });
    }

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
      const matches = sortMatchesByDateTime(grouped.get(round)!);
      const roundObj: FixtureRound = { round, byeId: null, matches };
      roundObj.byeId = roundByeId(roundObj, teams);
      return roundObj;
    });

    return json({ fixtures });
  } catch (error) {
    logApiError("org_fixtures_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
