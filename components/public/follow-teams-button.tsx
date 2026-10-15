"use client";

import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  readPublicPreferences,
  savePublicPreferences,
  type PublicPreferences,
} from "@/lib/public-preferences";

interface FollowTeamsButtonProps {
  organizationId: string;
  teamIds: number[];
  displayName?: string;
  className?: string;
}

/**
 * Quick "follow from the match centre" control. Updates the saved match
 * preferences (localStorage, plus the account record when signed in) and, if the
 * visitor already granted notification permission, re-syncs the push
 * subscription so the new teams start sending alerts.
 */
export function FollowTeamsButton({
  organizationId,
  teamIds,
  displayName,
  className,
}: FollowTeamsButtonProps) {
  const toast = useToast();
  const [preferences, setPreferences] = useState<PublicPreferences | null>(() =>
    typeof window === "undefined" ? null : readPublicPreferences()
  );
  const [busy, setBusy] = useState(false);

  const targetTeams = [...new Set(teamIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const sameOrg = preferences?.organizationId === organizationId;
  const followingAll = Boolean(sameOrg && preferences && preferences.teamIds.length === 0);
  const following = Boolean(
    sameOrg &&
      preferences &&
      (preferences.teamIds.length === 0 || targetTeams.every((id) => preferences.teamIds.includes(id)))
  );

  const syncPushSubscription = async (next: PublicPreferences) => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      await fetch("/api/public/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription.toJSON(), preferences: next }),
      });
    } catch {
      // Alerts still fall back to the saved preferences when re-sync fails.
    }
  };

  const handleClick = async () => {
    if (busy || followingAll || targetTeams.length === 0) return;
    setBusy(true);
    try {
      const current = readPublicPreferences();
      const base: PublicPreferences =
        current && current.organizationId === organizationId
          ? current
          : {
              displayName: current?.displayName || displayName || "",
              organizationId,
              teamIds: [],
              reminderMinutes: current?.reminderMinutes || [60, 30, 15],
            };

      let nextTeamIds: number[];
      if (following) {
        nextTeamIds = base.teamIds.filter((id) => !targetTeams.includes(id));
      } else if (base.teamIds.length === 0 && current?.organizationId === organizationId) {
        // Following every team already; keep it that way.
        nextTeamIds = [];
      } else {
        nextTeamIds = [...new Set([...base.teamIds, ...targetTeams])];
      }

      const next: PublicPreferences = { ...base, teamIds: nextTeamIds };
      savePublicPreferences(next);
      setPreferences(next);
      void syncPushSubscription(next);

      // Best-effort server sync for signed-in visitors; anonymous visitors 401.
      fetch("/api/public/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});

      toast.success(following ? "Team alerts turned off." : "Team alerts turned on.");
    } catch {
      toast.error("Could not update your team alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const label = followingAll
    ? "Following all teams"
    : following
      ? "Following"
      : "Follow this team";

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy || followingAll || targetTeams.length === 0}
      aria-pressed={following}
      className={
        className ??
        "inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-brand/30 hover:bg-surface-2 disabled:opacity-60"
      }
    >
      {following ? <BellOff size={16} /> : <Bell size={16} />}
      {busy ? "Saving…" : label}
    </button>
  );
}
