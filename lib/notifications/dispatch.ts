import { after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  isPublicPushConfigured,
  sendPublicPushNow,
  type PublicPushPayload,
} from "@/lib/public-push";

/** One in-app notification row to create (`notifications` table). */
export interface InAppNotification {
  teamId: number;
  type: string;
  payload: Record<string, unknown>;
}

/** A single logical notification event that fans out to every channel. */
export interface NotificationEvent {
  /** Stable id for the source event. Re-dispatching the same key is a no-op. */
  idempotencyKey: string;
  /** In-app rows to insert. */
  inApp?: InAppNotification[];
  /** Optional public web-push alert for the same source event. */
  push?: PublicPushPayload;
}

/**
 * A delivery channel. Adapters implement this so a new channel (e.g. WhatsApp)
 * can be dropped in without touching call sites.
 */
export interface NotificationChannel {
  name: string;
  send(event: NotificationEvent): Promise<void>;
}

const inAppChannel: NotificationChannel = {
  name: "in-app",
  async send(event) {
    const targets = event.inApp ?? [];
    if (!targets.length) return;
    const supabase = createServiceRoleClient();
    const failures: string[] = [];
    for (const target of targets) {
      const { error } = await supabase.from("notifications").insert({
        team_id: target.teamId,
        type: target.type,
        payload: target.payload,
      });
      if (error) failures.push(`${target.type}@team${target.teamId}: ${error.message}`);
    }
    if (failures.length) throw new Error(failures.join("; "));
  },
};

const pushChannel: NotificationChannel = {
  name: "push",
  async send(event) {
    if (!event.push) return;
    if (!isPublicPushConfigured()) return;
    await sendPublicPushNow(event.push);
  },
};

const CHANNELS: NotificationChannel[] = [inAppChannel, pushChannel];

/**
 * In-memory idempotency guard.
 *
 * Tags are stable per source event (a match, a match event id), so a retried
 * request re-uses the same key and does not fan out twice. The map is
 * per-process and expires after a short window; a cross-invocation retry on a
 * cold serverless instance can still re-send, which is the accepted trade-off
 * for keeping this free of extra schema.
 */
const recentKeys = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function claimKey(key: string): boolean {
  const now = Date.now();
  for (const [k, at] of recentKeys) {
    if (now - at > IDEMPOTENCY_TTL_MS) recentKeys.delete(k);
  }
  if (recentKeys.has(key)) return false;
  recentKeys.set(key, now);
  return true;
}

/**
 * Fan an event out to every channel after the response, isolating failures so
 * one channel (e.g. a flaky push provider) never blocks the others or the
 * request. Safe to call from a route handler; it returns immediately.
 */
export async function dispatchNotification(event: NotificationEvent): Promise<void> {
  if (!claimKey(event.idempotencyKey)) return;

  after(async () => {
    const results = await Promise.allSettled(CHANNELS.map((channel) => channel.send(event)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Notification channel "${CHANNELS[index].name}" failed`, {
          channel: CHANNELS[index].name,
          idempotencyKey: event.idempotencyKey,
          reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });
  });
}

/**
 * Convenience wrapper for a public match-event push alert. The push `tag` is
 * already unique per source event, so it doubles as the idempotency key.
 */
export function dispatchMatchEvent(payload: PublicPushPayload): void {
  const idempotencyKey = payload.tag ?? `match-${payload.matchId}`;
  void dispatchNotification({ idempotencyKey, push: payload });
}
