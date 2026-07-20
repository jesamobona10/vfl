import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, logSecurityEvent, requireOrgMember } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    if (!orgId) {
      return json({ error: "org_id query parameter is required." }, { status: 400 });
    }

    const memberError = requireOrgMember(auth, orgId);
    if (memberError) {
      logSecurityEvent("org_members_forbidden", {
        userId: auth?.userId,
        orgId,
        isAdmin: auth?.isAdmin,
        isMember: auth?.orgMembership?.organization_id === orgId,
      });
      return memberError;
    }

    const sb = createServiceRoleClient();

    const { data: members, error } = await sb
      .from("organization_members")
      .select("*")
      .eq("organization_id", orgId);

    if (error) {
      logApiError("org_members_error", error, { userId: auth!.userId, orgId });
      return json({ error: "Failed to fetch members." }, { status: 500 });
    }

    return json({ members: members || [] });
  } catch (error) {
    logApiError("org_members_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
