import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  getAuthContext,
  getClientIp,
  isValidEmail,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgMember,
  requireOrgOwner,
  writeAuditEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    if (!orgId) {
      return json({ error: "org_id query parameter is required." }, { status: 400 });
    }

    const memberError = requireOrgMember(auth, orgId);
    if (memberError) {
      logSecurityEvent("org_members_forbidden", {
        userId: auth?.userId,
        orgId,
        isAdmin: auth?.isAdmin,
        isMember: auth?.orgMembership?.organization_id === orgId,
      });
      return memberError;
    }

    const sb = createServiceRoleClient();

    const { data: members, error } = await sb
      .from("organization_members")
      .select("*")
      .eq("organization_id", orgId);

    if (error) {
      logApiError("org_members_error", error, { userId: auth!.userId, orgId });
      return json({ error: "Failed to fetch members." }, { status: 500 });
    }

    return json({ members: members || [] });
  } catch (error) {
    logApiError("org_members_error", error);
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
    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const role = asString(parsed.data!.role, 10) || "admin";

    if (!orgId || !email || !isValidEmail(email)) {
      return json({ error: "org_id and a valid email are required." }, { status: 400 });
    }

    if (!["admin", "coach", "player"].includes(role)) {
      return json({ error: "Role must be admin, coach, or player." }, { status: 400 });
    }

    const ownerError = requireOrgOwner(auth, orgId);
    if (ownerError) {
      logSecurityEvent("org_members_invite_forbidden", {
        userId: auth?.userId,
        orgId,
        role: auth?.orgMembership?.role,
      });
      return ownerError;
    }

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `org:members:invite:${ip}:${auth!.userId}`, limit: 20, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("org_members_invite_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();

    const { data: existingMember } = await sb
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", email)
      .maybeSingle();

    if (existingMember) {
      return json({ error: "User is already a member of this organization." }, { status: 409 });
    }

    const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1";
    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      logSecurityEvent("org_members_invite_auth_failed", { ip, email, orgId });
      return json({ error: "Unable to invite user. Check the email address." }, { status: 400 });
    }

    const { error: insertError } = await sb.from("organization_members").insert({
      organization_id: orgId,
      user_id: authUser.user.id,
      role,
    });

    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError("org_members_invite_insert_failed", insertError, { ip, orgId });
      return json({ error: "Unable to add member." }, { status: 500 });
    }

    logSecurityEvent("org_member_invited", { ip, userId: auth!.userId, invitedEmail: email, orgId, role });
    writeAuditEvent("org_member_invited", auth!.userId, orgId, { ip, email, role });
    return json({ success: true, message: "Member invited." });
  } catch (error) {
    logApiError("org_members_invite_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const userId = searchParams.get("user_id");

    if (!orgId || !userId) {
      return json({ error: "org_id and user_id are required." }, { status: 400 });
    }

    const ownerError = requireOrgOwner(auth, orgId);
    if (ownerError) {
      logSecurityEvent("org_members_remove_forbidden", {
        userId: auth?.userId,
        orgId,
        targetUserId: userId,
        role: auth?.orgMembership?.role,
      });
      return ownerError;
    }

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `org:members:remove:${ip}:${auth!.userId}`, limit: 20, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("org_members_remove_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();

    const { data: targetMember } = await sb
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!targetMember) {
      return json({ error: "Member not found." }, { status: 404 });
    }

    if (targetMember.role === "owner") {
      const { count } = await sb
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "owner");

      if (count !== null && count <= 1) {
        return json({ error: "Cannot remove the last owner of the organization." }, { status: 409 });
      }
    }

    const { error: deleteError } = await sb
      .from("organization_members")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (deleteError) {
      logApiError("org_members_remove_error", deleteError, { userId: auth!.userId, orgId, targetUserId: userId });
      return json({ error: "Failed to remove member." }, { status: 500 });
    }

    logSecurityEvent("org_member_removed", { ip, userId: auth!.userId, removedUserId: userId, orgId });
    writeAuditEvent("org_member_removed", auth!.userId, orgId, { ip, removedUserId: userId });
    return json({ success: true });
  } catch (error) {
    logApiError("org_members_remove_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
