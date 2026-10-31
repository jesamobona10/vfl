import { NextResponse } from "next/server";
import { getPublicOrganizationsCached } from "@/lib/cache/public-orgs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPublicOrganizationsCached();
    const res = NextResponse.json({ data });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res;
  } catch (error) {
    return NextResponse.json({ data: [], error: "Failed to load organizations" }, { status: 500 });
  }
}
