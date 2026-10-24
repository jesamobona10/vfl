import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, json, parseJsonObject, requireAuth, asInteger } from "@/lib/security";
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
    const access = await getManageableFixtureMediaContext(fixtureId, auth!);
    if (access.response) return access.response;
    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });
    const mimeType = typeof parsed.data?.mimeType === "string" ? parsed.data.mimeType : "";
    const size = typeof parsed.data?.size === "number" ? parsed.data.size : 0;
    if (!isMatchMediaMimeType(mimeType)) return json({ error: "Unsupported image or video format." }, { status: 400 });
    if (!Number.isSafeInteger(size) || size < 1 || size > MATCH_MEDIA_MAX_FILE_BYTES) {
      return json({ error: "Files must be smaller than 100 MB." }, { status: 400 });
    }
    const mediaType = mimeType.startsWith("image/") ? "photo" : "video";
    const path = `${access.organizationId}/${fixtureId}/${randomUUID()}.${MATCH_MEDIA_MIME_TYPES[mimeType]}`;
    try {
      const { data, error } = await access.supabase.storage.from(MATCH_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (error || !data) return json({ error: "Unable to prepare file upload." }, { status: 500 });
      return json({ path, token: data.token, mediaType, mimeType });
    } catch {
      return json({ error: "Storage unavailable." }, { status: 500 });
    }
  } catch {
    return json({ error: "Storage unavailable." }, { status: 500 });
  }
}
