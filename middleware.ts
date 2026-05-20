import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { getClientIp, logSecurityEvent, rateLimit, rateLimitResponse } from "@/lib/security";

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
    pathname === "/api/auth/team-login" ||
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

  if (isAdminPage) {
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();

    if (!adminUser) {
      logSecurityEvent("forbidden_admin_page", { userId: session.user.id, pathname });
      return secure(NextResponse.redirect(new URL("/", request.url)));
    }
  }

  return secure(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
