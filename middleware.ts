import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { getClientIp, logSecurityEvent, rateLimit, rateLimitResponse } from "@/lib/security";

type AccountKind = "admin" | "team" | "player" | "unknown";

/** Pages player accounts may visit (fixtures, standings, player stats). */
const PLAYER_PAGE_PREFIXES = ["/", "/fixtures", "/standings", "/players"] as const;

const PLAYER_DEFAULT_PAGE = "/fixtures";

function isPlayerAllowedPage(pathname: string): boolean {
  return PLAYER_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isPlayerAllowedApi(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname === "/api/auth/session" && method === "GET") return true;
  if (    pathname === "/api/auth/logout" && (method === "POST" || method === "GET")) return true;
  if (pathname === "/api/fixtures" && method === "GET") return true;
  if (pathname === "/api/players" && method === "GET") return true;
  if (/^\/api\/players\/\d+$/.test(pathname) && method === "GET") return true;
  return false;
}

async function resolveAccountKind(
  supabase: ReturnType<typeof createMiddlewareClient>["supabase"],
  userId: string
): Promise<AccountKind> {
  const [{ data: admin }, { data: team }] = await Promise.all([
    supabase.from("admin_users").select("id").eq("id", userId).maybeSingle(),
    supabase.from("team_accounts").select("id").eq("id", userId).maybeSingle(),
  ]);
  if (admin) return "admin";
  if (team) return "team";

  const { data: player } = await supabase
    .from("player_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (player) return "player";

  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (orgMember) return "admin";

  return "unknown";
}

function secure(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  return response;
}

export async function middleware(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.protocol === "http:" &&
    request.headers.get("x-forwarded-proto") !== "https"
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  const isAuthPage = pathname.startsWith("/auth");
  const isAdminPage = pathname.startsWith("/admin");
  const isApiRoute = pathname.startsWith("/api");
  const isPublicApi =
    pathname === "/api/auth/admin-signup" ||
    pathname === "/api/auth/admin-login" ||
    pathname === "/api/auth/session" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/org-login" ||
    pathname === "/api/auth/team-login" ||
    pathname === "/api/auth/player-login" ||
    pathname === "/api/auth/player-register" ||
    pathname === "/api/org/register" ||
    pathname.startsWith("/api/public/");

  if (isApiRoute) {
    const ip = getClientIp(request);
    const limit = pathname.startsWith("/api/auth/")
      ? { limit: 10, windowMs: 60_000 }
      : pathname.startsWith("/api/public/")
        ? { limit: 120, windowMs: 60_000 }
        : { limit: 80, windowMs: 60_000 };
    const limited = rateLimit({
      key: `api:${ip}:${pathname}`,
      ...limit,
    });
    if (limited.limited) {
      logSecurityEvent("rate_limit_exceeded", { ip, pathname });
      return secure(rateLimitResponse(limited.resetAt));
    }
  }

  if (!session) {
    if (isAdminPage || (isApiRoute && !isPublicApi && !isAuthPage)) {
      return secure(NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ));
    }
    if (isAuthPage) {
      return secure(response);
    }
    if (
      !isAuthPage &&
      pathname !== "/" &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/favicon")
    ) {
      return secure(response);
    }
    return secure(response);
  }

  if (isAuthPage) {
    return secure(NextResponse.redirect(new URL("/", request.url)));
  }

  const accountKind = await resolveAccountKind(supabase, session.user.id);

  if (isAdminPage) {
    if (accountKind !== "admin") {
      logSecurityEvent("forbidden_admin_page", {
        userId: session.user.id,
        pathname,
        accountKind,
      });
      const redirectTo =
        accountKind === "player" ? PLAYER_DEFAULT_PAGE : "/";
      return secure(NextResponse.redirect(new URL(redirectTo, request.url)));
    }
    return secure(response);
  }

  if (accountKind === "player") {
    if (isApiRoute && !isPublicApi) {
      if (!isPlayerAllowedApi(pathname, request.method)) {
        logSecurityEvent("forbidden_player_api", {
          userId: session.user.id,
          pathname,
          method: request.method,
        });
        return secure(
          NextResponse.json({ error: "Forbidden" }, { status: 403 })
        );
      }
    } else if (!isPlayerAllowedPage(pathname)) {
      logSecurityEvent("forbidden_player_page", {
        userId: session.user.id,
        pathname,
      });
      return secure(
        NextResponse.redirect(new URL(PLAYER_DEFAULT_PAGE, request.url))
      );
    }
  }

  if (accountKind === "unknown" && isApiRoute && !isPublicApi) {
    logSecurityEvent("unknown_account_api", { userId: session.user.id, pathname });
    return secure(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  return secure(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
