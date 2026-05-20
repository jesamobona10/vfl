import { createClient } from "@/lib/supabase/server";
import {
  asString,
  getAuthContext,
  json,
  logApiError,
  parseJsonObject,
  requireAdmin,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("id");

    if (error) {
      logApiError("teams_list_failed", error);
      return json({ error: "Unable to load teams." }, { status: 500 });
    }
    return json({ teams: data });
  } catch (error) {
    logApiError("teams_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = asString(parsed.data!.name, 80);
    if (!name) return json({ error: "Team name is required." }, { status: 400 });

    const { data, error } = await supabase
      .from("teams")
      .insert({ name: sanitizeText(name) })
      .select()
      .single();

    if (error) {
      logApiError("team_create_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to create team." }, { status: 400 });
    }
    return json({ team: data });
  } catch (error) {
    logApiError("team_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
