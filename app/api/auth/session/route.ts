import { createClient } from "@/lib/supabase/server";
import { json } from "@/lib/security";
import { resolveSession } from "@/lib/auth/session-resolver";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const result = await resolveSession(supabase);
  return json(result);
}
