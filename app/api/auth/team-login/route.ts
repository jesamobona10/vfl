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
} from "@/lib/security";

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
      .select("id, username, display_name, team_id, role")
      .eq("username", username)
      .single();

    if (accountError || !account) {
      logSecurityEvent("team_login_unknown_account", { ip, username });
      return json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const email = `team_${username.toLowerCase()}@vfl.local`;

    const supabase = await createClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      logSecurityEvent("team_login_failed", { ip, username });
      return json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    logSecurityEvent("team_login_succeeded", { ip, userId: authData.user.id });
    return json({
      user: {
        id: account.id,
        username: account.username,
        displayName: account.display_name,
        teamId: account.team_id,
        role: account.role,
      },
    });
  } catch (error) {
    logApiError("team_login_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
