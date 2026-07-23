import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, logSecurityEvent, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
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

    if (!auth!.isAdmin && (!auth!.orgMembership || auth!.orgMembership.organization_id !== org.id || !["owner", "admin"].includes(auth!.orgMembership.role))) {
      logSecurityEvent("org_delete_fixtures_forbidden", {
        userId: auth!.userId, slug: params.slug, orgId: org.id,
      });
      return json({ error: "Forbidden" }, { status: 403 });
    }

    let competitionId: string | null = null;
    try {
      const body = await request.json();
      competitionId = body.competition_id || null;
    } catch {
      // body is optional
    }

    const { data: dbTeams } = await sb
      .from("teams")
      .select("id")
      .eq("organization_id", org.id);

    const teamIds = (dbTeams || []).map((t) => t.id);

    if (teamIds.length === 0) {
      return json({ success: true, deletedCount: 0 });
    }

    let query = sb.from("fixtures").delete();

    if (competitionId) {
      query = query.eq("competition_id", competitionId);
    } else {
      const conditions = teamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(",");
      query = query.or(conditions);
    }

    const { data: deleted, error } = await query.select("id");

    if (error) {
      logApiError("org_delete_fixtures_error", error);
      return json({ error: "Failed to delete fixtures." }, { status: 500 });
    }

    return json({ success: true, deletedCount: deleted?.length || 0 });
  } catch (error) {
    logApiError("org_delete_fixtures_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
