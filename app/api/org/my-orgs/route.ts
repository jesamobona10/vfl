import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: memberships } = await sb
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", auth!.userId);

    if (!memberships || memberships.length === 0) {
      return json({ orgs: [] });
    }

    const orgIds = memberships.map((m) => m.organization_id);

    const { data: orgs } = await sb
      .from("organizations")
      .select("*")
      .in("id", orgIds)
      .order("name");

    return json({ orgs: orgs || [] });
  } catch (error) {
    logApiError("my_orgs_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
