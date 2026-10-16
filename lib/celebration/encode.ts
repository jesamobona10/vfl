/**
 * Client-side encoding (GIF/PNG/MP4/MKV) for the celebration animation.
 */
import type { Champion } from "./winner";
import { DEFAULT_CELEBRATION_SIZE, createCelebrationRenderer, type CelebrationTheme } from "./animation";
import { mix } from "@/lib/branding";

export interface CelebrationEncodeOptions {
  champion: Champion;
  accent: string;
  width?: number;
  height?: number;
  durationMs?: number;
  fps?: number;
  onProgress?: (stage: "png" | "gif" | "mp4" | "mkv" | "prepare", ratio: number) => void;
}

export interface EncodedResult {
  blob: Blob;
  url: string;
  mime: string;
  name: string;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function buildTheme(accent: string): CelebrationTheme {
  const bgFrom = mix(accent, "#0b1020", 0.08);
  const bgTo = mix(accent, "#162036", 0.12);
  const center = "#f5d26c";
  return {
    accent,
    accentAlt: center,
    backgroundFrom: bgFrom,
    backgroundTo: bgTo,
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.72)",
    centerAccent: center,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/** Build a Blob from bytes, copying into a plain ArrayBuffer for TS/DOM compatibility. */
function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

export async function encodePoster(opts: CelebrationEncodeOptions): Promise<EncodedResult> {
  const { champion, accent, onProgress } = opts;
  const width = opts.width ?? DEFAULT_CELEBRATION_SIZE.width;
  const height = opts.height ?? DEFAULT_CELEBRATION_SIZE.height;
  const durationMs = opts.durationMs ?? 4000;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  onProgress?.("png", 0.05);
  const render = createCelebrationRenderer({
    width,
    height,
    durationMs,
    champion,
    theme: buildTheme(accent),
  });
  render(ctx, durationMs);
  onProgress?.("png", 0.6);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 0.95)
  );
  onProgress?.("png", 1);
  const safeName = champion.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "champions";
  return { blob, url: URL.createObjectURL(blob), mime: "image/png", name: `${safeName}-champions.png` };
}

export async function encodeGif(opts: CelebrationEncodeOptions): Promise<EncodedResult> {
  const { champion, accent, onProgress } = opts;
  const width = opts.width ?? 360;
  const height = opts.height ?? 450;
  const durationMs = opts.durationMs ?? 3000;
  const fps = opts.fps ?? 12;
  onProgress?.("gif", 0);
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not supported");
  const render = createCelebrationRenderer({
    width,
    height,
    durationMs,
    champion,
    theme: buildTheme(accent),
  });
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * fps));
  const gif = GIFEncoder({ auto: true });
  let palette: number[][] | null = null;
  for (let i = 0; i < frameCount; i++) {
    const t = (i / frameCount) * durationMs;
    render(ctx, t);
    const data = ctx.getImageData(0, 0, width, height).data;
    if (palette === null) {
      palette = quantize(data, 256);
    }
    const index = applyPalette(data, palette);
    const delay = Math.round(1000 / fps);
    if (i === 0) {
      gif.writeFrame(index, width, height, { palette, delay, repeat: 0 });
    } else {
      gif.writeFrame(index, width, height, { delay });
    }
    onProgress?.("gif", (i + 1) / frameCount);
    await nextFrame();
  }
  gif.finish();
  const bytes = gif.bytes();
  const blob = bytesToBlob(bytes, "image/gif");
  const safeName = champion.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "champions";
  return { blob, url: URL.createObjectURL(blob), mime: "image/gif", name: `${safeName}-champions.gif` };
}

export async function encodeVideo(
  format: "mp4" | "mkv",
  opts: CelebrationEncodeOptions,
): Promise<EncodedResult> {
  const { champion, accent, onProgress } = opts;
  const width = opts.width ?? DEFAULT_CELEBRATION_SIZE.width;
  const height = opts.height ?? DEFAULT_CELEBRATION_SIZE.height;
  const durationMs = opts.durationMs ?? 4000;
  const fps = opts.fps ?? 30;
  onProgress?.("prepare", 0.05);
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = new FFmpeg();
  ffmpeg.on("progress", (evt: { progress: number; time: number }) => {
    // progress is 0-1; map to overall 60% encoding phase
    onProgress?.(format, 0.6 + evt.progress * 0.4);
  });
  // ffmpeg.wasm resolves these relative to its own module URL (import.meta.url),
  // which a bundler may not populate with a usable origin. Passing fully
  // absolute URLs sidesteps that resolution entirely.
  const origin = window.location.origin;
  await ffmpeg.load({
    classWorkerURL: `${origin}/ffmpeg-core/worker.js`,
    coreURL: `${origin}/ffmpeg-core/ffmpeg-core.js`,
    wasmURL: `${origin}/ffmpeg-core/ffmpeg-core.wasm`,
  });
  onProgress?.(format, 0.15);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not supported");
  const render = createCelebrationRenderer({
    width,
    height,
    durationMs,
    champion,
    theme: buildTheme(accent),
  });
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * fps));
  for (let i = 0; i < frameCount; i++) {
    const t = (i / frameCount) * durationMs;
    render(ctx, t);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 0.95)
    );
    const buf = new Uint8Array(await blob.arrayBuffer());
    await ffmpeg.writeFile(`frame${String(i).padStart(4, "0")}.png`, buf);
    onProgress?.(format, 0.15 + (i + 1) / frameCount * 0.45);
    await nextFrame();
  }
  const out = format === "mkv" ? "out.mkv" : "out.mp4";
  const args = [
    "-framerate",
    String(fps),
    "-i",
    "frame%04d.png",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
  ];
  if (format === "mp4") args.push("-movflags", "+faststart");
  args.push(out);
  await ffmpeg.exec(args);
  onProgress?.(format, 0.99);
  const data = await ffmpeg.readFile(out);
  const bytes = data as Uint8Array;
  const mime = format === "mkv" ? "video/x-matroska" : "video/mp4";
  const blob = bytesToBlob(bytes, mime);
  const safeName = champion.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "champions";
  ffmpeg.terminate();
  onProgress?.(format, 1);
  return { blob, url: URL.createObjectURL(blob), mime, name: `${safeName}-champions.${format}` };
}

export async function encodeAll(
  format: "png" | "gif" | "mp4" | "mkv",
  opts: CelebrationEncodeOptions,
): Promise<EncodedResult> {
  switch (format) {
    case "png":
      return encodePoster(opts);
    case "gif":
      return encodeGif(opts);
    case "mp4":
      return encodeVideo("mp4", opts);
    case "mkv":
      return encodeVideo("mkv", opts);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
