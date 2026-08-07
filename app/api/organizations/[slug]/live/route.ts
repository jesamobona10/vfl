import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { FixtureRound, Match, Team } from "@/lib/types";
import { roundByeId } from "@/lib/logic/standings";
import { sortMatchesByDateTime } from "@/lib/utils/helpers";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";
import { isLiveEligible } from "@/lib/logic/live";

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
      .select("*, match_events(*)")
      .order("round")
      .order("id");

    if (competitionId) {
      query = query.eq("competition_id", competitionId);
    } else if (seasonId) {
      const { data: orgComps } = await sb
        .from("competitions")
        .select("id")
        .eq("organization_id", org.id);
      const compIds = (orgComps || []).map((c) => c.id);
      if (compIds.length > 0) {
        query = query.in("competition_id", compIds).eq("season_id", seasonId);
      } else {
        return json({ live: [], upcoming: [], now: new Date().toISOString(), teams: [] });
      }
    } else {
      const teamIds = teams.map((t) => t.id);
      if (teamIds.length > 0) {
        const conditions = teamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(",");
        query = query.or(conditions);
      } else {
        return json({ live: [], upcoming: [], now: new Date().toISOString(), teams: [] });
      }
    }

    if (seasonId) {
      query = query.eq("season_id", seasonId);
    }

    const { data: dbMatches, error } = await query;

    if (error) {
      logApiError("org_live_query_error", error);
      return json({ error: "Failed to load live matches." }, { status: 500 });
    }

    const now = new Date();
    const live: Match[] = [];
    const upcoming: Match[] = [];

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
        events: (m.match_events || []).map((e: any) => ({
          playerId: e.player_id,
          type: e.event_type,
          teamId: e.team_id,
          minute: e.minute ?? undefined,
        })),
        competition_id: m.competition_id || null,
        season_id: m.season_id || null,
        live_started_at: m.live_started_at || null,
      };

      if (match.status === "live" || match.status === "in-progress") {
        live.push(match);
      } else if (isLiveEligible(match, now, 10)) {
        upcoming.push(match);
      }
    }

    return json({
      live: sortMatchesByDateTime(live),
      upcoming: sortMatchesByDateTime(upcoming),
      now: now.toISOString(),
      teams,
    });
  } catch (error) {
    logApiError("org_live_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
