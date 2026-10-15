import { captureError } from "@/lib/monitoring";

/**
 * Maps a caught error from a fetch call into a user-friendly message,
 * distinguishing offline state from other network failures.
 *
 * Unexpected failures (a raw `TypeError` from `fetch`, or a non-`Error`
 * throw) are also reported to error tracking; errors carrying an API-provided
 * message are expected and left alone.
 */
export function describeFetchError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }
  if (error instanceof TypeError || !(error instanceof Error)) {
    void captureError(error, { route: "client_fetch" });
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
