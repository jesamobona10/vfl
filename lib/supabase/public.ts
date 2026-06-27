import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/public";

export function createPublicClient() {
  const env = getPublicEnv();
  return createClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
