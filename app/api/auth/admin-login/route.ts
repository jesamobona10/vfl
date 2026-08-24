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
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

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

    const limited = await rateLimit({
      key: `login:admin:${ip}:${email}`,
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("admin_login_rate_limited", { ip, email });
      return rateLimitResponse(limited.resetAt);
    }

    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logSecurityEvent("admin_login_failed", { ip, email });
      void writeAuditRecord({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        actorId: null,
        actorRole: "anonymous",
        resourceType: "AUTH",
        description: `Failed admin login for ${email}`,
        success: false,
        ip,
      }).catch(() => {});
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
      return json({ error: "Not authorized as admin." }, { status: 403 });
    }

    logSecurityEvent("admin_login_succeeded", { ip, userId: adminUser.id });
    void writeAuditRecord({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      actorId: adminUser.id,
      actorRole: "super_admin",
      resourceType: "AUTH",
      description: `Admin login succeeded for ${adminUser.email}`,
      success: true,
      ip,
    }).catch(() => {});
    return json({
      user: { id: adminUser.id, email: adminUser.email, role: "super_admin" },
    });
  } catch (error) {
    logApiError("admin_login_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
