import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
} from "@/lib/security";
import { resolveSeasonOrganization } from "@/lib/season-org";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { season, organizationId } = await resolveSeasonOrganization(sb, params.id);

    if (!season) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, organizationId as string);
    if (adminError) return json({ error: "Forbidden" }, { status: 403 });

    const { data: fullSeason } = await sb.from("seasons").select("*").eq("id", params.id).single();

    return json({ season: fullSeason || season });
  } catch (error) {
    logApiError("season_get_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({ key: `season_update:${ip}`, limit: 15, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { season, organizationId } = await resolveSeasonOrganization(sb, params.id);

    if (!season) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, organizationId as string);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const allowedFields = [
      "name",
      "short_name",
      "start_date",
      "end_date",
      "status",
      "is_current",
    ] as const;
    const update: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (parsed.data![field] !== undefined) {
        if (field === "short_name") {
          update[field] = asString(parsed.data![field] as string, 40) || null;
        } else if (field === "status") {
          const status = asString(parsed.data![field] as string, 20);
          if (
            status &&
            !["draft", "upcoming", "active", "completed", "archived"].includes(status)
          ) {
            return json(
              { error: "status must be draft, upcoming, active, completed, or archived." },
              { status: 400 }
            );
          }
          update[field] = status;
        } else {
          update[field] = parsed.data![field];
        }
      }
    }

    if (update.is_current === true) {
      await sb
        .from("seasons")
        .update({ is_current: false })
        .eq("competition_id", (season as any).competition_id)
        .eq("is_current", true);
      // Sync the competition's current season pointer (guide §24)
      await sb
        .from("competitions")
        .update({ current_season_id: params.id })
        .eq("id", (season as any).competition_id);
    } else if (update.is_current === false) {
      await sb
        .from("competitions")
        .update({ current_season_id: null })
        .eq("id", (season as any).competition_id)
        .eq("current_season_id", params.id);
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
