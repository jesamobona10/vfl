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
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

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
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
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
    const limited = await rateLimit({
      key: `org:members:invite:${ip}:${auth!.userId}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("org_members_invite_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();

    // SECURITY: previously this compared user_id (a UUID) with an email and
    // created accounts whose random passwords were never delivered anywhere.
    // Now: send a real Supabase invite email when the user is new, or attach
    // an existing account by its actual user id.
    const findUserIdByEmail = async (
      targetEmail: string
    ): Promise<string | null> => {
      const perPage = 200;
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
        if (error) return null;
        const match = data.users.find(
          (u) => u.email?.toLowerCase() === targetEmail
        );
        if (match) return match.id;
        if (data.users.length < perPage) break;
      }
      return null;
    };

    const invitedUserId = await findUserIdByEmail(email);
    let createdAuthUserId: string | null = null;

    let userIdForMembership = invitedUserId;
    if (!userIdForMembership) {
      const { data: invited, error: inviteError } = await sb.auth.admin.inviteUserByEmail(
        email
      );
      if (inviteError || !invited.user) {
        logApiError("org_members_invite_send_failed", inviteError ?? new Error("no user"), {
          ip,
          email,
          orgId,
        });
        return json(
          { error: "Unable to send invite email. Check the email address." },
          { status: 400 }
        );
      }
      createdAuthUserId = invited.user.id;
      userIdForMembership = invited.user.id;
    } else {
      const { data: existingMember } = await sb
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("user_id", userIdForMembership)
        .maybeSingle();

      if (existingMember) {
        return json({ error: "User is already a member of this organization." }, { status: 409 });
      }
    }

    const { error: insertError } = await sb.from("organization_members").insert({
      organization_id: orgId,
      user_id: userIdForMembership,
      role,
    });

    if (insertError) {
      // Only clean up accounts we just created — never delete pre-existing users.
      if (createdAuthUserId) {
        await sb.auth.admin.deleteUser(createdAuthUserId);
      }
      logApiError("org_members_invite_insert_failed", insertError, { ip, orgId });
      return json({ error: "Unable to add member." }, { status: 500 });
    }

    logSecurityEvent("org_member_invited", {
      ip,
      userId: auth!.userId,
      invitedEmail: email,
      orgId,
      role,
    });
    writeAuditEvent("org_member_invited", auth!.userId, orgId, { ip, email, role });
    void writeAuditRecord({
      organizationId: orgId,
      actorId: auth!.userId,
      actorRole: auth!.isAdmin ? "super_admin" : `org_${auth!.orgMembership?.role}`,
      action: AUDIT_ACTIONS.USER_CREATED,
      resourceType: "ORG_MEMBER",
      resourceId: userIdForMembership,
      description: `Invited ${email} to the organization as ${role}`,
      after: { email, role },
      ip,
    }).catch(() => {});
    return json({ success: true, message: "Member invited." });
  } catch (error) {
    logApiError("org_members_invite_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
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
    const limited = await rateLimit({
      key: `org:members:remove:${ip}:${auth!.userId}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
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
        return json(
          { error: "Cannot remove the last owner of the organization." },
          { status: 409 }
        );
      }
    }

    const { error: deleteError } = await sb
      .from("organization_members")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (deleteError) {
      logApiError("org_members_remove_error", deleteError, {
        userId: auth!.userId,
        orgId,
        targetUserId: userId,
      });
      return json({ error: "Failed to remove member." }, { status: 500 });
    }

    logSecurityEvent("org_member_removed", {
      ip,
      userId: auth!.userId,
      removedUserId: userId,
      orgId,
    });
    writeAuditEvent("org_member_removed", auth!.userId, orgId, { ip, removedUserId: userId });
    void writeAuditRecord({
      organizationId: orgId,
      actorId: auth!.userId,
      actorRole: auth!.isAdmin ? "super_admin" : `org_${auth!.orgMembership?.role}`,
      action: AUDIT_ACTIONS.USER_DELETED,
      resourceType: "ORG_MEMBER",
      resourceId: userId,
      description: `Removed a member (${userId}) from the organization`,
      before: { role: targetMember.role },
      ip,
    }).catch(() => {});
    return json({ success: true });
  } catch (error) {
    logApiError("org_members_remove_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
