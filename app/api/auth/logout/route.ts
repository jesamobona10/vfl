import { createClient } from "@/lib/supabase/server";
import { getClientIp, json, logApiError, logSecurityEvent } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    logSecurityEvent("logout", { ip: getClientIp(request) });
    return json({ success: true });
  } catch (error) {
    logApiError("logout_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
