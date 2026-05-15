import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(
        code
      );
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // Supabase not configured
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}
