import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(
        code
      );
      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    } catch {
      // Supabase not configured
    }
  }

  return NextResponse.redirect(new URL("/auth/login", origin));
}
