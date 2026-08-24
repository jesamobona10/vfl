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
  validatePassword,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `player_register:${ip}`, limit: 5, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("player_register_rate_limited", { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const password = parsed.data!.password;
    const displayName = sanitizeText(asString(parsed.data!.displayName, 80) || "");

    const passwordError = validatePassword(password);
    if (!email || passwordError) {
      logSecurityEvent("invalid_player_register_payload", { ip, email });
      return json({ error: passwordError || "Valid email required." }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
    });

    if (createError) {
      logApiError("player_register_create_user_failed", createError, { ip, email });
      return json({ error: "Unable to create player account." }, { status: 400 });
    }

    // NOTE: linking to an existing `players` row is intentionally NOT supported
    // here. Claiming an existing player identity requires a verified invite
    // token issued by the organization; accepting a client-supplied player_id
    // would allow anyone to take over any player's profile and stats.
    const insert: Record<string, unknown> = {
      id: authUser.user.id,
      display_name: displayName || email,
    };

    const { error: insertError } = await sb.from("player_profiles").insert(insert);
    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError("player_register_insert_profile_failed", insertError, {
        ip,
        userId: authUser.user.id,
      });
      return json({ error: "Unable to create player profile." }, { status: 500 });
    }

    logSecurityEvent("player_register_succeeded", { ip, userId: authUser.user.id });
    return json({ success: true });
  } catch (error) {
    logApiError("player_register_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
