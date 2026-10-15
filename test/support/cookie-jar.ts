export interface SessionCookie {
  name: string;
  value: string;
}

/**
 * Minimal in-memory stand-in for the Next.js `cookies()` store used by
 * `lib/supabase/server.ts`. Tests load a role's session cookies into the jar,
 * and the mocked `next/headers` `cookies()` returns this same instance.
 */
class CookieJar {
  private store = new Map<string, string>();

  get(name: string): { name: string; value: string } | undefined {
    const value = this.store.get(name);
    return value === undefined ? undefined : { name, value };
  }

  getAll(): SessionCookie[] {
    return Array.from(this.store, ([name, value]) => ({ name, value }));
  }

  set(input: { name: string; value: string } | string, value?: string): void {
    if (typeof input === "string") {
      this.store.set(input, value ?? "");
    } else {
      this.store.set(input.name, input.value);
    }
  }

  remove(name: string): void {
    this.store.delete(name);
  }

  clear(): void {
    this.store.clear();
  }

  load(cookies: SessionCookie[]): void {
    this.store.clear();
    for (const cookie of cookies) this.store.set(cookie.name, cookie.value);
  }
}

export const cookieJar = new CookieJar();
