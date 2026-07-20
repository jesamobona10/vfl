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
      .from("player_transfers")
      .select(`*, players(name), from_team:teams(id, name), to_team:teams(id, name)`)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("transfers_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load transfers." }, { status: 400 });
    }
    return json({ transfers: data });
  } catch (error) {
    logApiError("transfers_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
