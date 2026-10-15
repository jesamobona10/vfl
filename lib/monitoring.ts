/**
 * Central monitoring helpers.
 *
 * IMPORTANT: this module must never statically import the Sentry SDK. It is
 * pulled in by `lib/security.ts`, which every API route and many unit tests
 * import, so a static `@sentry/nextjs` import would drag the SDK (and its
 * Next.js runtime assumptions) into the Node test environment. The SDK is only
 * loaded lazily, and only once a DSN is configured.
 */

/** True when a Sentry DSN is configured for either the server or the client. */
export function isMonitoringEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export interface CaptureContext {
  /** Logical route/operation name (matches the `logApiError` event string). */
  route?: string;
  organizationId?: string | null;
  role?: string | null;
}

/**
 * Recursively redact personal data before an event leaves the process.
 *
 * This application holds minors' data, so error reports are scrubbed rather
 * than trusted: keys that look like names, emails or player identifiers are
 * replaced, and email-shaped substrings are stripped from any string.
 */
const PII_KEY_RE =
  /email|username|user_?id|player_?id|password|token|phone|_name$|^name$|first_?name|last_?name|full_?name|dob|date_of_birth/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const REDACTED = "[redacted]";

function scrubString(value: string): string {
  return value.replace(EMAIL_RE, "[redacted-email]");
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = PII_KEY_RE.test(key) ? REDACTED : scrubValue(child, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * `beforeSend` hook: strip the user object and scrub the rest of the event.
 * Generic so it can be passed straight to `Sentry.init` without importing the
 * SDK's types here.
 */
export function scrubEvent<T>(event: T): T {
  if (event && typeof event === "object") {
    const record = event as Record<string, unknown>;
    delete record.user;
    return scrubValue(record) as T;
  }
  return event;
}

/**
 * Sentry v11 data-collection policy. This app holds minors' data, so nothing
 * that could identify a person is collected by default: no user info, cookies,
 * headers, bodies, query params, DB query data or stack-frame locals. This is
 * the v11 replacement for the removed `sendDefaultPii` option.
 */
export const piiSafeDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

/**
 * Report an error to Sentry when monitoring is enabled. Safe to call from
 * anywhere: it is a no-op without a DSN and never throws.
 */
export async function captureError(error: unknown, context: CaptureContext = {}): Promise<void> {
  if (!isMonitoringEnabled()) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.withScope((scope) => {
      if (context.route) scope.setTag("route", context.route);
      if (context.organizationId) scope.setTag("organization_id", context.organizationId);
      if (context.role) scope.setTag("role", context.role);
      Sentry.captureException(error);
    });
  } catch {
    // Monitoring must never break the request path.
  }
}
