/**
 * Full-screen celebration modal with canvas animation and download options.
 */
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Image as ImageIcon, Film, File, FileVideo } from "lucide-react";
import type { Champion } from "@/lib/celebration/winner";
import { createCelebrationRenderer, DEFAULT_CELEBRATION_SIZE } from "@/lib/celebration/animation";
import { encodeGif, encodePoster, encodeVideo, downloadBlob } from "@/lib/celebration/encode";
import { validateBrandColor } from "@/lib/branding";
import { useToast } from "@/components/ui/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  champion: Champion;
  accent?: string | null;
}

export function ChampionCelebration({ open, onClose, champion, accent }: Props) {
  const [downloading, setDownloading] = useState<"png" | "gif" | "mp4" | "mkv" | null>(null);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const toast = useToast();

  const resolvedAccent = validateBrandColor(accent).palette?.base ?? "#0f7c45";
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const render = createCelebrationRenderer({
      width: DEFAULT_CELEBRATION_SIZE.width,
      height: DEFAULT_CELEBRATION_SIZE.height,
      durationMs: 4000,
      champion,
      theme: {
        accent: resolvedAccent,
        accentAlt: "#f5d26c",
        backgroundFrom: "#0b1020",
        backgroundTo: "#162036",
        text: "#ffffff",
        textMuted: "rgba(255,255,255,0.72)",
        centerAccent: "#f5d26c",
      },
    });
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const w = DEFAULT_CELEBRATION_SIZE.width;
    const h = DEFAULT_CELEBRATION_SIZE.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    startRef.current = performance.now();
    const loop = () => {
      const t = performance.now() - startRef.current;
      render(ctx, t % 4000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [open, champion, resolvedAccent]);

  async function doDownload(format: "png" | "gif" | "mp4" | "mkv") {
    setDownloading(format);
    setProgress(0);
    try {
      const result = await (format === "png"
        ? encodePoster({ champion, accent: resolvedAccent, onProgress: (_, r) => setProgress(r) })
        : format === "gif"
          ? encodeGif({ champion, accent: resolvedAccent, onProgress: (_, r) => setProgress(r) })
          : encodeVideo(format, { champion, accent: resolvedAccent, onProgress: (_, r) => setProgress(r) }));
      downloadBlob(result.blob, result.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      toast.error(msg);
    } finally {
      setDownloading(null);
      setProgress(0);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      <div className="relative h-full w-full flex flex-col items-center justify-start overflow-auto py-6 px-4">
        <div className="relative mb-4">
          <canvas ref={canvasRef} className="rounded-2xl shadow-2xl w-full max-w-[720px] h-auto" aria-label="Champion celebration animation" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 btn-ghost bg-surface/90 backdrop-blur rounded-full p-2"
            aria-label="Close celebration"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => doDownload("png")}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {downloading === "png" ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            PNG
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => doDownload("gif")}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {downloading === "gif" ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
            GIF
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => doDownload("mp4")}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {downloading === "mp4" ? <Loader2 size={16} className="animate-spin" /> : <FileVideo size={16} />}
            MP4
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => doDownload("mkv")}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {downloading === "mkv" ? <Loader2 size={16} className="animate-spin" /> : <File size={16} />}
            MKV
          </button>
        </div>
        {downloading && (
          <div className="mt-3 text-xs text-ink-2">
            Encoding {downloading.toUpperCase()}… {(progress * 100).toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}
