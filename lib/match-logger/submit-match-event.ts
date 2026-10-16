/**
 * The single write seam for the Match Logger.
 *
 * Every logger write (add, undo) flows through here so the offline queue can
 * later wrap these two functions. It calls the existing events endpoints
 * (`POST /api/fixtures/[id]/events`, `DELETE /api/events/[id]`) — the server
 * stays the source of truth.
 *
 * Each add carries a `clientEventId` (a UUID generated on the key press) so a
 * double tap or a retried request is idempotent: the API returns the row it
 * already stored instead of inserting a duplicate.
 *
 * @module match-logger/submit-match-event
 */

export interface ServerMatchEvent {
  id: number;
  match_id: number;
  player_id: number;
  team_id: number | null;
  event_type: string;
  minute: number | null;
  client_event_id?: string | null;
  created_at?: string;
}

export interface LogMatchEventInput {
  fixtureId: number;
  playerId: number;
  teamId: number;
  type: string;
  minute?: number;
  /** Client-generated UUID. Defaults to a fresh one when omitted. */
  clientEventId?: string;
}

/** Generate a client event id, falling back when `crypto.randomUUID` is absent. */
export function newClientEventId(): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  // RFC 4122 v4 fallback for older/insecure contexts.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Adds a match event via the existing events endpoint. Resolves with the
 * server row (including its id) or throws with the server error message.
 */
export async function submitMatchEvent(
  input: LogMatchEventInput
): Promise<ServerMatchEvent> {
  const clientEventId = input.clientEventId ?? newClientEventId();
  const res = await fetch(`/api/fixtures/${input.fixtureId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId: input.playerId,
      teamId: input.teamId,
      type: input.type,
      minute: input.minute,
      clientEventId,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || "Unable to save the event.");
  }
  const event = body?.event as ServerMatchEvent | undefined;
  if (!event?.id) {
    throw new Error("Unable to save the event.");
  }
  return event;
}

/** Removes a previously saved event by its server id (undo). */
export async function deleteMatchEvent(eventId: number): Promise<void> {
  const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Unable to remove the event.");
  }
}
