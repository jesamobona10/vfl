import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Invites and access for the caller's own team. Read-only: a coach can see who
 * else manages their team, but creating or revoking invites stays with org
 * admins so a coach cannot grant access to their team.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const teamId = auth!.teamAccount?.team_id;
    if (!teamId) {
      return json({ error: "This account is not assigned to a team." }, { status: 403 });
    }

    // Filter by team_id in application code rather than relying on the
    // coach-scoped invite policy: this route uses the service-role client,
    // which bypasses RLS, so the policy does not apply here.
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("team_account_invites")
      .select("id, email, role, claimed_at, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("team_invites_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load team access." }, { status: 500 });
    }

    const { data: accounts } = await sb
      .from("team_accounts")
      .select("id, display_name, username, role, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    return json({ invites: data || [], accounts: accounts || [] });
  } catch (error) {
    logApiError("team_invites_list_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
