import { NextResponse } from "next/server";
import { getPublicOrganizationsCached } from "@/lib/cache/public-orgs";

export const revalidate = 300;

export async function GET() {
  try {
    const organizations = await getPublicOrganizationsCached();
    return NextResponse.json(
      { data: organizations },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching public organizations:", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
