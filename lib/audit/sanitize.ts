const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "password_hash",
  "refreshToken",
  "refresh_token",
  "accessToken",
  "access_token",
  "resetToken",
  "reset_token",
  "otp",
  "otp_secret",
  "recoveryToken",
  "recovery_token",
  "verificationToken",
  "verification_token",
  "hash",
  "salt",
];

const SENSITIVE_PREFIXES = ["pass", "token", "secret", "otp"];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_FIELDS.includes(lower)) return true;
  return SENSITIVE_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(`${prefix}_`) || lower.startsWith(`${prefix}-`)
  );
}

/**
 * Strip sensitive values from arbitrary data before persisting to
 * the audit log. Nested objects and arrays are traversed; the same
 * keys are always removed regardless of nesting depth.
 */
export function sanitizeAuditData<T>(data: T | null | undefined): T | undefined {
  if (data == null) return undefined;
  if (typeof data !== "object") return data as T;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item)) as unknown as T;
  }
  const record = data as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) continue;
    cleaned[key] = sanitizeAuditData(value);
  }
  return cleaned as T;
}

/**
 * Pick only the fields explicitly allowed to appear in an audit record.
 * Prefer this over sanitizeAuditData for documents that may carry a
 * broad set of fields.
 */
export function pickAuditFields<T extends Record<string, unknown>>(
  data: T,
  allowed: string[]
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of allowed as (keyof T)[]) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}
