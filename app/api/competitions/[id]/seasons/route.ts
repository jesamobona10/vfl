import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  getAuthContext,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  requireOrgAdmin,
  requireOrgMember,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: competition } = await sb
      .from("competitions")
      .select("organization_id")
      .eq("id", params.id)
      .single();

    if (!competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const memberError = requireOrgMember(auth, competition.organization_id);
    if (memberError) return memberError;

    const { data: seasons, error } = await sb
      .from("seasons")
      .select("*")
      .eq("competition_id", params.id)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("seasons_list_error", error);
      return json({ error: "Failed to fetch seasons." }, { status: 500 });
    }

    return json({ seasons: seasons || [] });
  } catch (error) {
    logApiError("seasons_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const { data: competition } = await sb
      .from("competitions")
      .select("organization_id")
      .eq("id", params.id)
      .single();

    if (!competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, competition.organization_id);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = asString(parsed.data!.name, 80);
    if (!name) {
      return json({ error: "Season name is required." }, { status: 400 });
    }

    const { data: season, error } = await sb
      .from("seasons")
      .insert({
        competition_id: params.id,
        name,
        start_date: parsed.data!.start_date || null,
        end_date: parsed.data!.end_date || null,
        status: "upcoming",
        is_current: false,
      })
      .select()
      .single();

    if (error) {
      logApiError("season_create_error", error);
      return json({ error: "Failed to create season." }, { status: 500 });
    }

    return json({ season });
  } catch (error) {
    logApiError("season_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
