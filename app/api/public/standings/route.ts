import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCached } from "@/lib/cache";

export const revalidate = 120;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get("competitionId");
    if (!competitionId) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }
    const key = `public:standings:${competitionId}`;

    const data = await getCached(
      key,
      async () => {
        const supabase = await createClient();
        const { data: standings } = await supabase
          .from("standings")
          .select(
            `
            id,
            team_id,
            played,
            won,
            drawn,
            lost,
            goals_for,
            goals_against,
            goal_difference,
            points,
            position,
            teams(id, name, logo_url)
          `
          )
          .eq("competition_id", competitionId)
          .order("position");
        return standings ?? [];
      },
      { ttl: 120, tags: ["public:standings"] }
    );

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching public standings:", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
