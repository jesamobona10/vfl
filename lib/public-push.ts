import { after } from "next/server";
import webpush, { WebPushError } from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface PublicPushPayload {
  title: string;
  body: string;
  matchId: number;
}

function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

async function deliverPublicPush(payload: PublicPushPayload) {
  const config = vapidConfig();
  if (!config) return;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const supabase = createServiceRoleClient();
  const { data: subscriptions, error } = await supabase
    .from("public_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .limit(5000);

  if (error) throw error;
  if (!subscriptions?.length) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: `/public/live/${payload.matchId}`,
    tag: `match-${payload.matchId}`,
  });

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
        { TTL: 60 * 60, urgency: "high" }
      )
    )
  );

  const expiredEndpoints = results.flatMap((result, index) => {
    if (
      result.status === "rejected" &&
      result.reason instanceof WebPushError &&
      (result.reason.statusCode === 404 || result.reason.statusCode === 410)
    ) {
      return [subscriptions[index].endpoint];
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
      total: subscriptions.length,
      matchId: payload.matchId,
    });
  }
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
