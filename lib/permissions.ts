/**
 * Client-side permission checks.
 *
 * Mirrors the server guards in `lib/security.ts` (`requireOrgAdmin`,
 * `ownsTeam`) so the UI hides or disables actions the same way the API
 * would reject them. Role gating uses the fine-grained `orgRole` (owner /
 * admin / coach / player) rather than the coarse session `role`, because the
 * session resolver labels every org member — coaches included — as
 * `role: "org_admin"`.
 */

import type { OrgRole, UserProfile } from "@/lib/types";

export type ActorRole = UserProfile["role"];

/** The current user as far as the client UI is concerned. */
export interface Actor {
  /** Super admin. */
  isAdmin: boolean;
  /** Coarse session role, or null when signed out. */
  role: ActorRole | null;
  /** Fine-grained org role (owner/admin/coach/player), when known. */
  orgRole: OrgRole | null;
  /** Team id when signed in as a team account. */
  teamId: number | null;
}

/**
 * Named actions the UI gates on.
 *
 * Keep these aligned with the server guards: anything that maps to
 * `requireOrgAdmin` is org-admin-only; `match.edit` mirrors the match-event
 * route's `requireOrgAdmin || ownsTeam`.
 */
export type CanAction =
  | "organization.manage"
  | "competition.create"
  | "competition.delete"
  | "competition.manage"
  | "fixtures.generate"
  | "fixtures.edit"
  | "match.edit"
  | "players.manage"
  | "teams.manage"
  | "teamAccounts.manage";

/** Outcome of a permission check. */
export interface CanResult {
  /** Whether the action may be performed. */
  allowed: boolean;
  /**
   * When `allowed` is false, an optional explanation to show beside a
   * disabled control. No reason means the role never has the action, so the
   * control should be hidden; a reason means the cause is temporary (e.g. an
   * expired entitlement) and the control should be shown disabled.
   */
  reason?: string;
}

/** True when the actor is an org owner/admin, or a super admin. */
export function isOrgAdminLike(actor: Actor): boolean {
  if (actor.isAdmin) return true;
  if (actor.role !== "org_admin") return false;
  // Legacy sessions that predate orgRole: fall back to the coarse check.
  if (actor.orgRole == null) return true;
  return actor.orgRole === "owner" || actor.orgRole === "admin";
}

/** True when the actor is signed in as a team account. */
export function isTeamAccountLike(actor: Actor): boolean {
  return actor.role === "team_account";
}

/**
 * Check whether the actor may perform an action.
 *
 * @param actor - The current user derived from the auth store.
 * @param action - The named action to check.
 */
export function can(actor: Actor, action: CanAction): CanResult {
  const orgAdmin = isOrgAdminLike(actor);

  switch (action) {
    case "match.edit":
      // Server allows org admins and the team account that owns either side.
      return { allowed: orgAdmin || isTeamAccountLike(actor) };
    case "organization.manage":
    case "competition.create":
    case "competition.delete":
    case "competition.manage":
    case "fixtures.generate":
    case "fixtures.edit":
    case "teamAccounts.manage":
      return { allowed: orgAdmin };
    case "players.manage":
      return { allowed: orgAdmin || isTeamAccountLike(actor) };
    case "teams.manage":
      return { allowed: orgAdmin };
    default: {
      const exhaustive: never = action;
      return { allowed: false, reason: `Unknown action: ${exhaustive}` };
    }
  }
}
