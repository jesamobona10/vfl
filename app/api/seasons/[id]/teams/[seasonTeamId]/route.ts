import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
} from "@/lib/security";
import { resolveSeasonTeamOrganization } from "@/lib/season-org";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; seasonTeamId: string }> }
) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `season_team_unregister:${ip}`, limit: 30, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();

    const { data: seasonTeam } = await sb
      .from("season_teams")
      .select("id, season_id, team_id")
      .eq("id", params.seasonTeamId)
      .eq("season_id", params.id)
      .single();

    if (!seasonTeam) {
      return json({ error: "Season team not found." }, { status: 404 });
    }

    const { organizationId } = await resolveSeasonTeamOrganization(sb, params.seasonTeamId);
    const adminError = requireOrgAdmin(auth, organizationId as string);
    if (adminError) {
      logSecurityEvent("season_team_unregister_forbidden", {
        userId: auth.userId,
        seasonId: params.id,
        organizationId: organizationId as string,
      });
      return adminError;
    }

    // Guard: cannot unregister a team that has fixtures or players in this season
    const { data: fixtures } = await sb
      .from("fixtures")
      .select("id")
      .eq("season_id", params.id)
      .or(`home_team_id.eq.${seasonTeam.team_id},away_team_id.eq.${seasonTeam.team_id}`)
      .limit(1);

    if (fixtures && fixtures.length > 0) {
      return json(
        {
          error:
            "Cannot unregister this team: it has fixtures in this season. Delete its fixtures first.",
        },
        { status: 409 }
      );
    }

    const { data: players } = await sb
      .from("season_team_players")
      .select("id")
      .eq("season_team_id", params.seasonTeamId)
      .limit(1);

    if (players && players.length > 0) {
      return json(
        { error: "Cannot unregister this team: it has registered players this season." },
        { status: 409 }
      );
    }

    const { error } = await sb.from("season_teams").delete().eq("id", params.seasonTeamId);

    if (error) {
      logApiError("season_team_unregister_error", error);
      return json({ error: "Failed to unregister team." }, { status: 500 });
    }

    logSecurityEvent("season_team_unregistered", {
      userId: auth.userId,
      orgId: organizationId as string,
      seasonId: params.id,
      seasonTeamId: params.seasonTeamId,
      teamId: seasonTeam.team_id,
    });

    return json({ success: true });
  } catch (error) {
    logApiError("season_team_unregister_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
