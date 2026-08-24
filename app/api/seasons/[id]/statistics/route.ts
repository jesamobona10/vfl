import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireOrgMember } from "@/lib/security";
import { resolveSeasonOrganization } from "@/lib/season-org";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { season, organizationId } = await resolveSeasonOrganization(sb, params.id);

    if (!season) return json({ error: "Season not found." }, { status: 404 });

    const memberError = requireOrgMember(auth, organizationId as string);
    if (memberError) return memberError;

    // Season-scoped player statistics (guide §15). Computed from
    // match_events (which carry season_id) via the RPC functions.
    const { data: goalsByPlayer, error: goalsError } = await sb.rpc("season_player_goals", {
      season_uuid: params.id,
    });
    if (goalsError) {
      logApiError("season_statistics_rpc_error", goalsError);
    }

    const { data: playerStats, error: statsError } = await sb.rpc("season_player_stats", {
      season_uuid: params.id,
    });
    if (statsError) {
      logApiError("season_statistics_rpc_error", statsError);
    }

    return json({
      statistics: {
        goals_by_player: goalsByPlayer || [],
        player_stats: playerStats || [],
      },
    });
  } catch (error) {
    logApiError("season_statistics_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
