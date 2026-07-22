import { createClient } from "@/lib/supabase/server";
import {
  asInteger,
  getAuthContext,
  json,
  logApiError,
  parseJsonObject,
  requireAuth,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    if (auth!.isAdmin) {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        logApiError("notifications_admin_list_failed", error, { userId: auth!.userId });
        return json({ error: "Unable to load notifications." }, { status: 400 });
      }
      return json({ notifications: data });
    }

    if (auth!.orgMembership) {
      const { data: orgTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", auth!.orgMembership.organization_id);
      const teamIds = (orgTeams || []).map((t) => t.id);
      if (teamIds.length === 0) return json({ notifications: [] });
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .in("team_id", teamIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        logApiError("notifications_org_list_failed", error, { userId: auth!.userId });
        return json({ error: "Unable to load notifications." }, { status: 400 });
      }
      return json({ notifications: data });
    }

    const teamId = auth!.teamAccount?.team_id ?? null;
    if (!teamId) return json({ notifications: [] });
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      logApiError("notifications_team_list_failed", error, { userId: auth!.userId, teamId });
      return json({ error: "Unable to load notifications." }, { status: 400 });
    }
    return json({ notifications: data });
  } catch (error) {
    logApiError("notifications_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const rawIds = parsed.data!.ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 100) {
      return json({ error: "Invalid payload" }, { status: 400 });
    }
    const ids = rawIds.map((id) => asInteger(id, 1)).filter((id): id is number => id !== null);
    if (ids.length !== rawIds.length) return json({ error: "Invalid payload" }, { status: 400 });

    let query = supabase.from("notifications").update({ is_read: true }).in("id", ids);
    if (!auth!.isAdmin) {
      if (auth!.orgMembership) {
        const { data: orgTeams } = await supabase
          .from("teams")
          .select("id")
          .eq("organization_id", auth!.orgMembership.organization_id);
        const teamIds = (orgTeams || []).map((t) => t.id);
        if (teamIds.length > 0) query = query.in("team_id", teamIds);
        else return json({ error: "Forbidden" }, { status: 403 });
      } else {
        const teamId = auth!.teamAccount?.team_id;
        if (!teamId) return json({ error: "Forbidden" }, { status: 403 });
        query = query.eq("team_id", teamId);
      }
    }

    const { error } = await query;
    if (error) {
      logApiError("notifications_mark_read_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to update notifications." }, { status: 400 });
    }
    return json({ success: true });
  } catch (error) {
    logApiError("notifications_mark_read_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
