import { createClient } from "@/lib/supabase/server";
import {
  getAuthContext,
  json,
  logApiError,
  logSecurityEvent,
  requireAdmin,
  requireAuth,
  requireOrgAdmin,
  requireOrgMember,
  type AuthContext,
} from "@/lib/security";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Common context passed to every API route handler created via
 * {@link createApiHandler}. Contains the authenticated Supabase client,
 * resolved auth context, and request metadata.
 */
export interface ApiHandlerContext {
  /** Authenticated Supabase client (with RLS policies applied). */
  supabase: SupabaseClient;
  /** Resolved authentication context for the current request. */
  auth: AuthContext;
  /** The original incoming request object. */
  request: Request;
  /** Parsed URL search parameters. */
  url: URL;
}

/**
 * Result type for API handlers. Can return a NextResponse directly
 * or use the `json()` helper from `lib/security.ts`.
 */
export type ApiResponse = Response;

/**
 * Options for configuring an API handler created via {@link createApiHandler}.
 */
export interface ApiHandlerOptions {
  /**
   * Authorization level required. Defaults to `"auth"`.
   * - `"auth"`: Any authenticated user.
   * - `"admin"`: Super admin only.
   * - `"org_member"`: Any member of the organization (resolves org from query param or auth context).
   * - `"org_admin"`: Organization admin/owner only.
   */
  auth?: "auth" | "admin" | "org_member" | "org_admin";

  /**
   * HTTP methods this handler supports. If the request method doesn't match,
   * a 405 Method Not Allowed is returned.
   */
  methods?: string[];
}

/**
 * Higher-order function that wraps an API route handler with common
 * boilerplate: Supabase client creation, auth resolution, authorization
 * checks, error handling, and method validation.
 *
 * Usage:
 * ```ts
 * export const GET = createApiHandler(async (ctx) => {
 *   const { supabase, auth, url } = ctx;
 *   const orgId = url.searchParams.get("org_id");
 *   // ... your handler logic
 *   return json({ data: results });
 * });
 * ```
 *
 * @param handler - The actual route handler logic.
 * @param options - Authorization and method constraints.
 * @returns A Next.js App Router route handler function.
 */
export function createApiHandler(
  handler: (ctx: ApiHandlerContext) => Promise<ApiResponse>,
  options: ApiHandlerOptions = {}
) {
  const { auth: requiredAuth = "auth", methods } = options;

  return async function routeHandler(
    request: Request,
    context?: { params?: Record<string, string> }
  ): Promise<ApiResponse> {
    try {
      if (methods && !methods.includes(request.method)) {
        return json({ error: `Method ${request.method} not allowed.` }, { status: 405 });
      }

      const supabase = await createClient();
      const auth = await getAuthContext(supabase);
      const url = new URL(request.url);

      // Authorization checks
      if (requiredAuth === "admin") {
        const err = requireAdmin(auth);
        if (err) return err;
      } else if (requiredAuth === "org_member" || requiredAuth === "org_admin") {
        const authErr = requireAuth(auth);
        if (authErr) return authErr;

        // Try to resolve orgId from query params or route params
        const orgId =
          url.searchParams.get("org_id") || context?.params?.orgId || context?.params?.slug;

        if (orgId && auth) {
          if (requiredAuth === "org_admin") {
            const err = requireOrgAdmin(auth, orgId);
            if (err) return err;
          } else {
            const err = requireOrgMember(auth, orgId);
            if (err) return err;
          }
        }
      } else {
        const err = requireAuth(auth);
        if (err) return err;
      }

      return await handler({
        supabase,
        auth: auth!,
        request,
        url,
      });
    } catch (error) {
      logApiError("api_handler_error", error, {
        path: request.url,
        method: request.method,
      });
      return json({ error: "Internal server error." }, { status: 500 });
    }
  };
}

/**
 * Extracts a numeric ID from route params, returning null if invalid.
 *
 * @param value - The raw param value.
 * @param min - Minimum allowed value (inclusive).
 * @param max - Maximum allowed value (inclusive).
 * @returns The parsed integer or null if invalid.
 */
export function parseRouteId(
  value: string | undefined,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) return null;
  return num;
}
