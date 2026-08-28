import { createClient } from "@/lib/supabase/server";
import { resolveOrgData } from "@/lib/auth/data-resolver";
import { DataHydration } from "@/components/layout/data-hydration";

/**
 * Server-rendered data bootstrap. Runs during SSR after auth resolution so
 * org/team data is resolved server-side and handed to the client store as
 * initial state — eliminating the client-side refreshOrgData/refreshAdminData
 * fetches that previously delayed content render for authenticated org admins.
 *
 * Only runs for org_admin and super_admin roles where the data is needed.
 */
export default async function DataBootstrap() {
  const supabase = await createClient();
  const result = await resolveOrgData(supabase);
  return <DataHydration data={result} />;
}