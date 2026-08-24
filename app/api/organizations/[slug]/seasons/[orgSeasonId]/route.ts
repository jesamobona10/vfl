import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asOptionalString,
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
  requireOrgMember,
} from "@/lib/security";

const ALLOWED_STATUSES = ["draft", "upcoming", "active", "completed", "archived"] as const;

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string; orgSeasonId: string }> }
) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const memberError = requireOrgMember(auth, org.id);
    if (memberError) return memberError;

    const { data: season } = await sb
      .from("organization_seasons")
      .select("*")
      .eq("id", params.orgSeasonId)
      .eq("organization_id", org.id)
      .single();

    if (!season) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    return json({ season });
  } catch (error) {
    logApiError("org_season_get_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ slug: string; orgSeasonId: string }> }
) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `org_season_update:${ip}`, limit: 60, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const { data: existing } = await sb
      .from("organization_seasons")
      .select("id")
      .eq("id", params.orgSeasonId)
      .eq("organization_id", org.id)
      .single();

    if (!existing) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const update: Record<string, unknown> = {};

    if (parsed.data!.name !== undefined) {
      const name = asString(parsed.data!.name, 80);
      if (!name) return json({ error: "Season name is required." }, { status: 400 });
      update.name = name;
    }
    if (parsed.data!.short_name !== undefined) {
      update.short_name = asOptionalString(parsed.data!.short_name, 40) || null;
    }
    if (parsed.data!.start_date !== undefined) {
      update.start_date = asOptionalString(parsed.data!.start_date, 10) || null;
    }
    if (parsed.data!.end_date !== undefined) {
      update.end_date = asOptionalString(parsed.data!.end_date, 10) || null;
    }
    if (parsed.data!.status !== undefined) {
      const status = asString(parsed.data!.status, 10);
      if (!ALLOWED_STATUSES.includes(status as any)) {
        return json({ error: "Invalid season status." }, { status: 400 });
      }
      update.status = status;
    }

    // Setting is_current clears it from all other org seasons (one current per org)
    if (parsed.data!.is_current === true) {
      await sb
        .from("organization_seasons")
        .update({ is_current: false })
        .eq("organization_id", org.id);
      update.is_current = true;
      update.status = update.status ?? "active";
    } else if (parsed.data!.is_current === false) {
      update.is_current = false;
    }

    if (Object.keys(update).length === 0) {
      return json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data: season, error } = await sb
      .from("organization_seasons")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", params.orgSeasonId)
      .select()
      .single();

    if (error) {
      logApiError("org_season_update_error", error);
      return json({ error: "Failed to update season." }, { status: 500 });
    }

    logSecurityEvent("org_season_updated", {
      ip,
      userId: auth!.userId,
      orgId: org.id,
      seasonId: params.orgSeasonId,
    });

    return json({ season });
  } catch (error) {
    logApiError("org_season_update_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ slug: string; orgSeasonId: string }> }
) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const { data: existing } = await sb
      .from("organization_seasons")
      .select("id")
      .eq("id", params.orgSeasonId)
      .eq("organization_id", org.id)
      .single();

    if (!existing) {
      return json({ error: "Season not found." }, { status: 404 });
    }

    const { error } = await sb.from("organization_seasons").delete().eq("id", params.orgSeasonId);

    if (error) {
      logApiError("org_season_delete_error", error);
      return json({ error: "Failed to delete season." }, { status: 500 });
    }

    logSecurityEvent("org_season_deleted", {
      userId: auth!.userId,
      orgId: org.id,
      seasonId: params.orgSeasonId,
    });

    return json({ success: true });
  } catch (error) {
    logApiError("org_season_delete_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
