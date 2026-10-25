import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  asInteger,
  getAuthContext,
  getClientIp,
  json,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
} from "@/lib/security";
import { getManageableFixtureMediaContext } from "@/lib/match-media-access";
import {
  MATCH_MEDIA_BUCKET, MATCH_MEDIA_MAX_FILE_BYTES, MATCH_MEDIA_MIME_TYPES,
  isMatchMediaMimeType,
} from "@/lib/match-media";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const fixtureId = asInteger(id, 1);
    if (!fixtureId) return json({ error: "Invalid fixture id." }, { status: 400 });
    const session = await createClient();
    const auth = await getAuthContext(session);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const limited = await rateLimit({
      key: `match-media-upload:${getClientIp(request)}:${auth!.userId}`,
      limit: 120,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const access = await getManageableFixtureMediaContext(fixtureId, auth!);
    if (access.response) return access.response;
    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });
    const mimeType = typeof parsed.data?.mimeType === "string" ? parsed.data.mimeType : "";
    const size = typeof parsed.data?.size === "number" ? parsed.data.size : 0;
    const kind = parsed.data?.kind === "thumbnail" ? "thumbnail" : "media";
    if (!isMatchMediaMimeType(mimeType)) return json({ error: "Unsupported image or video format." }, { status: 400 });
    if (kind === "thumbnail" && mimeType !== "image/webp") {
      return json({ error: "Thumbnails must be WebP images." }, { status: 400 });
    }
    if (!Number.isSafeInteger(size) || size < 1 || size > MATCH_MEDIA_MAX_FILE_BYTES) {
      return json({ error: "Files must be 100 MB or smaller." }, { status: 400 });
    }
    const mediaType = mimeType.startsWith("image/") ? "photo" : "video";
    const objectName = kind === "thumbnail"
      ? `${randomUUID()}-poster.webp`
      : `${randomUUID()}.${MATCH_MEDIA_MIME_TYPES[mimeType]}`;
    const path = `${access.organizationId}/${fixtureId}/${objectName}`;
    try {
      const { data, error } = await access.supabase.storage.from(MATCH_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (error || !data) return json({ error: "Unable to prepare file upload." }, { status: 500 });
      const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!projectUrl) return json({ error: "Storage is not configured." }, { status: 500 });
      const projectHost = new URL(projectUrl).hostname;
      const suffix = ".supabase.co";
      if (!projectHost.endsWith(suffix)) return json({ error: "Storage is not configured." }, { status: 500 });
      const projectRef = projectHost.slice(0, -suffix.length);
      return json({
        path,
        token: data.token,
        endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
        mediaType,
        mimeType,
        kind,
      });
    } catch {
      return json({ error: "Storage unavailable." }, { status: 500 });
    }
  } catch {
    return json({ error: "Storage unavailable." }, { status: 500 });
  }
}
