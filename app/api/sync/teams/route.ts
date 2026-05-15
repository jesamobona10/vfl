import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teams } = body;

    if (!teams || !Array.isArray(teams)) {
      return NextResponse.json(
        { error: "Teams array is required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const { data: existingTeams } = await sb
      .from("teams")
      .select("*");

    const existing =
      (existingTeams as { id: number; name: string; logo_url?: string | null; rating?: number }[]) ?? [];

    const idMap: Record<number, number> = {};
    const toUpdate: { id: number; logo_url: string | null; rating: number }[] = [];
    const toInsert: { name: string; logo_url: string | null; rating: number }[] = [];

    for (const t of teams) {
      const match = existing.find(
        (e) => e.name.toLowerCase() === (t.name as string).trim().toLowerCase()
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
          name: t.name,
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

    return NextResponse.json({ success: true, teams: synced, idMap });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
