import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/fixtures/[id]/report/analyses/[analysisId]/confirm/route";
import {
  ANONYMOUS,
  EMAILS,
  FIXTURE_A,
  authzEnabled,
  authenticate,
  isDeniedStatus,
  isGuardRejected,
  jsonRequest,
} from "../support/authz";

const routeParams = {
  params: Promise.resolve({ id: String(FIXTURE_A), analysisId: "9002" }),
};
const routeUrl = `http://localhost/api/fixtures/${FIXTURE_A}/report/analyses/9002/confirm`;

function confirmAnalysis() {
  return POST(jsonRequest(routeUrl, "POST", { events: [] }), routeParams);
}

describe.skipIf(!authzEnabled)("POST .../report/analyses/[analysisId]/confirm authorization", () => {
  it("rejects anonymous callers", async () => {
    await authenticate(ANONYMOUS);
    expect(isDeniedStatus((await confirmAnalysis()).status)).toBe(true);
  });

  it("rejects an org member who is not an admin", async () => {
    await authenticate(EMAILS.orgPlayerA);
    expect(isDeniedStatus((await confirmAnalysis()).status)).toBe(true);
  });

  it("rejects the owning team account (no org admin role)", async () => {
    await authenticate(EMAILS.coachA);
    expect(isDeniedStatus((await confirmAnalysis()).status)).toBe(true);
  });

  it("rejects a coach from another organization", async () => {
    await authenticate(EMAILS.coachB);
    expect(isDeniedStatus((await confirmAnalysis()).status)).toBe(true);
  });

  it("allows an organization admin", async () => {
    await authenticate(EMAILS.orgAdminA);
    expect(isGuardRejected((await confirmAnalysis()).status)).toBe(false);
  });

  it("allows a super admin", async () => {
    await authenticate(EMAILS.superAdmin);
    expect(isGuardRejected((await confirmAnalysis()).status)).toBe(false);
  });
});
