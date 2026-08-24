import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Match, Team } from "@/lib/types";
import { sortMatchesByDateTime } from "@/lib/utils/helpers";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";
import { isLiveEligible, matchKickoff } from "@/lib/logic/live";

export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const competitionId = url.searchParams.get("competition_id");
    const seasonId = url.searchParams.get("season_id");
    const tzRaw = Number(url.searchParams.get("tz"));
    const tzOffset = Number.isFinite(tzRaw)
      ? Math.max(-14 * 60, Math.min(14 * 60, Math.round(tzRaw)))
      : 0;

    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    if (
      !auth!.isAdmin &&
      (!auth!.orgMembership || auth!.orgMembership.organization_id !== org.id)
    ) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: dbTeams } = await sb
      .from("teams")
      .select("id, name, logo_url, rating")
      .eq("organization_id", org.id)
      .order("id");

    const teams: Team[] = (dbTeams || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      logo: t.logo_url || undefined,
      rating: t.rating ?? 6.0,
    }));

    let query = sb.from("fixtures").select("*, match_events(*)").order("round").order("id");

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
        const conditions = teamIds
          .map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`)
          .join(",");
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
    const debug = url.searchParams.get("debug") === "1";
    const diagnostics: any[] = [];
    const teamName = (id: number) => {
      const t = teams.find((x) => x.id === id);
      return t?.name || `#${id}`;
    };

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

      let reason = "";
      let included = false;
      if (match.status === "live" || match.status === "in-progress") {
        included = true;
        reason = "included (live)";
      } else if (match.status !== "scheduled") {
        reason = `excluded (status "${match.status}")`;
      } else if (!match.date || !match.time) {
        reason = 'excluded (no date/time — set it via the match flyer "Save Date & Time")';
      } else {
        const k = matchKickoff(match, tzOffset);
        if (!k) {
          reason = `excluded (invalid date/time "${match.date} ${match.time}")`;
        } else if (isLiveEligible(match, now, 10, 10, tzOffset)) {
          included = true;
          reason = "included (upcoming)";
        } else if (now.getTime() < k.getTime() - 10 * 60_000) {
          const minsAhead = Math.ceil((k.getTime() - now.getTime()) / 60_000);
          reason = `excluded (kickoff in ~${minsAhead} min — appears 10 min before)`;
        } else {
          reason = "excluded (grace window passed)";
        }
      }

      if (included) {
        if (match.status === "live" || match.status === "in-progress") {
          live.push(match);
        } else {
          upcoming.push(match);
        }
      }

      if (debug) {
        const k = matchKickoff(match, tzOffset);
        diagnostics.push({
          id: match.id,
          round: match.round,
          match: `${teamName(match.homeId)} vs ${teamName(match.awayId)}`,
          status: match.status,
          date: match.date,
          time: match.time,
          competition_id: match.competition_id,
          season_id: match.season_id,
          kickoff: k ? k.toISOString() : null,
          tzOffset,
          now: now.toISOString(),
          reason,
        });
      }
    }

    return json({
      live: sortMatchesByDateTime(live),
      upcoming: sortMatchesByDateTime(upcoming),
      now: now.toISOString(),
      teams,
      diagnostics: debug ? diagnostics : undefined,
    });
  } catch (error) {
    logApiError("org_live_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
