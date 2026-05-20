import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { asString, getAuthContext, json, logApiError, parseJsonObject, requireAdmin, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });
    const teams = parsed.data!.teams;

    if (!teams || !Array.isArray(teams)) {
      return json(
        { error: "Teams array is required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const { data: existingTeams, error: fetchError } = await sb
      .from("teams")
      .select("*");

    if (fetchError) {
      logApiError("sync_teams_fetch_failed", fetchError, { userId: auth!.userId });
      return json({ error: "Unable to sync teams." }, { status: 500 });
    }

    const existing =
      (existingTeams as { id: number; name: string; logo_url?: string | null; rating?: number }[]) ?? [];

    const idMap: Record<number, number> = {};
    const toUpdate: { id: number; logo_url: string | null; rating: number }[] = [];
    const toInsert: { name: string; logo_url: string | null; rating: number }[] = [];

    for (const t of teams) {
      const validName = asString((t as any).name, 80);
      if (!validName) continue;
      const match = existing.find(
        (e) => e.name.toLowerCase() === validName.toLowerCase()
      );
      if (match) {
        idMap[Number(t.id)] = match.id;
        toUpdate.push({
          id: match.id,
          logo_url: (t.logo as string) || null,
          rating: (t.rating as number) ?? 6.0,
        });
      } else {
        toInsert.push({
          name: sanitizeText(validName),
          logo_url: (t.logo as string) || null,
          rating: (t.rating as number) ?? 6.0,
        });
      }
    }

    for (const row of toUpdate) {
      await sb.from("teams").update(row).eq("id", row.id);
    }

    if (toInsert.length > 0) {
      const { data: inserted } = await sb
        .from("teams")
        .insert(toInsert)
        .select();
      if (inserted) {
        for (const row of inserted) {
          const original = teams.find(
            (t: any) => t.name.toLowerCase() === row.name.toLowerCase()
          );
          if (original) {
            idMap[Number(original.id)] = row.id;
          }
        }
      }
    }

    const { data: synced } = await sb
      .from("teams")
      .select("*")
      .order("id");

    return json({ success: true, teams: synced, idMap });
  } catch (error) {
    logApiError("sync_teams_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
