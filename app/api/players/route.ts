import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Player } from "@/lib/types";
import {
  asBoolean,
  asInteger,
  asString,
  actorRole,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  sanitizeText,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { resolveOrgSeasonIds } from "@/lib/season-org";
import { updatePlayerRatings } from "@/lib/logic/ratings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id") || auth!.orgMembership?.organization_id;
    let scopedSeasonIds: string[] | null = null;

    let query = supabase.from("players").select("*").order("id");

    // Optional season scoping: limit to players registered in the org season's
    // competition seasons (via season_teams → season_team_players).
    const orgSeasonId = url.searchParams.get("org_season_id");
    if (orgSeasonId) {
      if (!orgId) return json({ error: "Organization ID is required." }, { status: 400 });

      const sb = createServiceRoleClient();
      const seasonIds = await resolveOrgSeasonIds(sb, orgSeasonId, orgId);
      scopedSeasonIds = seasonIds;
      if (seasonIds.length === 0) return json({ players: [] });

      const { data: seasonTeams } = await sb
        .from("season_teams")
        .select("id")
        .in("season_id", seasonIds);
      const seasonTeamIds = (seasonTeams || []).map((st) => st.id as string);
      if (seasonTeamIds.length === 0) return json({ players: [] });

      const { data: registrations } = await sb
        .from("season_team_players")
        .select("player_id")
        .in("season_team_id", seasonTeamIds);
      const playerIds = (registrations || []).map((r) => r.player_id as number);
      if (playerIds.length === 0) return json({ players: [] });

      query = query.in("id", playerIds);
    } else if (orgId) {
      const { data: orgTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", orgId);
      const teamIds = (orgTeams || []).map((t) => t.id);
      if (teamIds.length > 0) query = query.in("team_id", teamIds);
      else return json({ players: [] });
    } else if (!auth!.isAdmin && !auth!.orgMembership) {
      if (!auth!.teamAccount?.team_id) return json({ players: [] });
      query = query.eq("team_id", auth!.teamAccount.team_id);
    }

    const { data, error } = await query;

    if (error) {
      logApiError("players_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load players." }, { status: 500 });
    }

    const playerRows = data || [];
    const playerIds = playerRows.map((p: any) => p.id as number);
    const eventCounts = new Map<number, Record<string, number>>();
    const participatedMatches = new Map<number, Set<number>>();
    if (playerIds.length > 0) {
      const sb = createServiceRoleClient();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let eventsQuery = sb
          .from("match_events")
          .select("player_id, event_type, match_id")
          .in("player_id", playerIds);
        if (scopedSeasonIds) eventsQuery = eventsQuery.in("season_id", scopedSeasonIds);
        const { data: eventPage, error: eventError } = await eventsQuery.range(from, from + pageSize - 1);
        if (eventError) {
          logApiError("player_event_stats_failed", eventError, { userId: auth!.userId });
          return json({ error: "Unable to load player statistics." }, { status: 500 });
        }
        for (const event of eventPage || []) {
          if (event.player_id == null) continue;
          const counts = eventCounts.get(event.player_id) || {};
          counts[event.event_type] = (counts[event.event_type] || 0) + 1;
          eventCounts.set(event.player_id, counts);
          const matches = participatedMatches.get(event.player_id) || new Set<number>();
          matches.add(event.match_id);
          participatedMatches.set(event.player_id, matches);
        }
        if (!eventPage || eventPage.length < pageSize) break;
        from += pageSize;
      }
    }

    const matchIds = [...new Set([...participatedMatches.values()].flatMap((matches) => [...matches]))];
    const winByMatch = new Map<number, number>();
    if (matchIds.length > 0) {
      const sb = createServiceRoleClient();
      const { data: matches } = await sb
        .from("fixtures")
        .select("id, home_team_id, away_team_id, home_score, away_score, status")
        .in("id", matchIds)
        .eq("status", "completed");
      for (const match of matches || []) {
        if (match.home_score > match.away_score) winByMatch.set(match.id, match.home_team_id);
        else if (match.away_score > match.home_score) winByMatch.set(match.id, match.away_team_id);
      }
    }

    const players: Player[] = playerRows.map((p: any) => {
      const counts = eventCounts.get(p.id) || {};
      const wins = [...(participatedMatches.get(p.id) || [])].filter((matchId) => {
        const winningTeamId = winByMatch.get(matchId);
        return winningTeamId != null && winningTeamId === p.team_id;
      }).length;
      return {
      id: p.id,
      teamId: p.team_id,
      name: p.name,
      position: p.position as Player["position"],
      number: p.jersey_number || 0,
      goals: counts.goal ?? 0,
      assists: counts.assist ?? 0,
      ownGoals: 0,
      yellowCards: counts.yellow ?? 0,
      redCards: counts.red ?? 0,
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
      matchWins: wins,
      bonus5Saves: 0,
      captain: p.is_captain ?? false,
      rating: p.rating ?? 6.0,
      matchRatings: {},
    };
    });

    updatePlayerRatings(players);

    return json({ players });
  } catch (error) {
    logApiError("players_list_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const limited = await rateLimit({
      key: `players:create:${ip}:${auth!.userId}`,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("player_create_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    let teamIdToUse = asInteger(parsed.data!.team_id ?? parsed.data!.teamId, 1);
    if (auth!.isAdmin) {
      // super admin can create for any team
    } else if (auth!.orgMembership) {
      // org admin must use the passed team_id and it must belong to their org
      if (!teamIdToUse) return json({ error: "Team is required." }, { status: 400 });
      const { data: team } = await supabase
        .from("teams")
        .select("organization_id")
        .eq("id", teamIdToUse)
        .single();
      if (!team || team.organization_id !== auth!.orgMembership.organization_id) {
        return json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (auth!.teamAccount?.team_id) {
      teamIdToUse = auth!.teamAccount.team_id;
    } else {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    if (!teamIdToUse) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const name = asString(parsed.data!.name, 80);
    const position = asString(parsed.data!.position, 40);
    const jerseyNumber = asInteger(parsed.data!.jersey_number ?? parsed.data!.jerseyNumber, 0, 999);
    const isCaptain = asBoolean(parsed.data!.is_captain ?? parsed.data!.isCaptain) ?? false;

    if (!name || !position) {
      return json({ error: "Name and position are required." }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    if (isCaptain) {
      await sb.from("players").update({ is_captain: false }).eq("team_id", teamIdToUse);
    }

    const { data, error } = await sb
      .from("players")
      .insert({
        team_id: teamIdToUse,
        name: sanitizeText(name),
        position: sanitizeText(position),
        jersey_number: jerseyNumber,
        is_captain: isCaptain,
        rating: 6.0,
      })
      .select()
      .single();

    if (error) {
      logApiError("player_create_failed", error, { userId: auth!.userId, teamId: teamIdToUse });
      return json({ error: "Unable to create player." }, { status: 400 });
    }

    let playerOrgId: string | null = null;
    if (auth!.orgMembership) {
      playerOrgId = auth!.orgMembership.organization_id;
    } else {
      const { data: teamForOrg } = await supabase
        .from("teams")
        .select("organization_id")
        .eq("id", teamIdToUse)
        .maybeSingle();
      playerOrgId = (teamForOrg as any)?.organization_id ?? null;
    }

    void writeAuditRecord({
      organizationId: playerOrgId,
      actorId: auth!.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.PLAYER_CREATED,
      resourceType: "PLAYER",
      resourceId: data.id,
      description: `Created player ${data.name}`,
      after: { name: data.name, team_id: teamIdToUse, position: data.position },
      ip,
    }).catch(() => {});

    return json({ player: data });
  } catch (error) {
    logApiError("player_create_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
