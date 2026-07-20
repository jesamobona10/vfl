import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, parseJsonObject, requireAdmin, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const sb = createServiceRoleClient();
    const { data: org, error } = await sb.from("organizations").select("*").eq("id", params.id).single();

    if (error || !org) return json({ error: "Organization not found." }, { status: 404 });

    const [{ count: teamCount }, { count: memberCount }, { count: compCount }] = await Promise.all([
      sb.from("teams").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
      sb.from("organization_members").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
      sb.from("competitions").select("*", { count: "exact", head: true }).eq("organization_id", org.id),
    ]);

    return json({ org: { ...org, teamCount: teamCount ?? 0, memberCount: memberCount ?? 0, competitionCount: compCount ?? 0 } });
  } catch (error) {
    logApiError("admin_org_get_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: existing } = await sb.from("organizations").select("id").eq("id", params.id).single();
    if (!existing) return json({ error: "Organization not found." }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (parsed.data!.name !== undefined) {
      const name = sanitizeText(parsed.data!.name as string);
      if (!name || name.length > 100) return json({ error: "Invalid name." }, { status: 400 });
      update.name = name;
    }
    if (parsed.data!.type !== undefined) {
      if (!["school", "academy", "club"].includes(parsed.data!.type as string)) return json({ error: "Invalid type." }, { status: 400 });
      update.type = parsed.data!.type;
    }
    if (parsed.data!.slug !== undefined) {
      const slug = (parsed.data!.slug as string || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!slug || slug.length < 2 || slug.length > 60) return json({ error: "Invalid slug." }, { status: 400 });
      const { data: dup } = await sb.from("organizations").select("id").eq("slug", slug).neq("id", params.id).maybeSingle();
      if (dup) return json({ error: "Slug already taken." }, { status: 409 });
      update.slug = slug;
    }
    if (parsed.data!.logo_url !== undefined) update.logo_url = parsed.data!.logo_url;

    if (Object.keys(update).length === 0) return json({ error: "No valid fields to update." }, { status: 400 });

    const { data, error } = await sb.from("organizations").update(update).eq("id", params.id).select().single();
    if (error) {
      logApiError("admin_org_update_error", error);
      return json({ error: "Failed to update organization." }, { status: 500 });
    }

    return json({ org: data });
  } catch (error) {
    logApiError("admin_org_update_error", error);
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

    const { data: org } = await sb.from("organizations").select("id").eq("id", params.id).single();
    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const { error } = await sb.from("organizations").delete().eq("id", params.id);
    if (error) {
      logApiError("admin_org_delete_error", error);
      return json({ error: "Failed to delete organization." }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    logApiError("admin_org_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
