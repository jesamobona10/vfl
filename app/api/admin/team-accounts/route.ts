import { createClient } from "@/lib/supabase/server";
import { getAuthContext, json, logApiError, requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const { data, error } = await supabase
      .from("team_accounts")
      .select("id, username, display_name, team_id, role, created_at, teams(name)")
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("team_accounts_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load team accounts." }, { status: 500 });
    }

    return json({ accounts: data });
  } catch (error) {
    logApiError("team_accounts_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
