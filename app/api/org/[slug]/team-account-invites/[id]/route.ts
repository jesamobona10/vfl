import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  actorRole,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Revoke a pending invite. Only unclaimed invites can be revoked — once a coach
 * has signed in, their access lives in team_accounts and removing it is an
 * access-management action, not an invite cleanup.
 */
export async function DELETE(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await props.params;
  try {
    if (!UUID_RE.test(id)) {
      return json({ error: "Invalid invite id." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const { data: invite } = await sb
      .from("team_account_invites")
      .select("id, email, claimed_by, organization_id")
      .eq("id", id)
      .maybeSingle();

    // Scoped to the org as well as the id, so a valid invite from another
    // organization reads as "not found" rather than "forbidden".
    if (!invite || invite.organization_id !== org.id) {
      return json({ error: "Invite not found." }, { status: 404 });
    }
    if (invite.claimed_by) {
      return json(
        { error: "This invite has already been claimed and cannot be revoked here." },
        { status: 409 }
      );
    }

    const { error: deleteError } = await sb
      .from("team_account_invites")
      .delete()
      .eq("id", id)
      .is("claimed_by", null);

    if (deleteError) {
      logApiError("org_team_invite_revoke_failed", deleteError, { userId: auth!.userId });
      return json({ error: "Unable to revoke invite." }, { status: 500 });
    }

    logSecurityEvent("org_team_invite_revoked", {
      ip,
      userId: auth!.userId,
      organizationId: org.id,
      inviteId: id,
    });
    void writeAuditRecord({
      organizationId: org.id,
      actorId: auth!.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.USER_DELETED,
      resourceType: "TEAM_ACCOUNT_INVITE",
      resourceId: id,
      description: "Revoked pending coach invite",
      before: { email: invite.email },
      ip,
    }).catch(() => {});

    return json({ success: true });
  } catch (error) {
    logApiError("org_team_invite_revoke_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
