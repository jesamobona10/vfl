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
  { params }: { params: { id: string; seasonTeamId: string; playerRegistrationId: string } }
) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `season_team_player_unregister:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();

    const { data: reg } = await sb
      .from("season_team_players")
      .select("id, player_id, season_team_id")
      .eq("id", params.playerRegistrationId)
      .eq("season_team_id", params.seasonTeamId)
      .single();

    if (!reg) {
      return json({ error: "Player registration not found." }, { status: 404 });
    }

    const { organizationId } = await resolveSeasonTeamOrganization(sb, params.seasonTeamId);
    const adminError = requireOrgAdmin(auth, organizationId as string);
    if (adminError) {
      logSecurityEvent("season_team_player_unregister_forbidden", {
        userId: auth.userId,
        organizationId: organizationId as string,
        seasonTeamId: params.seasonTeamId,
      });
      return adminError;
    }

    const { error } = await sb
      .from("season_team_players")
      .delete()
      .eq("id", params.playerRegistrationId);

    if (error) {
      logApiError("season_team_player_unregister_error", error);
      return json({ error: "Failed to remove player registration." }, { status: 500 });
    }

    logSecurityEvent("season_team_player_unregistered", {
      userId: auth.userId,
      orgId: organizationId as string,
      seasonId: params.id,
      seasonTeamId: params.seasonTeamId,
      playerId: reg.player_id,
    });

    return json({ success: true });
  } catch (error) {
    logApiError("season_team_player_unregister_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
