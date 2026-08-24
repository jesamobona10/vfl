import { createClient } from "@/lib/supabase/server";
import {
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  validatePassword,
} from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Sets a new password using the session created by the GoTrue recovery
 * link (see forgot-password). Requires an authenticated session — either
 * the recovery session itself or an existing logged-in session.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const limited = await rateLimit({
      key: `reset-password:${ip}`,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("reset_password_rate_limited", { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const password = parsed.data!.password;
    const passwordError = validatePassword(password);
    if (passwordError) {
      return json({ error: passwordError }, { status: 400 });
    }

    // Recovery-session flow: cookies carry the session established by
    // /auth/callback after exchanging the recovery code.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return json(
        { error: "Reset link is invalid or has expired. Request a new one." },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: password as string,
    });

    if (updateError) {
      logApiError("reset_password_update_failed", updateError, { ip, userId: user.id });
      return json({ error: "Unable to update password." }, { status: 500 });
    }

    // Revoke every session for this user (including the current recovery
    // session) so stolen sessions cannot survive a reset. Default scope is
    // already 'global'.
    await supabase.auth.signOut().catch(() => {});

    logSecurityEvent("password_reset_success", { ip, userId: user.id });

    return json({ success: true });
  } catch (error) {
    logApiError("reset_password_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
