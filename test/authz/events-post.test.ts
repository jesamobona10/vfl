import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/fixtures/[id]/events/route";
import {
  ANONYMOUS,
  EMAILS,
  FIXTURE_A,
  PLAYER_A1,
  TEAM_A1,
  authzEnabled,
  authenticate,
  isDeniedStatus,
  isGuardRejected,
  jsonRequest,
} from "../support/authz";

const routeParams = { params: Promise.resolve({ id: String(FIXTURE_A) }) };
const routeUrl = `http://localhost/api/fixtures/${FIXTURE_A}/events`;
const validBody = { player_id: PLAYER_A1, team_id: TEAM_A1, type: "goal", minute: 12 };

function createEvent() {
  return POST(jsonRequest(routeUrl, "POST", validBody), routeParams);
}

describe.skipIf(!authzEnabled)("POST /api/fixtures/[id]/events authorization", () => {
  it("rejects anonymous callers", async () => {
    await authenticate(ANONYMOUS);
    expect(isDeniedStatus((await createEvent()).status)).toBe(true);
  });

  it("rejects an org member without team ownership", async () => {
    await authenticate(EMAILS.orgPlayerA);
    expect(isDeniedStatus((await createEvent()).status)).toBe(true);
  });

  it("rejects a coach from another organization", async () => {
    await authenticate(EMAILS.coachB);
    expect(isDeniedStatus((await createEvent()).status)).toBe(true);
  });

  it("allows the owning team account", async () => {
    await authenticate(EMAILS.coachA);
    expect(isGuardRejected((await createEvent()).status)).toBe(false);
  });

  it("allows an organization admin", async () => {
    await authenticate(EMAILS.orgAdminA);
    expect(isGuardRejected((await createEvent()).status)).toBe(false);
  });

  it("allows a super admin", async () => {
    await authenticate(EMAILS.superAdmin);
    expect(isGuardRejected((await createEvent()).status)).toBe(false);
  });
});
