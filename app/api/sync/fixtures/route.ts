import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeTime } from "@/lib/utils/helpers";
import {
  asInteger,
  asOptionalString,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  sanitizeText,
} from "@/lib/security";

const MAX_ROUNDS = 100;
const MAX_MATCHES = 1000;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    if (!auth.isAdmin && !auth.orgMembership) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    if (!auth.isAdmin) {
      const orgAdminError = requireOrgAdmin(auth, auth.orgMembership!.organization_id);
      if (orgAdminError) return orgAdminError;
    }

    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `sync:fixtures:${ip}`, limit: 10, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("sync_fixtures_rate_limited", { ip, userId: auth.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const fixtures = parsed.data!.fixtures;
    const teamIdMap =
      parsed.data!.teamIdMap && typeof parsed.data!.teamIdMap === "object"
        ? (parsed.data!.teamIdMap as Record<string, unknown>)
        : {};

    if (!fixtures || !Array.isArray(fixtures)) {
      return json({ error: "Fixtures array is required." }, { status: 400 });
    }

    if (fixtures.length > MAX_ROUNDS) {
      return json({ error: `Too many fixture rounds. Maximum is ${MAX_ROUNDS}.` }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    // Org scoping: org admins may only sync data belonging to their own org.
    // The service-role client bypasses RLS, so every referenced entity must be
    // validated against the caller's org here.
    const callerOrgId = auth.orgMembership?.organization_id ?? null;

    let orgTeamIds: Set<number> | null = null;
    if (callerOrgId) {
      const { data: orgTeams } = await sb
        .from("teams")
        .select("id")
        .eq("organization_id", callerOrgId);
      orgTeamIds = new Set((orgTeams || []).map((t: any) => t.id));
    }

    const allMatches: any[] = [];
    for (const round of fixtures) {
      for (const match of round.matches ?? []) {
        if (allMatches.length >= MAX_MATCHES) break;
        const localHomeId = match.homeId ?? match.home_team_id;
        const localAwayId = match.awayId ?? match.away_team_id;
        const id = match.id != null ? Math.trunc(Number(match.id)) : undefined;
        const roundNo = asInteger(match.round ?? round.round, 1, 999);
        const homeTeamId = asInteger(teamIdMap?.[localHomeId] ?? localHomeId, 1);
        const awayTeamId = asInteger(teamIdMap?.[localAwayId] ?? localAwayId, 1);
        if (
          id == null ||
          Number.isNaN(id) ||
          !roundNo ||
          !homeTeamId ||
          !awayTeamId ||
          homeTeamId === awayTeamId
        )
          continue;
        const status = asString(match.status, 30) || "scheduled";
        const venue = asOptionalString(match.venue, 120);
        allMatches.push({
          id,
          round: roundNo,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: asInteger(match.homeScore ?? match.home_score, 0, 999),
          away_score: asInteger(match.awayScore ?? match.away_score, 0, 999),
          status,
          date: match.date || null,
          time: normalizeTime(match.time),
          venue: venue ? sanitizeText(venue) : null,
          competition_id: match.competition_id || match.competitionId || null,
          season_id: match.season_id || match.seasonId || null,
        });
      }
    }

    if (allMatches.length === 0) {
      return json({ error: "No matches found in fixtures data." }, { status: 400 });
    }

    if (callerOrgId) {
      const orgIds = orgTeamIds!;

      // 1. Every referenced team must exist and belong to the caller's org.
      const referencedTeamIds = new Set<number>();
      for (const m of allMatches) {
        referencedTeamIds.add(m.home_team_id);
        referencedTeamIds.add(m.away_team_id);
      }
      const { data: teamRows } = await sb
        .from("teams")
        .select("id")
        .in("id", Array.from(referencedTeamIds));
      const foundTeamIds = new Set((teamRows || []).map((t: any) => t.id));
      for (const teamId of referencedTeamIds) {
        if (!foundTeamIds.has(teamId)) {
          return json({ error: `Unknown team id ${teamId}.` }, { status: 400 });
        }
        if (!orgIds.has(teamId)) {
          logSecurityEvent("sync_fixtures_cross_org_team", {
            userId: auth.userId,
            teamId,
            orgId: callerOrgId,
          });
          return json({ error: "Fixtures may only reference teams in your organization." }, {
            status: 403,
          });
        }
      }

      // 2. Overwriting an existing fixture by id is only allowed when the
      // existing row already belongs to the caller's org.
      const fixtureIds = allMatches.map((m) => m.id);
      const { data: existingFixtures } = await sb
        .from("fixtures")
        .select("id, home_team_id, away_team_id")
        .in("id", fixtureIds);
      for (const f of existingFixtures || []) {
        if (!orgIds.has(f.home_team_id) || !orgIds.has(f.away_team_id)) {
          logSecurityEvent("sync_fixtures_cross_org_fixture", {
            userId: auth.userId,
            fixtureId: f.id,
            orgId: callerOrgId,
          });
          return json(
            { error: `Fixture ${f.id} belongs to another organization.` },
            { status: 403 }
          );
        }
      }

      // 3. Referenced competitions/seasons must belong to the caller's org.
      const competitionRefs = new Set(
        allMatches.map((m) => m.competition_id).filter(Boolean) as string[]
      );
      for (const competitionId of competitionRefs) {
        const { data: competition } = await sb
          .from("competitions")
          .select("id")
          .eq("id", competitionId)
          .eq("organization_id", callerOrgId)
          .maybeSingle();
        if (!competition) {
          return json({ error: "Competition not found in your organization." }, { status: 400 });
        }
      }
      const seasonRefs = new Set(allMatches.map((m) => m.season_id).filter(Boolean) as string[]);
      for (const seasonId of seasonRefs) {
        const { data: season } = await sb
          .from("seasons")
          .select("id, competitions!inner(organization_id)")
          .eq("id", seasonId)
          .eq("competitions.organization_id", callerOrgId)
          .maybeSingle();
        if (!season) {
          return json({ error: "Season not found in your organization." }, { status: 400 });
        }
      }
    }

    const { error: insertError } = await sb.from("fixtures").upsert(allMatches, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (insertError) {
      logApiError("sync_fixtures_upsert_failed", insertError, { userId: auth.userId });
      return json({ error: "Unable to sync fixtures." }, { status: 500 });
    }

    const fixtureIds = allMatches.map((m) => m.id);

    const allEvents: any[] = [];
    for (const round of fixtures) {
      for (const match of round.matches ?? []) {
        if (!match.events?.length) continue;
        const id = match.id != null ? Math.trunc(Number(match.id)) : undefined;
        if (id == null || !fixtureIds.includes(id)) continue;
        for (const event of match.events) {
          allEvents.push({
            match_id: id,
            player_id: asInteger(event.playerId, 1),
            team_id: asInteger(event.teamId, 1),
            event_type: asString(event.type, 30),
            minute: asInteger(event.minute, 0, 200),
          });
        }
      }
    }
    const wellFormedEvents = allEvents.filter((e) => e.player_id && e.event_type);

    if (wellFormedEvents.length > 0 && fixtureIds.length > 0) {
      const missingTeamIds = wellFormedEvents.filter((e) => !e.team_id).map((e) => e.player_id);
      if (missingTeamIds.length > 0) {
        const { data: eventPlayers } = await sb
          .from("players")
          .select("id, team_id")
          .in("id", missingTeamIds);
        const playerTeamMap = new Map((eventPlayers || []).map((p: any) => [p.id, p.team_id]));
        for (const event of wellFormedEvents) {
          if (!event.team_id) {
            event.team_id = playerTeamMap.get(event.player_id) || null;
          }
        }
      }

      let validEvents = wellFormedEvents.filter((e) => e.team_id);

      // Events must reference teams within the caller's org.
      if (callerOrgId) {
        validEvents = validEvents.filter((e) => orgTeamIds!.has(e.team_id));
      }

      if (validEvents.length > 0) {
        await sb.from("match_events").delete().in("match_id", fixtureIds);
        const { error: eventsError } = await sb.from("match_events").insert(validEvents);
        if (eventsError) {
          logApiError("sync_fixtures_events_insert_error", eventsError);
        }
      }
    }

    let query = sb.from("fixtures").select("*");
    if (callerOrgId && orgTeamIds!.size > 0) {
      const conditions = Array.from(orgTeamIds!)
        .map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`)
        .join(",");
      query = query.or(conditions);
    }
    const { data: synced } = await query
      .order("round")
      .order("date")
      .order("time")
      .order("id");

    return json({ success: true, fixtures: synced });
  } catch (error) {
    logApiError("sync_fixtures_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
