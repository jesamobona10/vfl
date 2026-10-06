import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guards Supabase credential placement in the local env file.
 *
 * A service_role key bypasses RLS entirely: it can read and write every table,
 * including auth.users. Any variable prefixed NEXT_PUBLIC_ is inlined into the
 * client bundle by Next.js and served to every visitor, so a privileged key in
 * one of those variables is a full database compromise — visible in devtools.
 *
 * This caught a real instance: NEXT_PUBLIC_SUPABASE_ANON_KEY held a
 * service_role JWT and was embedded in five .next/static chunks.
 */

const ENV_FILE = resolve(process.cwd(), ".env.local");
const PRIVILEGED_ROLES = new Set(["service_role", "supabase_admin"]);

function parseEnvFile(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

/** Decode a JWT payload without verifying it. Returns null for non-JWTs. */
function jwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

const env = parseEnvFile();
const describeEnv = Object.keys(env).length ? describe : describe.skip;

describeEnv("supabase credential placement (.env.local)", () => {
  it("NEXT_PUBLIC_ variables must never hold a privileged Supabase key", () => {
    const offenders: string[] = [];
    for (const [name, value] of Object.entries(env)) {
      if (!name.startsWith("NEXT_PUBLIC_")) continue;
      const payload = jwtPayload(value);
      const role = payload?.role;
      if (typeof role === "string" && PRIVILEGED_ROLES.has(role)) {
        offenders.push(`${name} (role=${role})`);
      }
    }
    expect(
      offenders,
      `Privileged key exposed to the browser bundle: ${offenders.join(", ")}. ` +
        `NEXT_PUBLIC_ values are inlined into client JS. Use the anon key there; ` +
        `rotate the exposed service_role key in Supabase → Project Settings → API.`,
    ).toEqual([]);
  });

  it("NEXT_PUBLIC_SUPABASE_ANON_KEY must be a well-formed anon-role JWT", () => {
    const value = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value) return; // not configured in this environment

    // Supabase keys occasionally arrive with a stray extra dot-separated
    // segment, which makes the API reject them with 401 "Invalid API key"
    // while the credential material before it is still perfectly readable.
    const parts = value.split(".");
    expect(
      parts.length,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not a 3-part JWT — the API will answer " +
        '401 "Invalid API key" for a malformed key. Re-copy it from the dashboard.',
    ).toBe(3);

    const payload = jwtPayload(value);
    expect(payload, "anon key is not a decodable JWT").not.toBeNull();
    expect(payload?.role).toBe("anon");
  });

  it("SUPABASE_SERVICE_ROLE_KEY must not be a NEXT_PUBLIC_ variable", () => {
    expect(env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    // A service_role key must stay server-only; its presence here is fine.
    expect(PRIVILEGED_ROLES.has(String(jwtPayload(env.SUPABASE_SERVICE_ROLE_KEY ?? "")?.role))
      || !env.SUPABASE_SERVICE_ROLE_KEY,
    ).toBe(true);
  });
});