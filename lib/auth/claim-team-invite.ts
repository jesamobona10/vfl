import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { logApiError, logSecurityEvent, writeAuditRecord } from "@/lib/security";

export type ClaimedInvite = {
  teamId: number;
  organizationId: string;
  inviteRole: string;
  username: string;
  displayName: string;
};

type ClaimRow = {
  claimed_team_id: number;
  claimed_organization_id: string;
  claimed_invite_role: string;
  account_username: string;
  account_display_name: string;
};

/**
 * Redeem a pending coach invite for the currently signed-in user.
 *
 * Runs inside `resolveSession`, so it sits on the hot path of every
 * authenticated render. Callers must only reach this when no `team_accounts`
 * row already exists, which keeps the RPC cost to users who actually have
 * something to claim.
 *
 * The email is never passed in — the RPC re-derives it from the caller's own
 * verified `auth.users` record, so a user cannot claim an invite addressed to
 * somebody else. Returns null whenever there is simply nothing to claim, which
 * is the normal case and must never surface as an error.
 */
export async function claimTeamInvite(
  supabase: SupabaseClient,
  userId: string
): Promise<ClaimedInvite | null> {
  const { data, error } = await supabase.rpc("claim_team_account_invite");

  if (error) {
    // Losing a claim race, or having no invite at all, is routine. Anything
    // unexpected still gets recorded rather than propagated.
    logApiError("team_invite_claim_failed", error, { userId });
    return null;
  }

  const row = (data as ClaimRow[] | null)?.[0];
  if (!row) return null;

  const claimed: ClaimedInvite = {
    teamId: row.claimed_team_id,
    organizationId: row.claimed_organization_id,
    inviteRole: row.claimed_invite_role,
    username: row.account_username,
    displayName: row.account_display_name,
  };

  logSecurityEvent("team_invite_claimed", {
    userId,
    teamId: claimed.teamId,
    organizationId: claimed.organizationId,
  });

  void writeAuditRecord({
    organizationId: claimed.organizationId,
    actorId: userId,
    action: AUDIT_ACTIONS.USER_CREATED,
    resourceType: "TEAM_ACCOUNT",
    resourceId: userId,
    description: `Claimed team invite for team ${claimed.teamId}`,
    after: {
      teamId: claimed.teamId,
      inviteRole: claimed.inviteRole,
      displayName: claimed.displayName,
    },
    // The account actor is the coach themselves, so attribute the audit to
    // them; the inviting admin is already captured on the invite row.
    actorRole: "team_account",
  }).catch(() => {});

  return claimed;
}
