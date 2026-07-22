import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireOrgAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id");
    if (!orgId) {
      return json({ error: "org_id query parameter is required." }, { status: 400 });
    }

    const adminError = requireOrgAdmin(auth, orgId);
    if (adminError) return adminError;

    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
    const eventType = url.searchParams.get("event_type");

    const sb = createServiceRoleClient();

    let query = sb
      .from("auth_audit_logs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventType) query = query.eq("event_type", eventType);

    const { data: logs, error } = await query;

    if (error) {
      logApiError("org_audit_logs_error", error, { userId: auth!.userId, orgId });
      return json({ logs: [] });
    }

    return json({ logs: logs || [] });
  } catch (error) {
    logApiError("org_audit_logs_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
