import { createClient } from "@/lib/supabase/server";
import {
  asString,
  getAuthContext,
  json,
  logApiError,
  parseJsonObject,
  requireOrgAdmin,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id") || auth?.orgMembership?.organization_id;

    let query = supabase.from("teams").select("*").order("id");
    if (orgId) query = query.eq("organization_id", orgId);

    const { data, error } = await query;

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
    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = asString(parsed.data!.name, 80);
    if (!name) return json({ error: "Team name is required." }, { status: 400 });

    const organization_id = asString(parsed.data!.organization_id, 64);
    if (!organization_id) return json({ error: "Organization ID is required." }, { status: 400 });

    const orgAdminError = requireOrgAdmin(auth, organization_id);
    if (orgAdminError) return orgAdminError;

    const { data, error } = await supabase
      .from("teams")
      .insert({ name: sanitizeText(name), organization_id })
      .select()
      .single();

    if (error) {
      logApiError("team_create_failed", error, { userId: auth!.userId });
      if (error.code === "23505") {
        return json({ error: "A team with this name already exists." }, { status: 409 });
      }
      return json({ error: "Unable to create team." }, { status: 400 });
    }
    return json({ team: data });
  } catch (error) {
    logApiError("team_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
