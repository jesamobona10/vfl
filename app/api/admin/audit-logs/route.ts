import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
    const eventType = url.searchParams.get("event_type");

    const sb = createServiceRoleClient();

    let query = sb
      .from("auth_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventType) query = query.eq("event_type", eventType);

    const { data: logs, error } = await query;

    if (error) {
      logApiError("admin_audit_logs_error", error);
      return json({ logs: [] });
    }

    const { data: credLogs } = await sb
      .from("credential_generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    return json({ logs: logs || [], credentialLogs: credLogs || [] });
  } catch (error) {
    logApiError("admin_audit_logs_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
