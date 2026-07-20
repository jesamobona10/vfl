import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, parseJsonObject, requireAdmin, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: existing } = await sb.from("teams").select("id").eq("id", params.id).single();
    if (!existing) return json({ error: "Team not found." }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (parsed.data!.name !== undefined) {
      const name = sanitizeText(parsed.data!.name as string);
      if (!name || name.length > 80) return json({ error: "Invalid name." }, { status: 400 });
      update.name = name;
    }
    if (parsed.data!.rating !== undefined) {
      const rating = Number(parsed.data!.rating);
      if (isNaN(rating) || rating < 0 || rating > 10) return json({ error: "Rating must be 0-10." }, { status: 400 });
      update.rating = rating;
    }
    if (parsed.data!.logo_url !== undefined) update.logo_url = parsed.data!.logo_url;
    if (parsed.data!.organization_id !== undefined) update.organization_id = parsed.data!.organization_id;

    if (Object.keys(update).length === 0) return json({ error: "No valid fields to update." }, { status: 400 });

    const { data, error } = await sb.from("teams").update(update).eq("id", params.id).select().single();
    if (error) {
      logApiError("admin_team_update_error", error);
      if (error.code === "23505") return json({ error: "A team with this name already exists." }, { status: 409 });
      return json({ error: "Failed to update team." }, { status: 500 });
    }

    return json({ team: data });
  } catch (error) {
    logApiError("admin_team_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const sb = createServiceRoleClient();
    const { data: team } = await sb.from("teams").select("id").eq("id", params.id).single();
    if (!team) return json({ error: "Team not found." }, { status: 404 });

    const { error } = await sb.from("teams").delete().eq("id", params.id);
    if (error) {
      logApiError("admin_team_delete_error", error);
      return json({ error: "Failed to delete team." }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    logApiError("admin_team_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
