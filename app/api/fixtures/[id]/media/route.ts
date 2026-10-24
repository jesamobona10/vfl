import { createClient } from "@/lib/supabase/server";
import {
  asInteger,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
} from "@/lib/security";
import { getManageableFixtureMediaContext } from "@/lib/match-media-access";
import {
  getVideoEmbedUrl,
  isMatchMediaMimeType,
  MATCH_MEDIA_BUCKET,
  MATCH_MEDIA_CATEGORIES,
  MATCH_MEDIA_MAX_FILE_BYTES,
} from "@/lib/match-media";

export const dynamic = "force-dynamic";

async function getContext(id: string) {
  const fixtureId = asInteger(id, 1);
  if (!fixtureId) return { error: json({ error: "Invalid fixture id." }, { status: 400 }) };
  const session = await createClient();
  const auth = await getAuthContext(session);
  const authError = requireAuth(auth);
  if (authError) return { error: authError };
  const access = await getManageableFixtureMediaContext(fixtureId, auth!);
  if (access.response) return { error: access.response };
  return { fixtureId, auth: auth!, ...access };
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const context = await getContext((await props.params).id);
    if (context.error) return context.error;
    let { data, error } = await context.supabase
      .from("match_media")
      .select("id, match_id, organization_id, media_type, source_type, url, storage_path, thumbnail_path, mime_type, title, caption, category, status, file_size_bytes, duration_seconds, width, height, alt_text, sort_order, created_at, approved_by, approved_at")
      .eq("match_id", context.fixtureId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      // Table may not exist yet in some environments
      if ((error as any)?.code === "42P01") return json({ media: [] });
      // Keep the manager usable when the base media migration is deployed but
      // the additive moderation/metadata migration has not reached production.
      if (["42703", "PGRST204"].includes((error as any)?.code)) {
        const legacy = await context.supabase
          .from("match_media")
          .select("id, match_id, organization_id, media_type, source_type, url, storage_path, mime_type, title, caption, created_at")
          .eq("match_id", context.fixtureId)
          .order("created_at", { ascending: false });
        data = legacy.data as typeof data;
        error = legacy.error;
        if (!error && data) {
          const media = data.map((row) => ({
            ...row,
            category: "other",
            status: "published",
            thumbnail_path: null,
            thumbnail_url: null,
            file_size_bytes: null,
            duration_seconds: null,
            width: null,
            height: null,
            alt_text: row.title,
            sort_order: 0,
            approved_by: null,
            approved_at: null,
            embed_url: row.source_type === "link" ? getVideoEmbedUrl(row.url) : null,
            can_publish: context.canPublish,
          }));
          return json({ media, canPublish: context.canPublish, migrationPending: true });
        }
      }
    }
    if (error) {
      logApiError("fixture_media_list_query_failed", error, { fixtureId: context.fixtureId });
      return json({ error: "Unable to load fixture media." }, { status: 500 });
    }
    return json({
      media: (data || []).map((row) => ({
        ...row,
        embed_url: row.source_type === "link" ? getVideoEmbedUrl(row.url) : null,
        thumbnail_url: row.thumbnail_path
          ? context.supabase.storage.from(MATCH_MEDIA_BUCKET).getPublicUrl(row.thumbnail_path).data.publicUrl
          : null,
        can_publish: context.canPublish,
      })),
      canPublish: context.canPublish,
    });
  } catch (error) {
    logApiError("fixture_media_list_failed", error);
    return json({ error: "Unable to load fixture media." }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const context = await getContext((await props.params).id);
  if (context.error) return context.error;
  const limited = await rateLimit({
    key: `match-media-metadata:${getClientIp(request)}:${context.auth.userId}`,
    limit: 40,
    windowMs: 60 * 60_000,
  });
  if (limited.limited) return rateLimitResponse(limited.resetAt);
  const parsed = await parseJsonObject(request);
  if (parsed.error) return json({ error: parsed.error }, { status: 400 });
  const body = parsed.data!;
  const sourceType = body.sourceType;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 500) : "";
  const altText = typeof body.altText === "string" ? body.altText.trim().slice(0, 240) : "";
  const requestedCategory = typeof body.category === "string" ? body.category : "other";
  const category = MATCH_MEDIA_CATEGORIES.some((entry) => entry.value === requestedCategory)
    ? requestedCategory
    : null;
  if (!category) return json({ error: "Invalid media category." }, { status: 400 });
  const dimension = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 20_000
      ? value
      : null;
  const width = dimension(body.width);
  const height = dimension(body.height);
  const durationSeconds = typeof body.durationSeconds === "number"
    && Number.isFinite(body.durationSeconds)
    && body.durationSeconds >= 0
    && body.durationSeconds <= 86_400
    ? body.durationSeconds
    : null;
  let row: Record<string, unknown>;
  let storagePath: string | null = null;
  let thumbnailPath: string | null = null;
  if (sourceType === "link") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!getVideoEmbedUrl(url)) return json({ error: "Enter a valid YouTube or Vimeo video URL." }, { status: 400 });
    row = { source_type: "link", media_type: "video", url, storage_path: null, mime_type: null };
  } else if (sourceType === "upload") {
    const path = typeof body.path === "string" ? body.path : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const expectedPrefix = `${context.organizationId}/${context.fixtureId}/`;
    const basename = path.slice(expectedPrefix.length);
    if (
      !path.startsWith(expectedPrefix) ||
      path.includes("..") ||
      basename.includes("/") ||
      !/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(basename) ||
      !isMatchMediaMimeType(mimeType)
    ) {
      return json({ error: "Invalid uploaded media." }, { status: 400 });
    }
    const mediaType = mimeType.startsWith("image/") ? "photo" : "video";
    try {
      const { data: files, error: listError } = await context.supabase.storage
        .from(MATCH_MEDIA_BUCKET)
        .list(`${context.organizationId}/${context.fixtureId}`, { search: basename });
      const file = files?.find((entry) => entry.name === basename);
      if (listError || !file) return json({ error: "Uploaded file not found." }, { status: 400 });
      const actualSize = Number(file.metadata?.size);
      const actualMime = typeof file.metadata?.mimetype === "string" ? file.metadata.mimetype : mimeType;
      if (Number.isFinite(actualSize) && (actualSize < 1 || actualSize > MATCH_MEDIA_MAX_FILE_BYTES)) {
        return json({ error: "Uploaded file must be 100 MB or smaller." }, { status: 400 });
      }
      if (actualMime !== mimeType) return json({ error: "Uploaded file type does not match its metadata." }, { status: 400 });
      if (Number.isFinite(actualSize) && typeof body.fileSizeBytes === "number" && actualSize !== body.fileSizeBytes) {
        return json({ error: "Uploaded file size does not match its metadata." }, { status: 400 });
      }
      const { data: existing } = await context.supabase
        .from("match_media")
        .select("*")
        .eq("storage_path", path)
        .maybeSingle();
      if (existing) return json({ media: existing, duplicate: true }, { status: 200 });
      const { data } = context.supabase.storage.from(MATCH_MEDIA_BUCKET).getPublicUrl(path);
      row = { source_type: "upload", media_type: mediaType, url: data.publicUrl, storage_path: path, mime_type: mimeType };
      storagePath = path;
      const requestedThumbnail = typeof body.thumbnailPath === "string" ? body.thumbnailPath : "";
      if (requestedThumbnail) {
        const thumbnailBase = requestedThumbnail.slice(expectedPrefix.length);
        if (
          !requestedThumbnail.startsWith(expectedPrefix) ||
          requestedThumbnail.includes("..") ||
          !/^[0-9a-f-]{36}-poster\.webp$/i.test(thumbnailBase)
        ) {
          return json({ error: "Invalid thumbnail." }, { status: 400 });
        }
        const { data: thumbnailFiles, error: thumbnailError } = await context.supabase.storage
          .from(MATCH_MEDIA_BUCKET)
          .list(`${context.organizationId}/${context.fixtureId}`, { search: thumbnailBase });
        const thumbnail = thumbnailFiles?.find((entry) => entry.name === thumbnailBase);
        if (thumbnailError || !thumbnail || thumbnail.metadata?.mimetype && thumbnail.metadata.mimetype !== "image/webp") {
          return json({ error: "Uploaded thumbnail not found." }, { status: 400 });
        }
        thumbnailPath = requestedThumbnail;
      }
    } catch {
      return json({ error: "Storage unavailable." }, { status: 500 });
    }
  } else return json({ error: "Invalid media source." }, { status: 400 });

  try {
    const status = context.canPublish ? "published" : "pending";
    const metadata = {
      ...row,
      match_id: context.fixtureId,
      organization_id: context.organizationId,
      title: title || (row.media_type === "photo" ? "Match photo" : "Match video"),
      caption,
      category,
      status,
      thumbnail_path: thumbnailPath,
      file_size_bytes: typeof body.fileSizeBytes === "number" && Number.isSafeInteger(body.fileSizeBytes)
        && body.fileSizeBytes >= 0 && body.fileSizeBytes <= MATCH_MEDIA_MAX_FILE_BYTES
        ? body.fileSizeBytes
        : null,
      duration_seconds: durationSeconds,
      width,
      height,
      alt_text: altText || title,
      created_by: context.auth.userId,
      approved_by: context.canPublish ? context.auth.userId : null,
      approved_at: context.canPublish ? new Date().toISOString() : null,
    };
    const { data, error } = await context.supabase.from("match_media").insert({
      ...metadata,
    }).select("*").single();
    if (error || !data) {
      if ((error as any)?.code === "42P01") return json({ error: "Media storage not configured." }, { status: 500 });
      if ((error as any)?.code === "23505" && storagePath) {
        const { data: existing } = await context.supabase.from("match_media").select("*").eq("storage_path", storagePath).maybeSingle();
        if (existing) return json({ media: existing, duplicate: true }, { status: 200 });
      }
      if (storagePath || thumbnailPath) {
        const cleanupPaths = [storagePath, thumbnailPath].filter((path): path is string => Boolean(path));
        const { error: cleanupError } = await context.supabase.storage.from(MATCH_MEDIA_BUCKET).remove(cleanupPaths);
        logApiError("match_media_metadata_insert_failed", error, {
          fixtureId: context.fixtureId,
          organizationId: context.organizationId,
          objectPaths: cleanupPaths,
          cleanupFailed: Boolean(cleanupError),
        });
      }
      return json({ error: "Unable to save fixture media." }, { status: 500 });
    }
    logSecurityEvent("match_media_uploaded", { fixtureId: context.fixtureId, mediaId: data.id, organizationId: context.organizationId, status });
    return json({ media: { ...data, embed_url: data.source_type === "link" ? getVideoEmbedUrl(data.url) : null }, status }, { status: 201 });
  } catch (error) {
    if (storagePath || thumbnailPath) {
      const cleanupPaths = [storagePath, thumbnailPath].filter((path): path is string => Boolean(path));
      const { error: cleanupError } = await context.supabase.storage.from(MATCH_MEDIA_BUCKET).remove(cleanupPaths);
      logApiError("match_media_insert_exception", error, {
        fixtureId: context.fixtureId,
        organizationId: context.organizationId,
        objectPaths: cleanupPaths,
        cleanupFailed: Boolean(cleanupError),
      });
    }
    return json({ error: "Media storage not configured." }, { status: 500 });
  }
}
