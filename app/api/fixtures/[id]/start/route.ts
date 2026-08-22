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

export const dynamic = "force-dynamic";

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
      .select("home_team_id, away_team_id, status, competition_id")
      .eq("id", fixtureId)
      .single();

    if (fixtureError || !fixture) {
      return json({ error: "Fixture not found." }, { status: 404 });
    }

    const { data: homeTeam } = await supabase
      .from("teams")
      .select("organization_id")
      .eq("id", fixture.home_team_id)
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
    const { data, error } = await sb
      .from("fixtures")
      .update({
        status: "live",
        live_started_at: new Date().toISOString(),
      })
      .eq("id", fixtureId)
      .select()
      .single();

    if (error) {
      logApiError("fixture_start_failed", error, { userId: auth.userId, fixtureId });
      return json({ error: "Unable to start the match." }, { status: 400 });
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
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
