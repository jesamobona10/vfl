"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { can, type Actor, type CanAction, type CanResult } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";

/** Derive the current {@link Actor} from the auth store. */
export function useActor(): Actor {
  const isAdmin = useAppStore((s) => s.isAdmin);
  const userProfile = useAppStore((s) => s.userProfile);
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);

  return useMemo(
    () => ({
      isAdmin,
      role: currentTeamAccount ? "team_account" : (userProfile?.role ?? null),
      orgRole: (userProfile?.orgRole as OrgRole | undefined) ?? null,
      teamId: currentTeamAccount?.teamId ?? null,
    }),
    [isAdmin, userProfile, currentTeamAccount]
  );
}

/**
 * Check whether the current user may perform an action.
 *
 * @example
 * ```tsx
 * const { allowed } = useCan("competition.create");
 * ```
 */
export function useCan(action: CanAction): CanResult {
  const actor = useActor();
  return useMemo(() => can(actor, action), [actor, action]);
}
