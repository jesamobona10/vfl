import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireOrgAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id, name, slug, type, logo_url, public_player_names_enabled, settings")
      .eq("slug", params.slug)
      .maybeSingle();

    if (!org) return json({ error: "Organization not found." }, { status: 404 });
    return json({ organization: org });
  } catch (error) {
    logApiError("org_get_failed", error);
    return json({ error: "Unable to load organization." }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id, slug")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.public_player_names_enabled === "boolean") {
      updates.public_player_names_enabled = body.public_player_names_enabled;
    }
    if (body.settings !== undefined) {
      updates.settings = body.settings;
    }

    if (Object.keys(updates).length === 0) {
      return json({ organization: org });
    }

    const { data, error } = await sb
      .from("organizations")
      .update(updates)
      .eq("id", org.id)
      .select()
      .single();
    if (error) throw error;

    return json({ organization: data });
  } catch (error) {
    logApiError("org_patch_failed", error);
    return json({ error: "Unable to update organization." }, { status: 500 });
  }
}
