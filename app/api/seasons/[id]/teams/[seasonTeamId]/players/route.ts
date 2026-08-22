import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
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
  requireOrgMember,
} from "@/lib/security";
import { resolveSeasonTeamOrganization } from "@/lib/season-org";

export const dynamic = "force-dynamic";

async function resolveSeasonTeam(sb: any, seasonTeamId: string) {
  const { data: st } = await sb
    .from("season_teams")
    .select("id, season_id, team_id")
    .eq("id", seasonTeamId)
    .single();
  return st;
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string; seasonTeamId: string }> }
) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const st = await resolveSeasonTeam(sb, params.seasonTeamId);
    if (!st || st.season_id !== params.id) {
      return json({ error: "Season team not found." }, { status: 404 });
    }

    const { organizationId } = await resolveSeasonTeamOrganization(sb, params.seasonTeamId);
    const memberError = requireOrgMember(auth, organizationId as string);
    if (memberError) return memberError;

    const { data: registrations, error } = await sb
      .from("season_team_players")
      .select("*, player:player_id(id, name, position, jersey_number, photo_url)")
      .eq("season_team_id", params.seasonTeamId)
      .order("created_at", { ascending: true });

    if (error) {
      logApiError("season_team_players_error", error);
      return json({ error: "Failed to fetch player registrations." }, { status: 500 });
    }

    return json({ players: registrations || [] });
  } catch (error) {
    logApiError("season_team_players_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; seasonTeamId: string }> }
) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `season_team_player_register:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const st = await resolveSeasonTeam(sb, params.seasonTeamId);
    if (!st || st.season_id !== params.id) {
      return json({ error: "Season team not found." }, { status: 404 });
    }

    const { organizationId } = await resolveSeasonTeamOrganization(sb, params.seasonTeamId);
    const orgId = organizationId as string;
    const adminError = requireOrgAdmin(auth, orgId);
    if (adminError) {
      logSecurityEvent("season_team_player_register_forbidden", {
        userId: auth.userId,
        organizationId: orgId,
        seasonTeamId: params.seasonTeamId,
      });
      return adminError;
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const playerIdsRaw = parsed.data!.player_ids ?? parsed.data!.playerIds;
    if (!Array.isArray(playerIdsRaw) || playerIdsRaw.length === 0) {
      return json({ error: "player_ids must be a non-empty array." }, { status: 400 });
    }

    const playerIds = playerIdsRaw
      .map((v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN))
      .filter((n: number) => Number.isInteger(n) && n > 0);

    if (playerIds.length === 0) {
      return json({ error: "player_ids must be valid player ids." }, { status: 400 });
    }

    const defaultPosition = asString(parsed.data!.position, 10);
    const defaultJersey = asInteger(parsed.data!.jersey_number, 0, 999);

    // Verify players belong to the season team's team
    const { data: players } = await sb
      .from("players")
      .select("id, position, jersey_number")
      .in("id", playerIds)
      .eq("team_id", st.team_id);

    if (!players || players.length === 0) {
      return json({ error: "None of the specified players belong to this team." }, { status: 400 });
    }

    const existing = await sb
      .from("season_team_players")
      .select("player_id")
      .eq("season_team_id", params.seasonTeamId)
      .in(
        "player_id",
        players.map((p: any) => p.id)
      );
    const existingIds = new Set((existing.data || []).map((r: any) => r.player_id));

    const rows = players
      .filter((p: any) => !existingIds.has(p.id))
      .map((p: any) => ({
        season_team_id: params.seasonTeamId,
        player_id: p.id,
        jersey_number: defaultJersey ?? p.jersey_number ?? null,
        position: defaultPosition || p.position || null,
        status: "active",
      }));

    if (rows.length > 0) {
      const { error } = await sb.from("season_team_players").insert(rows);
      if (error) {
        logApiError("season_team_player_register_error", error);
        return json({ error: "Failed to register players." }, { status: 500 });
      }
    }

    logSecurityEvent("season_team_players_registered", {
      userId: auth.userId,
      orgId,
      seasonId: params.id,
      seasonTeamId: params.seasonTeamId,
      playerCount: rows.length,
    });

    const { data: registrations } = await sb
      .from("season_team_players")
      .select("*, player:player_id(id, name, position, jersey_number, photo_url)")
      .eq("season_team_id", params.seasonTeamId);

    return json({ players: registrations || [], registered: rows.length });
  } catch (error) {
    logApiError("season_team_player_register_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
