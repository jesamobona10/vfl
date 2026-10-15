import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/transfers/route";
import {
  ANONYMOUS,
  EMAILS,
  authzEnabled,
  authenticate,
  isDeniedStatus,
  isGuardRejected,
} from "../support/authz";

function getTransfers() {
  return GET();
}

describe.skipIf(!authzEnabled)("GET /api/transfers authorization", () => {
  it("rejects anonymous callers", async () => {
    await authenticate(ANONYMOUS);
    expect(isDeniedStatus((await getTransfers()).status)).toBe(true);
  });

  it("rejects an organization admin", async () => {
    await authenticate(EMAILS.orgAdminA);
    expect(isDeniedStatus((await getTransfers()).status)).toBe(true);
  });

  it("rejects an org member", async () => {
    await authenticate(EMAILS.orgPlayerA);
    expect(isDeniedStatus((await getTransfers()).status)).toBe(true);
  });

  it("rejects a team account", async () => {
    await authenticate(EMAILS.coachA);
    expect(isDeniedStatus((await getTransfers()).status)).toBe(true);
  });

  it("allows a super admin", async () => {
    await authenticate(EMAILS.superAdmin);
    expect(isGuardRejected((await getTransfers()).status)).toBe(false);
  });
});
