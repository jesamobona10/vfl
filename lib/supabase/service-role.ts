import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/server";

export function createServiceRoleClient() {
  return createClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
