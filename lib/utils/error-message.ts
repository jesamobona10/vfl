/**
 * Maps a caught error from a fetch call into a user-friendly message,
 * distinguishing offline state from other network failures.
 */
export function describeFetchError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
