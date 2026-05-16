import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();
    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const teamId = formData.get("teamId") as string | null;
    const teamName = formData.get("teamName") as string | null;

    if (!file || !teamId || !teamName) {
      return NextResponse.json(
        { error: "File, teamId, and teamName are required." },
        { status: 400 }
      );
    }

    const allowedMime = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowedMime.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPG, WEBP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Max 2MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const buffer = Buffer.from(await file.arrayBuffer());
    const slug = slugify(teamName);
    const fileName = `team-${slug}-${teamId}.${ext}`;

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
  } catch (err) {
    console.error("Logo upload error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
