import "server-only";
import { getPublicEnv } from "./public";

function requireServerEnv(name: "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getServerEnv() {
  return {
    ...getPublicEnv(),
    supabaseServiceRoleKey: requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  } as const;
}
