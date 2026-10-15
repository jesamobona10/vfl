import { createServerClient } from "@supabase/ssr";
import { cookieJar, type SessionCookie } from "./cookie-jar";

/**
 * Shared harness for the API authorization matrix tests.
 *
 * These tests exercise real route handlers against a real local Supabase
 * instance, so they only run when `AUTHZ_TESTS=1` and the local stack's
 * connection details are present (see `scripts/test-db-bootstrap.sh`). Without
 * that, `authzEnabled` is false and the suites skip — keeping the default
 * `npm test` run free of any Docker/database dependency.
 */
export const authzEnabled =
  process.env.AUTHZ_TESTS === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const PASSWORD = "Authz#Passw0rd123";

/** Fixed, seed-time identifiers so tests can address specific resources. */
export const ORG_A = "11111111-1111-1111-1111-111111111111";
export const ORG_B = "22222222-2222-2222-2222-222222222222";
export const COMPETITION_A = "33333333-3333-3333-3333-333333333333";
export const SEASON_A = "44444444-4444-4444-4444-444444444444";
export const TEAM_A1 = 9001;
export const TEAM_A2 = 9002;
export const TEAM_B1 = 9101;
export const TEAM_B2 = 9102;
export const PLAYER_A1 = 9001;
export const PLAYER_A2 = 9002;
export const PLAYER_B1 = 9101;
export const FIXTURE_A = 9001;
export const FIXTURE_B = 9101;
export const EVENT_A = 9001;

export const EMAILS = {
  superAdmin: "authz-super@example.test",
  orgAdminA: "authz-org-admin-a@example.test",
  orgPlayerA: "authz-org-player-a@example.test",
  coachA: "authz-coach-a@example.test",
  coachB: "authz-coach-b@example.test",
} as const;

export type ActorEmail = (typeof EMAILS)[keyof typeof EMAILS] | null;

/** Anonymous actors send no session cookies. */
export const ANONYMOUS: ActorEmail = null;

const sessionCache = new Map<string, SessionCookie[]>();

async function mintSessionCookies(email: string): Promise<SessionCookie[]> {
  const collected: SessionCookie[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => collected,
        setAll: (cookies) => {
          for (const cookie of cookies) {
            const index = collected.findIndex((c) => c.name === cookie.name);
            if (index >= 0) collected[index] = { name: cookie.name, value: cookie.value };
            else collected.push({ name: cookie.name, value: cookie.value });
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return collected;
}

async function sessionFor(email: string): Promise<SessionCookie[]> {
  let cookies = sessionCache.get(email);
  if (!cookies) {
    cookies = await mintSessionCookies(email);
    sessionCache.set(email, cookies);
  }
  return cookies;
}

/** Load the given actor's session into the shared cookie jar. */
export async function authenticate(email: ActorEmail): Promise<void> {
  if (email === null) {
    cookieJar.clear();
    return;
  }
  cookieJar.load(await sessionFor(email));
}

/** Build a JSON request body + headers for a route handler call. */
export function jsonRequest(
  url: string,
  method: string,
  body?: unknown
): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Authorization outcomes are asserted defensively:
 * - A denied actor must be rejected (401/403), or the resource must be hidden
 *   from it by row-level security (404). It must never be accepted.
 * - An allowed actor must clear the guard — it must not receive 401/403. It may
 *   still fail downstream validation with 400, which is not an authz failure.
 */
export function isDeniedStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

export function isGuardRejected(status: number): boolean {
  return status === 401 || status === 403;
}
