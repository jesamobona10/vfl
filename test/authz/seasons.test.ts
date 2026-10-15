import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/seasons/[id]/route";
import {
  ANONYMOUS,
  EMAILS,
  SEASON_A,
  authzEnabled,
  authenticate,
  isDeniedStatus,
  isGuardRejected,
} from "../support/authz";

const routeParams = { params: Promise.resolve({ id: SEASON_A }) };
const routeUrl = `http://localhost/api/seasons/${SEASON_A}`;

function getSeason() {
  return GET(new Request(routeUrl), routeParams);
}

describe.skipIf(!authzEnabled)("GET /api/seasons/[id] authorization", () => {
  it("rejects anonymous callers", async () => {
    await authenticate(ANONYMOUS);
    expect(isDeniedStatus((await getSeason()).status)).toBe(true);
  });

  it("rejects an org member who is not an admin", async () => {
    await authenticate(EMAILS.orgPlayerA);
    expect(isDeniedStatus((await getSeason()).status)).toBe(true);
  });

  it("rejects a coach from the owning organization", async () => {
    await authenticate(EMAILS.coachA);
    expect(isDeniedStatus((await getSeason()).status)).toBe(true);
  });

  it("rejects a coach from another organization", async () => {
    await authenticate(EMAILS.coachB);
    expect(isDeniedStatus((await getSeason()).status)).toBe(true);
  });

  it("allows an organization admin", async () => {
    await authenticate(EMAILS.orgAdminA);
    expect(isGuardRejected((await getSeason()).status)).toBe(false);
  });

  it("allows a super admin", async () => {
    await authenticate(EMAILS.superAdmin);
    expect(isGuardRejected((await getSeason()).status)).toBe(false);
  });
});
