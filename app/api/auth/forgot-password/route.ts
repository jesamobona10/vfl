import { createClient } from "@/lib/supabase/server";
import {
  asString,
  getClientIp,
  isValidEmail,
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

    const limited = await rateLimit({
      key: `forgot-password:${ip}`,
      limit: 3,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("forgot_password_rate_limited", { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    if (!email || !isValidEmail(email)) {
      return json({ error: "Valid email is required." }, { status: 400 });
    }

    // Native GoTrue recovery flow: Supabase emails the user a one-time link.
    // The link lands on /auth/callback?next=/auth/reset, which exchanges the
    // code for a session; the new password is then set via /api/auth/reset-password.
    // NOTE: the redirect URL must be allowlisted in Supabase Auth settings.
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
    });

    if (error) {
      logApiError("forgot_password_send_failed", error, { ip, email });
      // Do not surface whether the account exists (no user enumeration).
    } else {
      logSecurityEvent("forgot_password_email_sent", { ip });
    }

    return json({ success: true });
  } catch (error) {
    logApiError("forgot_password_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
