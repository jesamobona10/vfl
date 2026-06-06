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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(sb: ReturnType<typeof createServiceRoleClient>, base: string): Promise<string> {
  let slug = slugify(base);
  if (!slug) slug = "org";
  let attempt = slug;
  for (let i = 1; i < 100; i++) {
    const { data } = await sb.from("organizations").select("id").eq("slug", attempt).maybeSingle();
    if (!data) return attempt;
    attempt = `${slug}-${i}`;
  }
  return `${slug}-${Date.now()}`;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `org-register:${ip}`,
      limit: 5,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("org_register_rate_limited", { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const orgName = asString(parsed.data!.orgName);
    const orgType = asString(parsed.data!.orgType);
    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const password = parsed.data!.password;
    const passwordError = validatePassword(password);

    if (!orgName || !orgType || !email || !isValidEmail(email) || passwordError) {
      return json(
        { error: passwordError || "orgName, orgType, email, and password are required." },
        { status: 400 }
      );
    }

    if (!["school", "academy", "club"].includes(orgType)) {
      return json({ error: "orgType must be school, academy, or club." }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
    });

    if (createError) {
      logSecurityEvent("org_register_auth_failed", { ip, email });
      return json({ error: "Unable to create account. Email may already be in use." }, { status: 400 });
    }

    const slug = await uniqueSlug(sb, orgName);

    const { data: org, error: orgError } = await sb
      .from("organizations")
      .insert({
        name: orgName,
        slug,
        type: orgType,
      })
      .select()
      .single();

    if (orgError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError("org_register_insert_failed", orgError, { ip, email });
      return json({ error: "Unable to create organization." }, { status: 500 });
    }

    const { error: memberError } = await sb
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: authUser.user.id,
        role: "owner",
      });

    if (memberError) {
      await sb.from("organizations").delete().eq("id", org.id);
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError("org_register_member_failed", memberError, { ip, email });
      return json({ error: "Unable to create organization membership." }, { status: 500 });
    }

    logSecurityEvent("org_registered", { ip, orgId: org.id, userId: authUser.user.id });

    return json({
      success: true,
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
      },
    });
  } catch (error) {
    logApiError("org_register_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
