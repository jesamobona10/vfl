import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  writeAuditEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `fixture:start:${ip}:${auth.userId}`, limit: 60, windowMs: 60 * 60_000 });
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

    void writeAuditEvent(
      "fixture_live_started",
      auth.userId,
      orgId,
      { ip, fixtureId, competition_id: fixture.competition_id }
    ).catch(() => {});

    return json({ fixture: data });
  } catch (error) {
    logApiError("fixture_start_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
