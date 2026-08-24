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
  validatePassword,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `change_password:${ip}`, limit: 10, windowMs: 60 * 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const currentPassword = asString(parsed.data!.currentPassword, 128);
    const newPassword = parsed.data!.newPassword;

    if (!currentPassword || !newPassword) {
      return json({ error: "Current and new password are required." }, { status: 400 });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return json({ error: passwordError }, { status: 400 });

    // Re-authenticate to prove ownership of the account before rotating.
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyError) {
      logSecurityEvent("change_password_verify_failed", { ip, userId: session.user.id });
      // 403 (not 401) so the client-side auth guard does not force a logout loop
      return json({ error: "Current password is incorrect." }, { status: 403 });
    }

    const sb = createServiceRoleClient();
    const { error: updateError } = await sb.auth.admin.updateUserById(session.user.id, {
      password: newPassword as string,
    });
    if (updateError) {
      logApiError("change_password_update_failed", updateError, { ip, userId: session.user.id });
      return json({ error: "Unable to change password." }, { status: 500 });
    }

    // Clear any pending rotation flag on player profiles
    await sb
      .from("player_profiles")
      .update({ must_change_password: false })
      .eq("id", session.user.id);

    logSecurityEvent("password_changed", { ip, userId: session.user.id });
    return json({ success: true });
  } catch (error) {
    logApiError("change_password_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
