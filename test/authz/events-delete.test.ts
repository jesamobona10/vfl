import { describe, expect, it } from "vitest";
import { DELETE } from "@/app/api/events/[id]/route";
import {
  ANONYMOUS,
  EMAILS,
  EVENT_A,
  authzEnabled,
  authenticate,
  isDeniedStatus,
  isGuardRejected,
} from "../support/authz";

const routeParams = { params: Promise.resolve({ id: String(EVENT_A) }) };
const routeUrl = `http://localhost/api/events/${EVENT_A}`;

function deleteEvent() {
  return DELETE(new Request(routeUrl, { method: "DELETE" }), routeParams);
}

describe.skipIf(!authzEnabled)("DELETE /api/events/[id] authorization", () => {
  it("rejects anonymous callers", async () => {
    await authenticate(ANONYMOUS);
    expect(isDeniedStatus((await deleteEvent()).status)).toBe(true);
  });

  it("rejects an org member without team ownership", async () => {
    await authenticate(EMAILS.orgPlayerA);
    expect(isDeniedStatus((await deleteEvent()).status)).toBe(true);
  });

  it("rejects a coach from another organization", async () => {
    await authenticate(EMAILS.coachB);
    expect(isDeniedStatus((await deleteEvent()).status)).toBe(true);
  });

  it("allows the owning team account", async () => {
    await authenticate(EMAILS.coachA);
    expect(isGuardRejected((await deleteEvent()).status)).toBe(false);
  });

  it("allows a super admin", async () => {
    await authenticate(EMAILS.superAdmin);
    expect(isGuardRejected((await deleteEvent()).status)).toBe(false);
  });
});
