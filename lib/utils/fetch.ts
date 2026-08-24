/**
 * Shared fetch utility for API route hooks.
 *
 * Provides a typed wrapper around `fetch` that throws on non-OK responses,
 * surfacing the server's `{ error }` message instead of a generic one.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, message: string, url: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

/** Human-friendly message for network-level failures (offline, DNS, abort). */
function networkErrorMessage(): Error {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new Error("You appear to be offline. Check your connection and try again.");
  }
  return new Error("Could not reach the server. Please try again.");
}

/**
 * Fetch JSON, throwing {@link ApiError} with the server-provided message on
 * non-OK responses, or a friendly Error for network-level failures.
 *
 * @example
 * ```ts
 * const data = await fetchJson<{ teams: Team[] }>("/api/teams");
 * ```
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw networkErrorMessage();
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error.trim()) {
        message = body.error;
      }
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message, url);
  }

  return res.json();
}

/**
 * Non-throwing variant: returns a discriminated result instead.
 *
 * @example
 * ```ts
 * const result = await fetchJsonSafe<{ teams: Team[] }>("/api/teams");
 * if (!result.ok) showError(result.error.message);
 * ```
 */
export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { status: number; message: string } };

export async function fetchJsonSafe<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  try {
    return { ok: true, data: await fetchJson<T>(url, init) };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: { status: error.status, message: error.message } };
    }
    return {
      ok: false,
      error: {
        status: 0,
        message:
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
      },
    };
  }
}
