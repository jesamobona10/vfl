import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { asInteger, getAuthContext, json, logApiError, requireOrgMember } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const memberError = requireOrgMember(auth, org.id);
    if (memberError) return memberError;

    const url = new URL(request.url);
    const limit = asInteger(url.searchParams.get("limit"), 1, 200) ?? 50;
    const eventType = url.searchParams.get("event_type");

    let query = sb
      .from("auth_audit_logs")
      .select("*")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (eventType) query = query.eq("event_type", eventType);

    const { data: logs, error } = await query;

    if (error) {
      logApiError("org_audit_logs_error", error);
      return json({ logs: [] });
    }

    return json({ logs: logs || [] });
  } catch (error) {
    logApiError("org_audit_logs_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
