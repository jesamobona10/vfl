import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();
    const { data: org, error } = await sb
      .from("organizations")
      .select("*")
      .eq("slug", params.slug)
      .single();

    if (error || !org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    return json({ org });
  } catch (error) {
    logApiError("org_get_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
