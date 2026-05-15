import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const teamId = formData.get("teamId") as string | null;

    if (!file || !teamId) {
      return NextResponse.json(
        { error: "File and teamId are required." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["png", "jpg", "jpeg", "webp", "gif"];
    if (!ext || !allowed.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: png, jpg, jpeg, webp, gif" },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Max 2MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `team-${teamId}.${ext}`;

    const sb = createServiceRoleClient();

    const { error: uploadError } = await sb.storage
      .from("team-logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = sb.storage
      .from("team-logos")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await sb
      .from("teams")
      .update({ logo_url: publicUrl })
      .eq("id", teamId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
