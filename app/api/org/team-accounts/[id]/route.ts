import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  validatePassword,
  writeAuditEvent,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();

    const { data: account } = await sb
      .from("team_accounts")
      .select("id, team_id, teams(organization_id)")
      .eq("id", params.id)
      .single();

    if (!account) {
      return json({ error: "Team account not found." }, { status: 404 });
    }

    const orgId = (account.teams as unknown as { organization_id: string } | null)?.organization_id;
    if (!orgId) {
      return json({ error: "Team account has no associated organization." }, { status: 400 });
    }

    const adminError = requireOrgAdmin(auth, orgId);
    if (adminError) {
      logSecurityEvent("org_team_account_reset_forbidden", {
        userId: auth.userId,
        accountId: params.id,
        orgId,
      });
      return adminError;
    }

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `org:team-accounts:reset:${ip}:${auth.userId}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("org_team_account_reset_rate_limited", { ip, userId: auth.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const newPassword = parsed.data!.password;
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return json({ error: passwordError }, { status: 400 });
    }

    const { error: updateError } = await sb.auth.admin.updateUserById(params.id, {
      password: newPassword as string,
    });

    if (updateError) {
      logApiError("org_team_account_reset_failed", updateError, {
        userId: auth.userId,
        accountId: params.id,
      });
      return json({ error: "Unable to reset password." }, { status: 500 });
    }

    logSecurityEvent("org_team_account_password_reset", {
      ip,
      userId: auth.userId,
      accountId: params.id,
    });
    writeAuditEvent("team_account_password_reset", auth.userId, orgId, {
      ip,
      accountId: params.id,
    });
    void writeAuditRecord({
      organizationId: orgId,
      actorId: auth.userId,
      actorRole: auth.isAdmin ? "super_admin" : `org_${auth.orgMembership?.role}`,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      resourceType: "TEAM_ACCOUNT",
      resourceId: params.id,
      description: `Reset password for team account #${params.id}`,
      ip,
    }).catch(() => {});

    return json({ success: true, message: "Password updated." });
  } catch (error) {
    logApiError("org_team_account_reset_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();

    const { data: account } = await sb
      .from("team_accounts")
      .select("id, team_id, teams(organization_id)")
      .eq("id", params.id)
      .single();

    if (!account) {
      return json({ error: "Team account not found." }, { status: 404 });
    }

    const orgId = (account.teams as unknown as { organization_id: string } | null)?.organization_id;
    if (!orgId) {
      return json({ error: "Team account has no associated organization." }, { status: 400 });
    }

    const adminError = requireOrgAdmin(auth, orgId);
    if (adminError) {
      logSecurityEvent("org_team_account_delete_forbidden", {
        userId: auth.userId,
        accountId: params.id,
        orgId,
      });
      return adminError;
    }

    const ip = getClientIp(_request);
    const limited = await rateLimit({
      key: `org:team-accounts:delete:${ip}:${auth.userId}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("org_team_account_delete_rate_limited", { ip, userId: auth.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const { error: deleteError } = await sb.auth.admin.deleteUser(params.id);

    if (deleteError) {
      logApiError("org_team_account_delete_failed", deleteError, {
        userId: auth.userId,
        accountId: params.id,
      });
      return json({ error: "Unable to deactivate team account." }, { status: 500 });
    }

    logSecurityEvent("org_team_account_deactivated", {
      ip,
      userId: auth.userId,
      accountId: params.id,
    });
    writeAuditEvent("team_account_deactivated", auth.userId, orgId, { ip, accountId: params.id });
    void writeAuditRecord({
      organizationId: orgId,
      actorId: auth.userId,
      actorRole: auth.isAdmin ? "super_admin" : `org_${auth.orgMembership?.role}`,
      action: AUDIT_ACTIONS.USER_DELETED,
      resourceType: "TEAM_ACCOUNT",
      resourceId: params.id,
      description: `Deactivated team account #${params.id}`,
      ip,
    }).catch(() => {});

    return json({ success: true });
  } catch (error) {
    logApiError("org_team_account_delete_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
