import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const username = asString(parsed.data!.username, 80)?.toUpperCase();
    const password = asString(parsed.data!.password, 128);

    if (!username || !/^[A-Z0-9-]{3,80}$/.test(username) || !password) {
      logSecurityEvent("invalid_team_login_payload", { ip });
      return json({ error: "Invalid username or password." }, { status: 400 });
    }

    const limited = rateLimit({
      key: `login:team:${ip}:${username}`,
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("team_login_rate_limited", { ip, username });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();
    const { data: account, error: accountError } = await sb
      .from("team_accounts")
      .select("id, username, display_name, team_id, role, organization_id, organizations(slug)")
      .eq("username", username)
      .single();

    if (accountError || !account) {
      logSecurityEvent("team_login_unknown_account", { ip, username });
      void writeAuditRecord({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorId: null,
        actorRole: "anonymous",
        resourceType: "AUTH",
        description: `Failed team login for unknown username ${username}`,
        success: false,
        ip,
      }).catch(() => {});
      return json({ error: "Invalid username or password." }, { status: 401 });
    }

    const email = `team_${username.toLowerCase()}@vfl.local`;

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logSecurityEvent("team_login_failed", { ip, username });
      void writeAuditRecord({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorId: account.id,
        actorRole: "team_account",
        resourceType: "AUTH",
        description: `Failed team login for ${username}`,
        success: false,
        ip,
      }).catch(() => {});
      return json({ error: "Invalid username or password." }, { status: 401 });
    }

    const org = account.organizations as unknown as { slug: string } | null;

    logSecurityEvent("team_login_succeeded", { ip, userId: authData.user.id });
    void writeAuditRecord({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      actorId: account.id,
      actorRole: "team_account",
      organizationId: (account as any).organization_id ?? null,
      resourceType: "AUTH",
      description: `Team login succeeded for ${username}`,
      success: true,
      ip,
    }).catch(() => {});
    return json({
      user: {
        id: account.id,
        username: account.username,
        displayName: account.display_name,
        teamId: account.team_id,
        role: account.role,
        orgSlug: org?.slug || null,
      },
    });
  } catch (error) {
    logApiError("team_login_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
