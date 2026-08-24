import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; userId: string }> }
) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `admin_org_update_member:${ip}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const role = parsed.data!.role as string;
    if (!["owner", "admin", "coach", "player"].includes(role))
      return json({ error: "Role must be owner, admin, coach, or player." }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: existing } = await sb
      .from("organization_members")
      .select("id")
      .eq("organization_id", params.id)
      .eq("user_id", params.userId)
      .single();

    if (!existing) return json({ error: "Member not found." }, { status: 404 });

    const { data, error } = await sb
      .from("organization_members")
      .update({ role })
      .eq("organization_id", params.id)
      .eq("user_id", params.userId)
      .select()
      .single();

    if (error) {
      logApiError("admin_org_member_update_error", error);
      return json({ error: "Failed to update member role." }, { status: 500 });
    }

    return json({ member: data });
  } catch (error) {
    logApiError("admin_org_member_update_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; userId: string }> }
) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `admin_org_remove_member:${ip}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const sb = createServiceRoleClient();

    const { data: existing } = await sb
      .from("organization_members")
      .select("id")
      .eq("organization_id", params.id)
      .eq("user_id", params.userId)
      .single();

    if (!existing) return json({ error: "Member not found." }, { status: 404 });

    const { error } = await sb
      .from("organization_members")
      .delete()
      .eq("organization_id", params.id)
      .eq("user_id", params.userId);

    if (error) {
      logApiError("admin_org_member_delete_error", error);
      return json({ error: "Failed to remove member." }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    logApiError("admin_org_member_delete_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
