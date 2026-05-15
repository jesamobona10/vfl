import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
    pathname === "/api/auth/team-login";

  if (!session) {
    if (isAdminPage || (isApiRoute && !isPublicApi && !isAuthPage)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (isAuthPage) {
      return response;
    }
    if (
      !isAuthPage &&
      pathname !== "/" &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/favicon")
    ) {
      return response;
    }
    return response;
  }

  if (isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAdminPage) {
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();

    if (!adminUser) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
