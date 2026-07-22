import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAuth,
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

async function ensureBucket(sb: ReturnType<typeof createServiceRoleClient>): Promise<string | null> {
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === "comp-logos")) return null;
  const { error } = await sb.storage.createBucket("comp-logos", {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  return error ? "Unable to create storage bucket." : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `upload:comp-logo:${ip}:${auth!.userId}`, limit: 30, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("comp_logo_upload_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const compId = asString(formData.get("compId"), 36);
    const compName = asString(formData.get("compName"), 100);

    if (!file || !compId || !compName) {
      return json(
        { error: "File, compId, and compName are required." },
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

    const sb = createServiceRoleClient();

    const { data: comp } = await sb
      .from("competitions")
      .select("id")
      .eq("id", compId)
      .maybeSingle();

    if (!comp) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const bucketError = await ensureBucket(sb);
    if (bucketError) {
      logApiError("comp_logo_bucket_error", bucketError, { userId: auth!.userId, compId });
      return json({ error: bucketError }, { status: 500 });
    }

    const extByMime: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extByMime[file.type];
    const slug = slugify(sanitizeText(compName));
    const fileName = `comp-${slug}-${compId}.${ext}`;

    const { error: uploadError } = await sb.storage
      .from("comp-logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      logApiError("comp_logo_upload_failed", uploadError, { userId: auth!.userId, compId });
      return json({ error: "Unable to upload logo. Storage bucket may need configuration." }, { status: 500 });
    }

    const { data: urlData } = sb.storage
      .from("comp-logos")
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await sb
      .from("competitions")
      .update({ logo_url: publicUrl })
      .eq("id", compId);

    if (updateError) {
      logApiError("comp_logo_update_failed", updateError, { userId: auth!.userId, compId });
      return json({ error: "Unable to update competition logo." }, { status: 500 });
    }

    return json({ url: publicUrl });
  } catch (err) {
    logApiError("comp_logo_upload_error", err, { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
