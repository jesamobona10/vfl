import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
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
  requireOrgAdmin,
  sanitizeText,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { resolveOrgSeasonIds } from "@/lib/season-org";
import { updateTeamRatings } from "@/lib/logic/ratings";
import type { Match, Player, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

async function attachCurrentRatings(sb: ReturnType<typeof createServiceRoleClient>, rows: any[]) {
  if (!rows.length) return rows;
  const teamIds = rows.map((team) => team.id as number);
  const condition = teamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(",");
  const [{ data: fixtureRows }, { data: playerRows }] = await Promise.all([
    sb.from("fixtures")
      .select("id, round, home_team_id, away_team_id, home_score, away_score, status, date, time, venue")
      .or(condition),
    sb.from("players").select("id, team_id, rating").in("team_id", teamIds),
  ]);
  const teams = rows.map((team): Team => ({ id: team.id, name: team.name, rating: team.rating ?? 6 }));
  const matches: Match[] = (fixtureRows || []).map((fixture: any) => ({
    id: fixture.id,
    round: fixture.round,
    homeId: fixture.home_team_id,
    awayId: fixture.away_team_id,
    homeScore: fixture.home_score,
    awayScore: fixture.away_score,
    status: fixture.status,
    date: fixture.date || "",
    time: fixture.time || "",
    venue: fixture.venue || "",
    events: [],
  }));
  const players = (playerRows || []).map((player: any) => ({
    id: player.id,
    teamId: player.team_id,
    rating: typeof player.rating === "number" && player.rating > 0 ? player.rating : 6,
  })) as Player[];
  updateTeamRatings(teams, matches, players);
  const ratingById = new Map(teams.map((team) => [team.id, team.rating]));
  return rows.map((team) => ({ ...team, rating: ratingById.get(team.id) ?? team.rating ?? 6 }));
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    // Org scoping: non-admins are always limited to their own organization.
    // A client-supplied org_id must never widen access (service-role reads
    // bypass RLS, so this route would otherwise leak every org's teams).
    const requestedOrgId = url.searchParams.get("org_id");
    let orgId: string | null;
    if (auth!.isAdmin) {
      orgId = requestedOrgId || auth!.orgMembership?.organization_id || null;
    } else {
      orgId = auth!.orgMembership?.organization_id || null;
      if (!orgId) {
        return json({ error: "Organization ID is required." }, { status: 400 });
      }
      if (requestedOrgId && requestedOrgId !== orgId) {
        logSecurityEvent("teams_list_forbidden_org", {
          userId: auth!.userId,
          requestedOrgId,
          orgId,
        });
        return json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!orgId) {
      return json({ error: "Organization ID is required." }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    // Optional season scoping: limit to teams registered in the org season's
    // competition seasons. The org season must belong to the resolved org to
    // prevent reading another org's registrations.
    const orgSeasonId = url.searchParams.get("org_season_id");
    if (orgSeasonId) {
      const seasonIds = await resolveOrgSeasonIds(sb, orgSeasonId, orgId);
      if (seasonIds.length === 0) {
        return json({ teams: [] });
      }

      const { data: seasonTeams } = await sb
        .from("season_teams")
        .select("team_id")
        .in("season_id", seasonIds);
      const teamIds = (seasonTeams || []).map((st) => st.team_id as number);
      if (teamIds.length === 0) {
        return json({ teams: [] });
      }

      const { data, error } = await sb
        .from("teams")
        .select("*")
        .eq("organization_id", orgId)
        .in("id", teamIds)
        .order("id");

      if (error) {
        logApiError("teams_list_failed", error);
        return json({ error: "Unable to load teams." }, { status: 500 });
      }
      return json({ teams: await attachCurrentRatings(sb, data || []) });
    }

    const { data, error } = await sb
      .from("teams")
      .select("*")
      .eq("organization_id", orgId)
      .order("id");

    if (error) {
      logApiError("teams_list_failed", error);
      return json({ error: "Unable to load teams." }, { status: 500 });
    }
    return json({ teams: await attachCurrentRatings(sb, data || []) });
  } catch (error) {
    logApiError("teams_list_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `teams:create:${ip}:${auth?.userId || "anon"}`,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("team_create_rate_limited", { ip, userId: auth?.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = asString(parsed.data!.name, 80);
    if (!name) return json({ error: "Team name is required." }, { status: 400 });

    const organization_id = asString(parsed.data!.organization_id, 64);
    if (!organization_id) return json({ error: "Organization ID is required." }, { status: 400 });

    const orgAdminError = requireOrgAdmin(auth, organization_id);
    if (orgAdminError) return orgAdminError;

    const { data, error } = await supabase
      .from("teams")
      .insert({ name: sanitizeText(name), organization_id, rating: 6.0 })
      .select()
      .single();

    if (error) {
      logApiError("team_create_failed", error, { userId: auth!.userId });
      if (error.code === "23505") {
        return json({ error: "A team with this name already exists." }, { status: 409 });
      }
      return json({ error: "Unable to create team." }, { status: 400 });
    }
    logSecurityEvent("team_created", {
      ip,
      userId: auth!.userId,
      orgId: organization_id,
      teamId: data.id,
      teamName: name,
    });
    void writeAuditRecord({
      organizationId: organization_id,
      actorId: auth!.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.TEAM_CREATED,
      resourceType: "TEAM",
      resourceId: data.id,
      description: `Created team ${name}`,
      after: { name: data.name, organization_id },
      ip,
    }).catch(() => {});
    return json({ team: data });
  } catch (error) {
    logApiError("team_create_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
