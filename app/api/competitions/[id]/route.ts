import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();
    const { data: competition, error } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !competition) {
      return json({ error: "Competition not found." }, { status: 404 });
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

    const body = await request.json();
    const sb = createServiceRoleClient();

    const { data: competition, error } = await sb
      .from("competitions")
      .update(body)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      logApiError("competition_update_error", error);
      return json({ error: "Failed to update competition." }, { status: 500 });
    }

    return json({ competition });
  } catch (error) {
    logApiError("competition_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
