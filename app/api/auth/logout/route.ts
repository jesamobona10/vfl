import { createClient } from "@/lib/supabase/server";
import {
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `logout:${ip}`, limit: 10, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    await supabase.auth.signOut();
    logSecurityEvent("logout", { ip });
    return json({ success: true });
  } catch (error) {
    logApiError("logout_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
