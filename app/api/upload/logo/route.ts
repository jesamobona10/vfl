import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

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
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `upload:logo:${ip}:${auth!.userId}`, limit: 30, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("logo_upload_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const teamId = asInteger(formData.get("teamId"), 1);
    const teamName = asString(formData.get("teamName"), 80);

    if (!file || !teamId || !teamName) {
      return json(
        { error: "File, teamId, and teamName are required." },
        { status: 400 }
      );
    }

    const allowedMime = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowedMime.includes(file.type)) {
      return json(
        { error: "Invalid file type. Allowed: PNG, JPG, WEBP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return json(
        { error: "File too large. Max 2MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const signatures: Record<string, number[]> = {
      "image/png": [0x89, 0x50, 0x4e, 0x47],
      "image/jpeg": [0xff, 0xd8, 0xff],
      "image/webp": [0x52, 0x49, 0x46, 0x46],
      "image/gif": [0x47, 0x49, 0x46],
    };
    const signature = signatures[file.type];
    if (!signature || !signature.every((byte, index) => buffer[index] === byte)) {
      return json({ error: "Invalid image file." }, { status: 400 });
    }

    const extByMime: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extByMime[file.type];
    const slug = slugify(sanitizeText(teamName));
    const fileName = `team-${slug}-${teamId}.${ext}`;

    const sb = createServiceRoleClient();

    const { error: uploadError } = await sb.storage
      .from("team-logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      logApiError("logo_upload_failed", uploadError, { userId: auth!.userId, teamId });
      return json({ error: "Unable to upload logo." }, { status: 500 });
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
      logApiError("logo_team_update_failed", updateError, { userId: auth!.userId, teamId });
      return json({ error: "Unable to update team logo." }, { status: 500 });
    }

    return json({ url: publicUrl });
  } catch (err) {
    logApiError("logo_upload_error", err);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
