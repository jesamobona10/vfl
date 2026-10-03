import { after } from "next/server";
import webpush, { WebPushError } from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PublicPushPayload {
  title: string;
  body: string;
  matchId: number;
  /** When set, deliver event alerts only to followers of this team. */
  teamId?: number;
  /** Only deliver to endpoints that enabled this scheduled kickoff reminder. */
  reminderMinutes?: 15 | 30 | 60;
  /**
   * Unique per logical alert. Android silently replaces a notification that
   * reuses an existing tag, so goals, cards and reminders each need their own
   * tag to raise a banner instead of only updating the shade entry.
   */
  tag?: string;
}

function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function isPublicPushConfigured() {
  return vapidConfig() !== null;
}

async function deliverPublicPush(payload: PublicPushPayload) {
  const config = vapidConfig();
  if (!config) return { eligible: 0, delivered: 0, failed: 0 };

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const supabase = createServiceRoleClient();
  const { data: match, error: matchError } = await supabase
    .from("public_matches")
    .select("organization_id, home_team_id, away_team_id, status")
    .eq("match_id", payload.matchId)
    .maybeSingle();
  if (matchError) throw matchError;
  if (!match?.organization_id) return { eligible: 0, delivered: 0, failed: 0 };
  if (payload.reminderMinutes && match.status !== "scheduled") return { eligible: 0, delivered: 0, failed: 0 };

  const { data: subscriptions, error } = await supabase
    .from("public_push_subscriptions")
    .select("endpoint, p256dh, auth, display_name, team_ids, reminder_minutes")
    .eq("organization_id", match.organization_id)
    .limit(5000);

  if (error) throw error;
  if (!subscriptions?.length) return { eligible: 0, delivered: 0, failed: 0 };

  const relevantTeamIds = payload.teamId
    ? [payload.teamId]
    : [match.home_team_id, match.away_team_id].filter((id): id is number => typeof id === "number");
  const matchedSubscriptions = subscriptions.filter((subscription) => {
    const selectedTeams = (subscription.team_ids || []) as number[];
    const selectedReminders = (subscription.reminder_minutes || [60, 30, 15]) as number[];
    const followsTeam = selectedTeams.length === 0 || relevantTeamIds.some((teamId) => selectedTeams.includes(teamId));
    return followsTeam && (!payload.reminderMinutes || selectedReminders.includes(payload.reminderMinutes));
  });
  if (!matchedSubscriptions.length) return { eligible: 0, delivered: 0, failed: 0 };

  const results = await Promise.allSettled(
    matchedSubscriptions.map((subscription) => {
      const name = typeof subscription.display_name === "string" ? subscription.display_name.trim() : "";
      const body = JSON.stringify({
        title: payload.title,
        body: name ? `${name}, ${payload.body}` : payload.body,
        url: `/public/live/${payload.matchId}`,
        tag: payload.tag || `match-${payload.matchId}`,
      });
      return webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
        { TTL: 60 * 60, urgency: "high" }
      );
    })
  );

  const expiredEndpoints = results.flatMap((result, index) => {
    if (
      result.status === "rejected" &&
      result.reason instanceof WebPushError &&
      (result.reason.statusCode === 404 || result.reason.statusCode === 410)
    ) {
      return [matchedSubscriptions[index].endpoint];
    }
    return [];
  });

  if (expiredEndpoints.length) {
    await supabase.from("public_push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }

  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > expiredEndpoints.length) {
    console.error("Some public match push notifications could not be delivered", {
      failed: failed - expiredEndpoints.length,
      total: matchedSubscriptions.length,
      matchId: payload.matchId,
    });
  }
  return {
    eligible: matchedSubscriptions.length,
    delivered: results.filter((result) => result.status === "fulfilled").length,
    failed,
  };
}

export function sendPublicPushNow(payload: PublicPushPayload) {
  return deliverPublicPush(payload);
}

/** Deliver after the API response so push providers don't slow match edits. */
export function enqueuePublicPush(payload: PublicPushPayload) {
  if (!vapidConfig()) return;
  after(async () => {
    try {
      await deliverPublicPush(payload);
    } catch {
      // Push errors can contain subscriber endpoints; keep them out of application logs.
      console.error("Public match push dispatch failed", { matchId: payload.matchId });
    }
  });
}

export function isSupportedPushEndpoint(rawEndpoint: unknown): rawEndpoint is string {
  if (typeof rawEndpoint !== "string" || rawEndpoint.length > 4096) return false;
  try {
    const endpoint = new URL(rawEndpoint);
    const host = endpoint.hostname.toLowerCase();
    return (
      endpoint.protocol === "https:" &&
      (host === "fcm.googleapis.com" ||
        host === "web.push.apple.com" ||
        host === "push.services.mozilla.com" ||
        host.endsWith(".push.services.mozilla.com") ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
