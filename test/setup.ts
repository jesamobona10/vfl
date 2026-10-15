import { vi } from "vitest";
import { cookieJar } from "./support/cookie-jar";

/**
 * Replace Next's request-scoped `cookies()` with the shared in-memory jar so
 * route handlers can run outside a real request. Only this plumbing is mocked;
 * the Supabase client and all row-level security below it stay real.
 */
vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
}));
