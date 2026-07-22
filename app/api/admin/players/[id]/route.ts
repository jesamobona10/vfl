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
    const limited = rateLimit({ key: `admin:players:update:${ip}:${auth!.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_player_update_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: existing } = await sb.from("players").select("id").eq("id", params.id).single();
    if (!existing) return json({ error: "Player not found." }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (parsed.data!.name !== undefined) {
      const name = sanitizeText(parsed.data!.name as string);
      if (!name || name.length > 100) return json({ error: "Invalid name." }, { status: 400 });
      update.name = name;
    }
    if (parsed.data!.position !== undefined) {
      if (!["GK", "DEF", "MID", "ATT"].includes(parsed.data!.position as string)) return json({ error: "Invalid position." }, { status: 400 });
      update.position = parsed.data!.position;
    }
    if (parsed.data!.jersey_number !== undefined) {
      const n = Number(parsed.data!.jersey_number);
      if (isNaN(n) || n < 0 || n > 99) return json({ error: "Jersey number must be 0-99." }, { status: 400 });
      update.jersey_number = n;
    }
    if (parsed.data!.team_id !== undefined) update.team_id = Number(parsed.data!.team_id);
    if (parsed.data!.rating !== undefined) update.rating = Number(parsed.data!.rating);
    if (parsed.data!.photo_url !== undefined) update.photo_url = parsed.data!.photo_url;
    if (parsed.data!.goals !== undefined) update.goals = Number(parsed.data!.goals);
    if (parsed.data!.assists !== undefined) update.assists = Number(parsed.data!.assists);
    if (parsed.data!.yellow_cards !== undefined) update.yellow_cards = Number(parsed.data!.yellow_cards);
    if (parsed.data!.red_cards !== undefined) update.red_cards = Number(parsed.data!.red_cards);

    if (Object.keys(update).length === 0) return json({ error: "No valid fields to update." }, { status: 400 });

    const { data, error } = await sb.from("players").update(update).eq("id", params.id).select().single();
    if (error) {
      logApiError("admin_player_update_error", error);
      return json({ error: "Failed to update player." }, { status: 500 });
    }

    return json({ player: data });
  } catch (error) {
    logApiError("admin_player_update_error", error);
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
    const limited = rateLimit({ key: `admin:players:delete:${ip}:${auth!.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_player_delete_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();
    const { data: player } = await sb.from("players").select("id").eq("id", params.id).single();
    if (!player) return json({ error: "Player not found." }, { status: 404 });

    const { error } = await sb.from("players").delete().eq("id", params.id);
    if (error) {
      logApiError("admin_player_delete_error", error);
      return json({ error: "Failed to delete player." }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    logApiError("admin_player_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
