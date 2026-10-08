import { NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  // Record callback failures without logging the single-use authorization code.
  const fail = (event: string, details: Record<string, unknown>) => {
    logSecurityEvent(event, details);
    return NextResponse.redirect(new URL("/auth/login?error=auth_callback", origin));
  };

  if (!code) {
    return fail("auth_callback_missing_code", { next });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return fail("auth_callback_exchange_failed", { reason: error.message });
    }
  } catch (err) {
    // Previously `catch {}`, which hid "Supabase not configured" entirely.
    return fail("auth_callback_error", {
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.redirect(new URL(next, origin));
}
