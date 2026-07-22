import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  getAuthContext,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  requireOrgAdmin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: season, error } = await sb
      .from("seasons")
      .select("*, competition:competitions(organization_id)")
      .eq("id", params.id)
      .single();

    if (error || !season) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, (season.competition as any).organization_id);
    if (adminError) return json({ error: "Forbidden" }, { status: 403 });

    return json({ season });
  } catch (error) {
    logApiError("season_get_error", error);
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

    const sb = createServiceRoleClient();
    const { data: season } = await sb
      .from("seasons")
      .select("*, competition:competitions(organization_id)")
      .eq("id", params.id)
      .single();

    if (!season) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, (season.competition as any).organization_id);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const allowedFields = ["name", "start_date", "end_date", "status", "is_current"] as const;
    const update: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (parsed.data![field] !== undefined) {
        update[field] = parsed.data![field];
      }
    }

    if (update.is_current === true) {
      await sb
        .from("seasons")
        .update({ is_current: false })
        .eq("competition_id", (season as any).competition_id)
        .eq("is_current", true);
    }

    if (Object.keys(update).length === 0) {
      return json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data: updated, error } = await sb
      .from("seasons")
      .update(update)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      logApiError("season_update_error", error);
      return json({ error: "Failed to update season." }, { status: 500 });
    }

    return json({ season: updated });
  } catch (error) {
    logApiError("season_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
