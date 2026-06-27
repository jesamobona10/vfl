import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env/public";

export function createPublicClient() {
  return createClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
