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
      logSecurityEvent("invalid_org_login_payload", { ip });
      return json({ error: "Invalid email or password." }, { status: 400 });
    }

    const limited = rateLimit({
      key: `login:org:${ip}:${email}`,
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("org_login_rate_limited", { ip, email });
      return rateLimitResponse(limited.resetAt);
    }

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      logSecurityEvent("org_login_failed", { ip, email });
      return json({ error: "Invalid email or password." }, { status: 401 });
    }

    const { data: memberships, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name, slug, type)")
      .eq("user_id", authData.user.id);

    if (memberError) {
      logApiError("org_login_membership_lookup_failed", memberError);
      await supabase.auth.signOut();
      return json({ error: "Unable to verify organization membership." }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      await supabase.auth.signOut();
      logSecurityEvent("org_login_no_membership", { ip, email, userId: authData.user.id });
      return json(
        { error: "No organization found for this account." },
        { status: 403 }
      );
    }

    const org = memberships[0].organizations as unknown as {
      name: string;
      slug: string;
      type: string;
    };

    logSecurityEvent("org_login_succeeded", {
      ip,
      userId: authData.user.id,
      orgId: memberships[0].organization_id,
      orgSlug: org.slug,
    });

    return json({
      user: {
        id: authData.user.id,
        email,
        role: "org_admin",
        orgRole: memberships[0].role,
        org: {
          id: memberships[0].organization_id,
          name: org.name,
          slug: org.slug,
          type: org.type,
        },
      },
    });
  } catch (error) {
    logApiError("org_login_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
