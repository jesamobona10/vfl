import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
  sanitizeText,
  validatePassword,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `account-create:${ip}:${auth!.userId}`,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("team_account_create_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const teamNameInput = asString(parsed.data!.teamName, 80);
    const password = parsed.data!.password;
    const teamId = asInteger(parsed.data!.teamId, 1);
    const passwordError = validatePassword(password);

    if (!teamNameInput || passwordError) {
      return json(
        { error: passwordError || "Team name is required." },
        { status: 400 }
      );
    }

    const teamName = sanitizeText(teamNameInput);
    const sb = createServiceRoleClient();

    const { count, error: countError } = await sb
      .from("team_accounts")
      .select("id", { count: "exact", head: true });

    if (countError) {
      logApiError("team_account_count_failed", countError);
      return json({ error: "Unable to create team account." }, { status: 500 });
    }

    const suffix = String((count || 0) + 1).padStart(3, "0");
    const username = `${teamName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-${suffix}`;
    const email = `team_${username.toLowerCase()}@vfl.local`;

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
    });

    if (createError) {
      logSecurityEvent("team_account_auth_create_failed", { ip, userId: auth!.userId });
      return json({ error: "Unable to create team account." }, { status: 400 });
    }

    const { error: insertError } = await sb.from("team_accounts").insert({
      id: authUser.user.id,
      username,
      display_name: teamName,
      team_id: teamId || null,
      role: "team_account",
      created_by: auth!.userId,
    });

    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError("team_account_insert_failed", insertError, { ip, userId: auth!.userId });
      return json({ error: "Unable to create team account." }, { status: 500 });
    }

    logSecurityEvent("team_account_created", { ip, userId: auth!.userId, accountId: authUser.user.id });
    return json({
      success: true,
      account: { username, displayName: teamName },
    });
  } catch (error) {
    logApiError("team_account_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
