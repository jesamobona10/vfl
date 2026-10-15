import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  scheduled: [] as Array<() => unknown>,
  insert: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    h.scheduled.push(cb);
  },
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: () => ({ insert: h.insert }),
  }),
}));

vi.mock("@/lib/public-push", () => ({
  isPublicPushConfigured: () => true,
  sendPublicPushNow: h.push,
}));

import { dispatchNotification, dispatchMatchEvent } from "./dispatch";

async function flush() {
  const callbacks = h.scheduled.splice(0);
  await Promise.all(callbacks.map((cb) => cb()));
}

beforeEach(() => {
  h.scheduled = [];
  h.insert.mockReset().mockResolvedValue({ error: null });
  h.push.mockReset().mockResolvedValue({});
});

describe("dispatchNotification", () => {
  it("fans out to the in-app and push channels after the response", async () => {
    await dispatchNotification({
      idempotencyKey: "fan-out-1",
      inApp: [{ teamId: 7, type: "player_transfer_in", payload: { player_id: 1 } }],
      push: { title: "Goal", body: "1-0", matchId: 3, tag: "match-3-event-9" },
    });

    expect(h.insert).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();

    await flush();

    expect(h.insert).toHaveBeenCalledWith({
      team_id: 7,
      type: "player_transfer_in",
      payload: { player_id: 1 },
    });
    expect(h.push).toHaveBeenCalledTimes(1);
  });

  it("ignores a re-dispatch of the same idempotency key", async () => {
    const event = {
      idempotencyKey: "dupe-1",
      inApp: [{ teamId: 1, type: "t", payload: {} }],
    };

    await dispatchNotification(event);
    await dispatchNotification(event);

    expect(h.scheduled).toHaveLength(1);
    await flush();
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("keeps push delivery working when the in-app channel fails", async () => {
    h.insert.mockResolvedValue({ error: { message: "boom" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await dispatchNotification({
      idempotencyKey: "isolation-1",
      inApp: [{ teamId: 1, type: "t", payload: {} }],
      push: { title: "Goal", body: "1-0", matchId: 3, tag: "match-3-event-10" },
    });
    await flush();

    expect(h.push).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Notification channel "in-app" failed',
      expect.objectContaining({ channel: "in-app", idempotencyKey: "isolation-1" })
    );

    errorSpy.mockRestore();
  });
});

describe("dispatchMatchEvent", () => {
  it("uses the push tag as the idempotency key", async () => {
    dispatchMatchEvent({ title: "Full-time", body: "2-1", matchId: 5, tag: "match-5-fulltime" });
    dispatchMatchEvent({ title: "Full-time", body: "2-1", matchId: 5, tag: "match-5-fulltime" });

    expect(h.scheduled).toHaveLength(1);
    await flush();
    expect(h.push).toHaveBeenCalledTimes(1);
  });
});
