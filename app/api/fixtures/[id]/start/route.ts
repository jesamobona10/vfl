import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  actorRole,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { enqueuePublicPush } from "@/lib/public-push";
import { registeredPlayersStartError } from "@/lib/match-guard";

export const dynamic = "force-dynamic";

/**
 * Counts registered players for each team in a fixture. When the fixture
 * belongs to a season, the count is season registrations (active rows in
 * `season_team_players` via the team's `season_teams` row). Legacy fixtures
 * without a season fall back to players owned by each team.
 */
async function registeredPlayerCounts(
  sb: SupabaseClient,
  fixture: { season_id: string | null; home_team_id: number; away_team_id: number }
): Promise<Record<number, number>> {
  const teamIds = [fixture.home_team_id, fixture.away_team_id];
  const counts: Record<number, number> = {};

  if (fixture.season_id) {
    const { data: seasonTeams } = await sb
      .from("season_teams")
      .select("id, team_id")
      .eq("season_id", fixture.season_id)
      .in("team_id", teamIds);

    const teamToSeasonTeam = new Map<number, string>();
    for (const st of seasonTeams || []) teamToSeasonTeam.set(st.team_id, st.id);

    for (const teamId of teamIds) {
      const seasonTeamId = teamToSeasonTeam.get(teamId);
      if (!seasonTeamId) {
        counts[teamId] = 0;
        continue;
      }
      const { count, error } = await sb
        .from("season_team_players")
        .select("id", { count: "exact", head: true })
        .eq("season_team_id", seasonTeamId)
        .eq("status", "active");
      if (error) {
        logApiError("fixture_start_player_count_error", error, { seasonTeamId });
        counts[teamId] = 0;
      } else {
        counts[teamId] = count ?? 0;
      }
    }
  } else {
    for (const teamId of teamIds) {
      const { count, error } = await sb
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId);
      if (error) {
        logApiError("fixture_start_player_count_error", error, { teamId });
        counts[teamId] = 0;
      } else {
        counts[teamId] = count ?? 0;
      }
    }
  }

  return counts;
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `fixture:start:${ip}:${auth.userId}`,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("fixture_start_rate_limited", { ip, userId: auth.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const fixtureId = asInteger(params.id, 1);
    if (!fixtureId) return json({ error: "Invalid fixture id." }, { status: 400 });

    const { data: fixture, error: fixtureError } = await supabase
      .from("fixtures")
      .select("home_team_id, away_team_id, status, competition_id, season_id")
      .eq("id", fixtureId)
      .single();

    if (fixtureError || !fixture) {
      return json({ error: "Fixture not found." }, { status: 404 });
    }

    const { data: homeTeam } = await supabase
      .from("teams")
      .select("organization_id, name")
      .eq("id", fixture.home_team_id)
      .single();

    const { data: awayTeam } = await supabase
      .from("teams")
      .select("name")
      .eq("id", fixture.away_team_id)
      .single();

    if (!homeTeam) {
      return json({ error: "Team not found." }, { status: 404 });
    }

    const orgId = homeTeam.organization_id;
    const orgAdminError = requireOrgAdmin(auth, orgId);
    if (orgAdminError) return orgAdminError;

    if (fixture.status === "completed") {
      return json({ error: "A completed match cannot be started." }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    // A match cannot kick off until both teams have at least one player
    // registered for this fixture's season.
    if (fixture.status !== "live" && fixture.status !== "in-progress") {
      const counts = await registeredPlayerCounts(sb, fixture);
      const startError = registeredPlayersStartError({
        homeTeamId: fixture.home_team_id,
        awayTeamId: fixture.away_team_id,
        homeTeamName: homeTeam.name,
        awayTeamName: awayTeam?.name || "the away team",
        counts,
      });
      if (startError) {
        logSecurityEvent("fixture_start_blocked_no_players", {
          userId: auth.userId,
          fixtureId,
          homeTeamId: fixture.home_team_id,
          awayTeamId: fixture.away_team_id,
          counts: JSON.stringify(counts),
        });
        return json({ error: startError }, { status: 400 });
      }
    }

    const { data, error } = await sb
      .from("fixtures")
      .update({
        status: "live",
        live_started_at: new Date().toISOString(),
        halftime_notified_at: null,
      })
      .eq("id", fixtureId)
      .select()
      .single();

    if (error) {
      logApiError("fixture_start_failed", error, { userId: auth.userId, fixtureId });
      return json({ error: "Unable to start the match." }, { status: 400 });
    }

    if (fixture.status !== "live" && fixture.status !== "in-progress") {
      enqueuePublicPush({
        title: "Match started",
        body: `${homeTeam.name} vs ${awayTeam?.name || "their opponent"} is underway.`,
        matchId: fixtureId,
        tag: `match-${fixtureId}-start`,
      });
    }

    void writeAuditRecord({
      organizationId: orgId,
      actorId: auth.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.MATCH_STARTED,
      resourceType: "MATCH",
      resourceId: fixtureId,
      description: `Started match #${fixtureId}`,
      before: { status: fixture.status },
      after: { status: "live", live_started_at: data.live_started_at },
      metadata: {
        homeTeamId: fixture.home_team_id,
        awayTeamId: fixture.away_team_id,
        competition_id: fixture.competition_id,
      },
      ip,
    }).catch(() => {});

    return json({ fixture: data });
  } catch (error) {
    logApiError("fixture_start_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
