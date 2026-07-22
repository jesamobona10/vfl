import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, getClientIp, json, logApiError, logSecurityEvent, parseJsonObject, rateLimit, rateLimitResponse, requireAdmin, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `admin:competitions:update:${ip}:${auth!.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_competition_update_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: existing } = await sb.from("competitions").select("id").eq("id", params.id).single();
    if (!existing) return json({ error: "Competition not found." }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (parsed.data!.name !== undefined) {
      const name = sanitizeText(parsed.data!.name as string);
      if (!name || name.length > 100) return json({ error: "Invalid name." }, { status: 400 });
      update.name = name;
    }
    if (parsed.data!.type !== undefined) {
      if (!["league", "cup", "friendly"].includes(parsed.data!.type as string)) return json({ error: "Invalid type." }, { status: 400 });
      update.type = parsed.data!.type;
    }
    if (parsed.data!.status !== undefined) {
      if (!["draft", "active", "completed", "archived"].includes(parsed.data!.status as string)) return json({ error: "Invalid status." }, { status: 400 });
      update.status = parsed.data!.status;
    }
    if (parsed.data!.season !== undefined) update.season = parsed.data!.season || null;
    if (parsed.data!.organization_id !== undefined) update.organization_id = parsed.data!.organization_id;
    if (parsed.data!.logo_url !== undefined) update.logo_url = parsed.data!.logo_url;

    if (Object.keys(update).length === 0) return json({ error: "No valid fields to update." }, { status: 400 });

    const { data, error } = await sb.from("competitions").update(update).eq("id", params.id).select().single();
    if (error) {
      logApiError("admin_competition_update_error", error);
      return json({ error: "Failed to update competition." }, { status: 500 });
    }

    return json({ competition: data });
  } catch (error) {
    logApiError("admin_competition_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `admin:competitions:delete:${ip}:${auth!.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_competition_delete_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();
    const { data: comp } = await sb.from("competitions").select("id").eq("id", params.id).single();
    if (!comp) return json({ error: "Competition not found." }, { status: 404 });

    const { error } = await sb.from("competitions").delete().eq("id", params.id);
    if (error) {
      logApiError("admin_competition_delete_error", error);
      return json({ error: "Failed to delete competition." }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    logApiError("admin_competition_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
