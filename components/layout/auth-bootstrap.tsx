import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/auth/session-resolver";
import { AuthHydration } from "@/components/layout/auth-hydration";

/**
 * Server-rendered auth bootstrap. Runs during SSR at the root layout so the
 * session is resolved server-side and handed to the client store as initial
 * state — eliminating the client-side /api/auth/session round-trip that
 * previously gated first paint for authenticated users.
 *
 * The same role/profile resolution used by the /api/auth/session route is
 * reused here via resolveSession, so behavior is identical by construction.
 */
export default async function AuthBootstrap() {
  const supabase = await createClient();
  const result = await resolveSession(supabase);
  return <AuthHydration session={result} />;
}