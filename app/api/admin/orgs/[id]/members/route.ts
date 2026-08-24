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

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const sb = createServiceRoleClient();
    const { data: members, error } = await sb
      .from("organization_members")
      .select("*, auth_users:user_id(email)")
      .eq("organization_id", params.id)
      .order("created_at");

    if (error) {
      logApiError("admin_org_members_list_error", error);
      return json({ error: "Failed to list members." }, { status: 500 });
    }

    return json({ members: members || [] });
  } catch (error) {
    logApiError("admin_org_members_list_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `admin_org_add_member:${ip}`, limit: 10, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const userId = parsed.data!.user_id as string;
    const role = parsed.data!.role as string;

    if (!userId) return json({ error: "User ID is required." }, { status: 400 });
    if (!["owner", "admin", "coach", "player"].includes(role))
      return json({ error: "Role must be owner, admin, coach, or player." }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: existing } = await sb
      .from("organization_members")
      .select("id")
      .eq("organization_id", params.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing)
      return json({ error: "User is already a member of this organization." }, { status: 409 });

    const { data, error } = await sb
      .from("organization_members")
      .insert({ organization_id: params.id, user_id: userId, role })
      .select()
      .single();

    if (error) {
      logApiError("admin_org_member_add_error", error);
      return json({ error: "Failed to add member." }, { status: 500 });
    }

    return json({ member: data });
  } catch (error) {
    logApiError("admin_org_member_add_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
