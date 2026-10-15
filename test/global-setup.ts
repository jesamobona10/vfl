import { authzEnabled } from "./support/authz";
import { seedAuthzData } from "./support/seed";

/**
 * Runs once before the whole suite. Booting Supabase and seeding is expensive,
 * so it is skipped entirely unless the authorization tests are enabled.
 */
export default async function globalSetup(): Promise<void> {
  if (!authzEnabled) return;
  await seedAuthzData();
}
