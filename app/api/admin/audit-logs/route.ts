import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { asInteger, getAuthContext, json, logApiError, requireAdmin } from "@/lib/security";
import { normalizeAction, actionLabel } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

type ActorIdentity = { label: string; role?: string | null };

async function resolveActors(
  sb: ReturnType<typeof createServiceRoleClient>,
  userIds: string[]
): Promise<Record<string, ActorIdentity>> {
  const map: Record<string, ActorIdentity> = {};
  if (!userIds.length) return map;

  const ids = Array.from(new Set(userIds));

  const [{ data: admins }, { data: teams }, { data: players }, { data: members }] =
    await Promise.all([
      sb.from("admin_users").select("id, email").in("id", ids),
      sb.from("team_accounts").select("id, display_name, username").in("id", ids),
      sb.from("player_profiles").select("id, display_name, username").in("id", ids),
      sb.from("organization_members").select("user_id, organizations(name)").in("user_id", ids),
    ]);

  for (const a of admins || [])
    map[a.id] = { label: a.email || "Super Admin", role: "super_admin" };
  for (const t of teams || [])
    map[t.id] = { label: t.display_name || t.username || "Team Account", role: "team_account" };
  for (const p of players || [])
    map[p.id] = { label: p.display_name || p.username || "Player", role: "player" };
  for (const m of members || []) {
    if (!map[m.user_id]) {
      const org = (m.organizations as unknown as { name?: string } | null)?.name;
      map[m.user_id] = { label: org ? `${org} Admin` : "Org Admin", role: "org_admin" };
    }
  }
  return map;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const url = new URL(request.url);
    const page = asInteger(url.searchParams.get("page"), 1, 10000) ?? 1;
    const limit = asInteger(url.searchParams.get("limit"), 1, 200) ?? 50;
    const skip = (page - 1) * limit;

    const action = url.searchParams.get("action");
    const eventType = url.searchParams.get("event_type");
    const resourceType = url.searchParams.get("resource_type");
    const orgId = url.searchParams.get("org_id");

    const sb = createServiceRoleClient();

    let query = sb
      .from("auth_audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(skip, skip + limit - 1);

    if (action) query = query.eq("action", normalizeAction(action));
    if (eventType) query = query.eq("event_type", eventType);
    if (resourceType) query = query.eq("resource_type", resourceType.toUpperCase());
    if (orgId) query = query.eq("organization_id", orgId);

    const { data: logs, error, count } = await query;

    if (error) {
      logApiError("admin_audit_logs_error", error);
      return json({ logs: [], total: 0 });
    }

    const raw = logs || [];
    const actors = await resolveActors(sb, raw.map((l: any) => l.user_id).filter(Boolean));

    const enriched = raw.map((l: any) => ({
      ...l,
      action: l.action || normalizeAction(l.event_type),
      label: actionLabel(l.action || normalizeAction(l.event_type)),
      actor: actors[l.user_id as string] || null,
    }));

    const { data: credLogs } = await sb
      .from("credential_generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    return json({
      logs: enriched,
      credentialLogs: credLogs || [],
      total: count ?? enriched.length,
      page,
      limit,
      pages: Math.ceil((count ?? enriched.length) / limit),
    });
  } catch (error) {
    logApiError("admin_audit_logs_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
