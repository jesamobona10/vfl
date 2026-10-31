import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCached } from "@/lib/cache";

export const revalidate = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 50);
    const key = `public:matches:list:${limit}`;

    const data = await getCached(
      key,
      async () => {
        const supabase = await createClient();
        const { data: matches } = await supabase
          .from("matches")
          .select(
            `
            id,
            match_date,
            status,
            home_team_id,
            away_team_id,
            home_score,
            away_score,
            venue,
            competition_id,
            competitions(id, name, season, organization_id),
            home_team:teams!matches_home_team_id_fkey(id, name, logo_url),
            away_team:teams!matches_away_team_id_fkey(id, name, logo_url)
          `
          )
          .order("match_date", { ascending: false })
          .limit(limit);
        return matches ?? [];
      },
      { ttl: 60, tags: ["public:matches"] }
    );

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching public matches:", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
