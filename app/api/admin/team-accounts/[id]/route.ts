import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
  writeAuditEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `admin:team-accounts:delete:${ip}:${auth!.userId}`, limit: 30, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_team_account_delete_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();

    const { data: account } = await sb
      .from("team_accounts")
      .select("id, username, team_id, teams(organization_id)")
      .eq("id", params.id)
      .single();

    if (!account) {
      return json({ error: "Team account not found." }, { status: 404 });
    }

    const orgId = (account.teams as unknown as { organization_id: string } | null)?.organization_id || null;

    const { error: deleteError } = await sb.auth.admin.deleteUser(params.id);

    if (deleteError) {
      logApiError("admin_team_account_delete_failed", deleteError, { userId: auth!.userId, accountId: params.id });
      return json({ error: "Unable to delete team account." }, { status: 500 });
    }

    logSecurityEvent("admin_team_account_deleted", {
      ip,
      userId: auth!.userId,
      accountId: params.id,
      username: account.username,
    });
    writeAuditEvent("team_account_deactivated", auth!.userId, orgId || undefined, { ip, accountId: params.id, username: account.username });

    return json({ success: true });
  } catch (error) {
    logApiError("admin_team_account_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
