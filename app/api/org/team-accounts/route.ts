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
  requireOrgAdmin,
  sanitizeText,
  validatePassword,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id");
    if (!orgId) return json({ error: "org_id is required" }, { status: 400 });

    const authError = requireOrgAdmin(auth, orgId);
    if (authError) return authError;

    const sb = createServiceRoleClient();
    const { data: teams } = await sb
      .from("teams")
      .select("id")
      .eq("organization_id", orgId);
    const teamIds = (teams || []).map((t) => t.id);

    let query = sb
      .from("team_accounts")
      .select("id, username, display_name, team_id, role, created_at, teams(name)")
      .order("created_at", { ascending: false });

    if (teamIds.length > 0) {
      query = query.in("team_id", teamIds);
    } else {
      return json({ accounts: [] });
    }

    const { data, error } = await query;
    if (error) {
      logApiError("org_team_accounts_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load team accounts." }, { status: 500 });
    }

    return json({ accounts: data });
  } catch (error) {
    logApiError("org_team_accounts_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const orgId = asString(parsed.data!.org_id, 64);
    if (!orgId) return json({ error: "org_id is required." }, { status: 400 });

    const authError = requireOrgAdmin(auth, orgId);
    if (authError) return authError;

    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `org-account-create:${ip}:${auth!.userId}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("org_team_account_create_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

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

    const { data: orgTeam } = await sb
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!orgTeam) {
      return json({ error: "Team not found in your organization." }, { status: 400 });
    }

    const { count, error: countError } = await sb
      .from("team_accounts")
      .select("id", { count: "exact", head: true });

    if (countError) {
      logApiError("org_team_account_count_failed", countError);
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
      logSecurityEvent("org_team_account_auth_create_failed", { ip, userId: auth!.userId });
      return json({ error: "Unable to create team account." }, { status: 400 });
    }

    const { error: insertError } = await sb.from("team_accounts").insert({
      id: authUser.user.id,
      username,
      display_name: teamName,
      team_id: teamId,
      role: "team_account",
      created_by: auth!.userId,
    });

    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError("org_team_account_insert_failed", insertError, { ip, userId: auth!.userId });
      return json({ error: "Unable to create team account." }, { status: 500 });
    }

    logSecurityEvent("org_team_account_created", { ip, userId: auth!.userId, accountId: authUser.user.id });
    return json({
      success: true,
      account: { username, displayName: teamName },
    });
  } catch (error) {
    logApiError("org_team_account_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
