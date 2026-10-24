export const MATCH_MEDIA_BUCKET = "match-media";
export const MATCH_MEDIA_MAX_FILE_BYTES = 100 * 1024 * 1024;

export const MATCH_MEDIA_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
} as const;

export type MatchMediaMimeType = keyof typeof MATCH_MEDIA_MIME_TYPES;
export type MatchMediaType = "photo" | "video";
export type MatchMediaSource = "upload" | "link";

export interface MatchMediaItem {
  id: string;
  match_id: number;
  media_type: MatchMediaType;
  source_type: MatchMediaSource;
  url: string;
  embed_url: string | null;
  title: string;
  caption: string;
  mime_type: string | null;
  created_at: string;
}

export function isMatchMediaMimeType(value: string): value is MatchMediaMimeType {
  return Object.prototype.hasOwnProperty.call(MATCH_MEDIA_MIME_TYPES, value);
}

export function getVideoEmbedUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com") {
      const id = host === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      if (!id || !/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return null;
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }

    if (host === "vimeo.com") {
      const id = url.pathname.match(/^\/(?:video\/)?(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}
