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

    const rows = teams.map((t: any) => ({
      id: Math.trunc(Number(t.id)),
      name: t.name,
      logo_url: t.logo || t.logoUrl || t.logo_url || null,
      rating: t.rating ?? 6.0,
    }));

    const { error: insertError } = await sb.from("teams").upsert(rows, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: synced } = await sb
      .from("teams")
      .select("*")
      .order("id");

    return NextResponse.json({ success: true, teams: synced });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
