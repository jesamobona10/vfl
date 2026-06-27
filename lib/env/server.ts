import "server-only";
import { publicEnv } from "./public";

function requireServerEnv(name: "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const serverEnv = {
  ...publicEnv,
  supabaseServiceRoleKey: requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
} as const;
