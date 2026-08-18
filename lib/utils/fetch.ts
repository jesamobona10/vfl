/**
 * Shared fetch utility for API route hooks.
 *
 * Provides a typed wrapper around `fetch` that throws on non-OK responses,
 * eliminating the duplicated `fetchJson` function that was previously
 * copy-pasted in `use-org.ts` and `use-competitions.ts`.
 *
 * @param url - The URL to fetch.
 * @param init - Optional fetch configuration.
 * @returns The parsed JSON response of type `T`.
 * @throws {Error} If the response status is not OK.
 *
 * @example
 * ```ts
 * const data = await fetchJson<{ teams: Team[] }>("/api/teams");
 * ```
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}
