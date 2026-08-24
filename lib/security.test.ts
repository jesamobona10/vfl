import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/security";

// lib/security.ts snapshots the Upstash env at import time; strip it so the
// in-memory fallback under test is deterministic.
let mod: typeof import("@/lib/security");
const sec = () => mod;

beforeAll(async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  mod = await import("@/lib/security");
});

function auth(partial: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    isAdmin: false,
    teamAccount: null,
    orgMembership: null,
    ...partial,
  };
}

describe("input coercion helpers", () => {
  it("asInteger accepts integer-ish values and honors bounds", () => {
    const { asInteger } = sec();
    expect(asInteger(5)).toBe(5);
    expect(asInteger("12")).toBe(12);
    expect(asInteger("  7 ")).toBe(7);
    expect(asInteger(1.5)).toBeNull();
    expect(asInteger("abc")).toBeNull();
    expect(asInteger(null)).toBeNull();
    expect(asInteger(undefined)).toBeNull();
    expect(asInteger(10, 1, 5)).toBeNull();
    expect(asInteger(3, 1, 5)).toBe(3);
    expect(asInteger(-2, 0)).toBeNull();
  });

  it("asString trims and enforces max length", () => {
    const { asString } = sec();
    expect(asString("  hello  ")).toBe("hello");
    expect(asString("")).toBeNull();
    expect(asString("   ")).toBeNull();
    expect(asString(42 as unknown)).toBeNull();
    expect(asString("abcdef", 3)).toBeNull();
    expect(asString("abc", 3)).toBe("abc");
  });

  it("asOptionalString maps null/undefined/empty to null", () => {
    const { asOptionalString } = sec();
    expect(asOptionalString(null)).toBeNull();
    expect(asOptionalString(undefined)).toBeNull();
    expect(asOptionalString("")).toBeNull();
    expect(asOptionalString("x")).toBe("x");
  });

  it("asBoolean only accepts real booleans", () => {
    const { asBoolean } = sec();
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean(false)).toBe(false);
    expect(asBoolean("true")).toBeNull();
    expect(asBoolean(1)).toBeNull();
  });
});

describe("validation helpers", () => {
  it("isValidEmail", () => {
    const { isValidEmail } = sec();
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
    expect(isValidEmail(`${"x".repeat(250)}@b.co`)).toBe(false);
  });

  it("validatePassword enforces the documented policy", () => {
    const { validatePassword } = sec();
    expect(validatePassword("Str0ngPassw0rd!")).toBeNull();
    expect(validatePassword(undefined)).toMatch(/required/i);
    expect(validatePassword(123 as unknown)).toMatch(/required/i);
    expect(validatePassword("short1A")).toMatch(/at least 12/);
    expect(validatePassword("a".repeat(129))).toMatch(/too long/i);
    expect(validatePassword("alllowercase123")).toMatch(/uppercase/i);
    expect(validatePassword("ALLUPPERCASE123")).toMatch(/lowercase/i);
    expect(validatePassword("NoDigitsHere!!")).toMatch(/numeric/i);
  });

  it("sanitizeText strips control characters and angle brackets", () => {
    const { sanitizeText } = sec();
    expect(sanitizeText("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
    expect(sanitizeText("hello\u0000\u001Fworld")).toBe("helloworld");
    expect(sanitizeText("  padded  ")).toBe("padded");
    expect(sanitizeText("café ☕")).toBe("café ☕");
  });
});

describe("client ip resolution", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const { getClientIp } = sec();
    const req = new Request("https://app.test/api/x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8", "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    const { getClientIp } = sec();
    const realOnly = new Request("https://app.test/api/x", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(realOnly)).toBe("9.9.9.9");

    const none = new Request("https://app.test/api/x");
    expect(getClientIp(none)).toBe("unknown");
  });
});

describe("auth context helpers", () => {
  it("ownsTeam: admins own everything, team accounts only their team", () => {
    const { ownsTeam } = sec();
    expect(ownsTeam(auth({ isAdmin: true }), 999)).toBe(true);
    expect(
      ownsTeam(auth({ teamAccount: { id: "t", team_id: 7, username: "u" } }), 7)
    ).toBe(true);
    expect(
      ownsTeam(auth({ teamAccount: { id: "t", team_id: 7, username: "u" } }), 8)
    ).toBe(false);
    expect(ownsTeam(auth(), 1)).toBe(false);
  });

  it("actorRole maps context shapes to audit labels", () => {
    const { actorRole } = sec();
    expect(actorRole(null)).toBe("anonymous");
    expect(actorRole(auth({ isAdmin: true }))).toBe("super_admin");
    expect(actorRole(auth({ teamAccount: { id: "t", team_id: 1, username: "u" } }))).toBe(
      "team_account"
    );
    expect(actorRole(auth({ orgMembership: { organization_id: "o", role: "owner" } }))).toBe(
      "org_owner"
    );
    expect(actorRole(auth())).toBe("user");
  });
});

describe("rate limiting (in-memory fallback)", () => {
  it("counts requests per key and reports limit + reset", async () => {
    const { rateLimit } = sec();
    const key = `test:${Math.random()}`;

    const r1 = await rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(r1.limited).toBe(false);
    expect(r1.remaining).toBe(1);

    const r2 = await rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(r2.limited).toBe(false);
    expect(r2.remaining).toBe(0);

    const r3 = await rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(r3.limited).toBe(true);
    expect(r3.resetAt).toBeGreaterThan(Date.now());
  });

  it("keys are isolated from each other", async () => {
    const { rateLimit } = sec();
    const a = `iso-a:${Math.random()}`;
    const b = `iso-b:${Math.random()}`;

    await rateLimit({ key: a, limit: 1, windowMs: 60_000 });
    const secondOnA = await rateLimit({ key: a, limit: 1, windowMs: 60_000 });
    const firstOnB = await rateLimit({ key: b, limit: 1, windowMs: 60_000 });

    expect(secondOnA.limited).toBe(true);
    expect(firstOnB.limited).toBe(false);
  });

  it("the window resets after expiry", async () => {
    const { rateLimit } = sec();
    const key = `reset:${Math.random()}`;

    await rateLimit({ key, limit: 1, windowMs: 30 });
    const blocked = await rateLimit({ key, limit: 1, windowMs: 30 });
    expect(blocked.limited).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 45));
    const afterExpiry = await rateLimit({ key, limit: 1, windowMs: 30 });
    expect(afterExpiry.limited).toBe(false);
  });
});
