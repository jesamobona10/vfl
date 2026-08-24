import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidPlayerUsername, playerEmailFromUsername } from "@/lib/player-credentials";
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

    if (!username || !isValidPlayerUsername(username) || !password) {
      logSecurityEvent("invalid_player_login_payload", { ip });
      return json({ error: "Invalid username or password." }, { status: 400 });
    }

    const limited = await rateLimit({
      key: `login:player:${ip}:${username}`,
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("player_login_rate_limited", { ip, username });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();
    const { data: profileRow, error: profileLookupError } = await sb
      .from("player_profiles")
      .select("id, player_id, display_name, username, must_change_password")
      .eq("username", username)
      .single();

    if (profileLookupError || !profileRow) {
      logSecurityEvent("player_login_unknown_account", { ip, username });
      return json({ error: "Invalid username or password." }, { status: 401 });
    }

    const email = playerEmailFromUsername(username);

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      logSecurityEvent("player_login_failed", { ip, username });
      void writeAuditRecord({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorId: profileRow?.id ?? null,
        actorRole: "player",
        resourceType: "AUTH",
        description: `Failed player login for ${username}`,
        success: false,
        ip,
      }).catch(() => {});
      return json({ error: "Invalid username or password." }, { status: 401 });
    }

    if (authData.user.id !== profileRow.id) {
      logSecurityEvent("player_login_not_player", { ip, userId: authData.user.id });
      void writeAuditRecord({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorId: authData.user.id,
        actorRole: "player",
        resourceType: "AUTH",
        description: `Player login rejected: profile id mismatch for ${username}`,
        success: false,
        ip,
      }).catch(() => {});
      return json({ error: "Unauthorized." }, { status: 403 });
    }

    logSecurityEvent("player_login_succeeded", { ip, userId: authData.user.id });
    void writeAuditRecord({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      actorId: profileRow.id,
      actorRole: "player",
      resourceType: "AUTH",
      description: `Player login succeeded for ${username}`,
      success: true,
      ip,
    }).catch(() => {});
    return json({
      user: {
        id: authData.user.id,
        role: "player",
        playerId: profileRow.player_id,
        displayName: profileRow.display_name,
        username: profileRow.username,
        mustChangePassword: profileRow.must_change_password ?? false,
      },
    });
  } catch (error) {
    logApiError("player_login_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
