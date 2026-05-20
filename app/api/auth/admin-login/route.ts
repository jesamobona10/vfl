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
    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const password = asString(parsed.data!.password, 128);

    if (!email || !isValidEmail(email) || !password) {
      logSecurityEvent("invalid_admin_login_payload", { ip });
      return json({ error: "Invalid email or password." }, { status: 400 });
    }

    const limited = rateLimit({
      key: `login:admin:${ip}:${email}`,
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("admin_login_rate_limited", { ip, email });
      return rateLimitResponse(limited.resetAt);
    }

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      logSecurityEvent("admin_login_failed", { ip, email });
      return json({ error: "Invalid email or password." }, { status: 401 });
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("id", authData.user.id)
      .single();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      logSecurityEvent("non_admin_login_attempt", { ip, email, userId: authData.user.id });
      return json(
        { error: "Not authorized as admin." },
        { status: 403 }
      );
    }

    logSecurityEvent("admin_login_succeeded", { ip, userId: adminUser.id });
    return json({
      user: { id: adminUser.id, email: adminUser.email, role: "super_admin" },
    });
  } catch (error) {
    logApiError("admin_login_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
