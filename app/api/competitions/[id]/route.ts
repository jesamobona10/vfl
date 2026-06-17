import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, logSecurityEvent, requireOrgAdmin, requireOrgMember } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const { data: competition, error } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const memberError = requireOrgMember(auth, competition.organization_id);
    if (memberError) {
      logSecurityEvent("competition_get_forbidden", {
        userId: auth.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
      });
      return memberError;
    }

    return json({ competition });
  } catch (error) {
    logApiError("competition_get_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();

    const { data: competition, error } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const memberError = requireOrgMember(auth, competition.organization_id);
    if (memberError) {
      logSecurityEvent("competition_get_forbidden", {
        userId: auth.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
      });
      return memberError;
    }

    const adminError = requireOrgAdmin(auth, competition.organization_id);
    if (adminError) {
      logSecurityEvent("competition_update_forbidden", {
        userId: auth.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
        isAdmin: auth.isAdmin,
      });
      return adminError;
    }

    const body = await request.json();

    const { data: updated, error: updateError } = await sb
      .from("competitions")
      .update(body)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      logApiError("competition_update_error", updateError, { userId: auth.userId, competitionId: params.id });
      return json({ error: "Failed to update competition." }, { status: 500 });
    }

    return json({ competition: updated });
  } catch (error) {
    logApiError("competition_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
