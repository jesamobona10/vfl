import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
  validatePassword,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `signup:admin:${ip}`,
      limit: 3,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("admin_signup_rate_limited", { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const password = parsed.data!.password;
    const passwordError = validatePassword(password);

    if (!email || !isValidEmail(email) || passwordError) {
      logSecurityEvent("invalid_admin_signup_payload", { ip });
      return json(
        { error: passwordError || "A valid email is required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
    });

    if (createError) {
      logSecurityEvent("admin_signup_create_failed", { ip, email });
      return json({ error: "Unable to create admin account." }, { status: 400 });
    }

    const { error: insertError } = await sb
      .from("admin_users")
      .insert({ id: authUser.user.id, email });

    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      if (insertError.code === "23505") {
        logSecurityEvent("blocked_extra_admin_signup", { ip, email });
        return json(
          { error: "Admin already exists. Use login instead." },
          { status: 409 }
        );
      }
      logApiError("admin_signup_insert_failed", insertError, { ip, email });
      return json({ error: "Unable to create admin account." }, { status: 500 });
    }

    logSecurityEvent("admin_signup_succeeded", { ip, userId: authUser.user.id });
    return json({ success: true });
  } catch (error) {
    logApiError("admin_signup_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
