import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asOptionalString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `org_delete_fixtures:${ip}`, limit: 5, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const orgAdminError = requireOrgAdmin(auth, org.id);
    if (orgAdminError) {
      logSecurityEvent("org_delete_fixtures_forbidden", {
        userId: auth!.userId,
        slug: params.slug,
        orgId: org.id,
      });
      return orgAdminError;
    }

    let competitionId: string | null = null;
    let seasonId: string | null = null;
    try {
      const body = await request.json();
      competitionId = asOptionalString(body.competition_id, 64);
      seasonId = asOptionalString(body.season_id, 64);
    } catch {
      // body is optional
    }

    // IDOR guard: the referenced competition/season must belong to THIS org.
    // Without this, an org admin could pass another org's IDs and delete its
    // fixtures via the service-role client (which bypasses RLS).
    if (competitionId) {
      const { data: competition } = await sb
        .from("competitions")
        .select("id")
        .eq("id", competitionId)
        .eq("organization_id", org.id)
        .maybeSingle();
      if (!competition) {
        return json({ error: "Competition not found for this organization." }, { status: 404 });
      }
    }
    if (seasonId) {
      const { data: season } = await sb
        .from("seasons")
        .select("id, competition_id, competitions!inner(organization_id)")
        .eq("id", seasonId)
        .eq("competitions.organization_id", org.id)
        .maybeSingle();
      if (!season) {
        return json({ error: "Season not found for this organization." }, { status: 404 });
      }
      if (competitionId && season.competition_id !== competitionId) {
        return json({ error: "Season does not belong to this competition." }, { status: 400 });
      }
    }

    const { data: dbTeams } = await sb.from("teams").select("id").eq("organization_id", org.id);

    const teamIds = (dbTeams || []).map((t) => t.id);

    if (teamIds.length === 0) {
      return json({ success: true, deletedCount: 0 });
    }

    // Always constrain deletion to fixtures involving THIS org's teams, ANDed
    // with the optional competition/season filters.
    let query = sb.from("fixtures").delete();

    const conditions = teamIds
      .map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`)
      .join(",");
    query = query.or(conditions);

    if (competitionId) {
      query = query.eq("competition_id", competitionId);
    }

    if (seasonId) {
      query = query.eq("season_id", seasonId);
    }

    const { data: deleted, error } = await query.select("id");

    if (error) {
      logApiError("org_delete_fixtures_error", error);
      return json({ error: "Failed to delete fixtures." }, { status: 500 });
    }

    void writeAuditRecord({
      organizationId: org.id,
      actorId: auth!.userId,
      action: AUDIT_ACTIONS.FIXTURE_DELETED,
      resourceType: "FIXTURE",
      description: `Deleted ${deleted?.length || 0} fixtures from org ${params.slug}`,
      before: { count: deleted?.length || 0 },
      ip,
    }).catch(() => {});

    return json({ success: true, deletedCount: deleted?.length || 0 });
  } catch (error) {
    logApiError("org_delete_fixtures_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
