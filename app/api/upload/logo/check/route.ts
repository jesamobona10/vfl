import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET() {
  try {
    const sb = createServiceRoleClient();
    const { data: buckets, error } = await sb.storage.listBuckets();

    if (error) {
      return NextResponse.json(
        { exists: false, error: error.message },
        { status: 200 }
      );
    }

    const exists = buckets?.some((b) => b.name === "team-logos") ?? false;

    return NextResponse.json({ exists });
  } catch (err) {
    console.error("Bucket check error:", err);
    return NextResponse.json(
      { exists: false, error: "Failed to check storage bucket." },
      { status: 200 }
    );
  }
}
