"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Link2, LoaderCircle, RotateCw, Trash2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  getVideoEmbedUrl, isMatchMediaMimeType, MATCH_MEDIA_BUCKET, MATCH_MEDIA_CATEGORIES,
  MATCH_MEDIA_MAX_FILE_BYTES, type MatchMediaCategory, type MatchMediaItem,
} from "@/lib/match-media";
import { getVideoPoster, uploadMatchMediaWithTus } from "@/lib/upload-match-media";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
type UploadTask = {
  id: string; file: File; progress: number; status: "queued" | "uploading" | "saving" | "complete" | "failed";
  error?: string; path?: string; token?: string; posterPath?: string; posterToken?: string;
};

export function MatchMediaManager({ matchId, homeTeamName, awayTeamName, open, onClose }: {
  matchId: number; homeTeamName: string; awayTeamName: string; open: boolean; onClose: () => void;
}) {
  const [items, setItems] = useState<MatchMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const tasksRef = useRef<UploadTask[]>([]);
  const runningRef = useRef(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<MatchMediaCategory>("other");
  const [error, setError] = useState("");
  const toast = useToast();

  const updateTasks = (next: UploadTask[] | ((current: UploadTask[]) => UploadTask[])) => {
    tasksRef.current = typeof next === "function" ? next(tasksRef.current) : next;
    setTasks(tasksRef.current);
  };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/fixtures/${matchId}/media`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load media.");
      setItems(body.media || []); setCanPublish(Boolean(body.canPublish));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load media."); }
    finally { setLoading(false); }
  }, [matchId]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    let hadSuccess = false;
    while (true) {
      const task = tasksRef.current.find((entry) => entry.status === "queued");
      if (!task) break;
      updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, status: "uploading", error: undefined } : entry));
      try {
        let path = task.path;
        let token = task.token;
        if (!path || !token) {
          const signedResponse = await fetch(`/api/fixtures/${matchId}/media/upload-url`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mimeType: task.file.type, size: task.file.size }),
          });
          const signed = await signedResponse.json();
          if (!signedResponse.ok) throw new Error(signed.error || "Unable to prepare upload.");
          if (typeof signed.path !== "string" || typeof signed.token !== "string") throw new Error("Upload service returned an invalid token.");
          path = signed.path; token = signed.token;
          updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, path, token } : entry));
        }
        if (!path || !token) throw new Error("Upload service returned an invalid upload path.");
        await uploadMatchMediaWithTus({ file: task.file, path, token, onProgress: (progress) => updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, progress } : entry)) });

        let thumbnailPath: string | undefined;
        let posterMetadata: { width: number; height: number; durationSeconds: number | null } | null = null;
        if (task.file.type.startsWith("video/")) {
          const poster = await getVideoPoster(task.file);
          if (poster) {
            posterMetadata = { width: poster.width, height: poster.height, durationSeconds: poster.durationSeconds };
            let posterPath = task.posterPath;
            let posterToken = task.posterToken;
            if (!posterPath || !posterToken) {
              const posterSignedResponse = await fetch(`/api/fixtures/${matchId}/media/upload-url`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mimeType: "image/webp", size: poster.blob.size, kind: "thumbnail" }),
              });
              const posterSigned = await posterSignedResponse.json();
              if (!posterSignedResponse.ok) throw new Error(posterSigned.error || "Unable to prepare video poster.");
              if (typeof posterSigned.path !== "string" || typeof posterSigned.token !== "string") throw new Error("Upload service returned an invalid poster token.");
              posterPath = posterSigned.path; posterToken = posterSigned.token;
              updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, posterPath, posterToken } : entry));
            }
            const posterFile = new File([poster.blob], "poster.webp", { type: "image/webp" });
            if (!posterPath || !posterToken) throw new Error("Upload service returned an invalid poster path.");
            await uploadMatchMediaWithTus({ file: posterFile, path: posterPath, token: posterToken, onProgress: () => undefined });
            thumbnailPath = posterPath;
          }
        } else {
          try { const dimensions = await createImageBitmap(task.file); posterMetadata = { width: dimensions.width, height: dimensions.height, durationSeconds: null }; dimensions.close(); } catch { /* optional metadata */ }
        }
        updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, status: "saving", progress: 100 } : entry));
        const saved = await fetch(`/api/fixtures/${matchId}/media`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "upload", path, mimeType: task.file.type, title: task.file.name, caption, category, altText: task.file.name, fileSizeBytes: task.file.size, width: posterMetadata?.width, height: posterMetadata?.height, durationSeconds: posterMetadata?.durationSeconds, thumbnailPath }),
        });
        const savedBody = await saved.json();
        if (!saved.ok) {
          await fetch(`/api/fixtures/${matchId}/media/cleanup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, thumbnailPath }) }).catch(() => undefined);
          throw new Error(savedBody.error || "Unable to save media details.");
        }
        hadSuccess = true;
        updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, status: "complete" } : entry));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Upload failed.";
        updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, status: "failed", error: message } : entry));
      }
    }
    runningRef.current = false;
    setBusy(false);
    if (hadSuccess) { setCaption(""); await load(); toast.success("Match media added."); }
  }, [caption, category, load, matchId, toast]);

  function enqueueFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted: UploadTask[] = [];
    for (const file of Array.from(files)) {
      if (!isMatchMediaMimeType(file.type)) { setError(`${file.name}: unsupported file type.`); continue; }
      if (file.size < 1 || file.size > MATCH_MEDIA_MAX_FILE_BYTES) { setError(`${file.name}: files must be between 1 byte and 100 MB.`); continue; }
      accepted.push({ id: crypto.randomUUID(), file, progress: 0, status: "queued" });
    }
    if (accepted.length) { setError(""); updateTasks((current) => [...current, ...accepted]); window.setTimeout(() => void runQueue(), 0); }
  }

  async function addLink() {
    const embed = getVideoEmbedUrl(url.trim());
    if (!embed) { setError("Enter a valid YouTube or Vimeo link."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/fixtures/${matchId}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceType: "link", url: url.trim(), title: "Match highlight", caption, category }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to add highlight.");
      setUrl(""); setCaption(""); await load(); toast.success("Highlight added.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add highlight."); }
    finally { setBusy(false); }
  }

  async function remove(item: MatchMediaItem) {
    try {
      const response = await fetch(`/api/fixtures/${matchId}/media/${item.id}`, { method: "DELETE" });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to remove media.");
      setItems((current) => current.filter((entry) => entry.id !== item.id)); toast.success("Media removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove media."); }
  }

  async function moderate(item: MatchMediaItem, status: "published" | "rejected" | "hidden") {
    try {
      const response = await fetch(`/api/fixtures/${matchId}/media/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to update publication status.");
      await load(); toast.success(`Media ${status}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to moderate media."); }
  }

  function requestClose() {
    if (runningRef.current && !window.confirm("Uploads are still running. Close this panel and let them continue in the background?")) return;
    onClose();
  }

  return (
    <Modal open={open} onClose={requestClose} title="Match photos & highlights" subtitle={`${homeTeamName} vs ${awayTeamName}`} className="max-w-2xl">
      <div className="space-y-5">
        <p className="text-sm text-muted">Upload photos or videos up to 100 MB, or add a YouTube/Vimeo highlight link. New items from team accounts need FA approval before fans can see them.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={category} onChange={(event) => setCategory(event.target.value as MatchMediaCategory)} className="input sm:w-48">{MATCH_MEDIA_CATEGORIES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/30 p-3 text-sm font-semibold hover:border-brand/40">
            <Upload size={17} /> Add photos or videos
            <input type="file" accept={ACCEPT} multiple className="sr-only" onChange={(event) => { enqueueFiles(event.target.files); event.currentTarget.value = ""; }} />
          </label>
        </div>
        {tasks.length > 0 && <div className="space-y-2 rounded-xl border border-line p-3" aria-live="polite">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Upload queue</h3><span className="text-xs text-muted">Uploads run one at a time</span></div>
          {tasks.map((task) => <div key={task.id} className="flex items-center gap-2 rounded-lg bg-surface-2/30 p-2.5">
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{task.file.name}</p><p className="mt-0.5 text-[11px] text-muted">{task.status === "uploading" ? `Uploading · ${task.progress}%` : task.status === "saving" ? "Saving details…" : task.status === "complete" ? "Complete" : task.status === "failed" ? task.error : "Waiting"}</p>{(task.status === "uploading" || task.status === "saving") && <div className="mt-1.5 h-1 overflow-hidden rounded bg-surface-2"><div className="h-full bg-brand transition-[width]" style={{ width: `${task.progress}%` }} /></div>}</div>
            {task.status === "complete" ? <Check size={16} className="text-brand" /> : task.status === "failed" ? <button type="button" onClick={() => { updateTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, status: "queued", error: undefined } : entry)); void runQueue(); }} aria-label={`Retry ${task.file.name}`} className="btn-icon"><RotateCw size={15} /></button> : task.status === "queued" ? <button type="button" onClick={() => updateTasks((current) => current.filter((entry) => entry.id !== task.id))} aria-label={`Remove ${task.file.name} from queue`} className="btn-icon"><Trash2 size={15} /></button> : <LoaderCircle size={15} className="animate-spin text-muted" />}
          </div>)}
          {!busy && tasks.some((task) => task.status === "queued") && <button type="button" className="btn btn-primary w-full" onClick={() => void runQueue()}>Start uploads</button>}
        </div>}
        <div className="space-y-2"><div className="flex items-center gap-2"><Link2 size={16} className="text-muted" /><span className="text-sm font-semibold">Add a video highlight link</span></div><div className="flex flex-col gap-2 sm:flex-row"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtu.be/..." className="input min-w-0 flex-1" /><button type="button" onClick={() => void addLink()} disabled={busy || !url.trim()} className="btn btn-primary">Add highlight</button></div></div>
        <input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} placeholder="Optional caption for next item" className="input w-full" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="space-y-3 border-t border-line pt-4"><h3 className="text-sm font-semibold">Added media <span className="text-muted">({items.length})</span></h3>
          {loading ? <p className="text-sm text-muted">Loading media…</p> : items.length === 0 ? <p className="text-sm text-muted">No photos or highlights added yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <div key={item.id} className="overflow-hidden rounded-xl border border-line bg-surface-2/20">
            {item.media_type === "photo" ? <img src={item.url} alt={item.alt_text || item.title} loading="lazy" className="aspect-video w-full object-cover" /> : item.embed_url ? <div className="flex aspect-video items-center justify-center bg-surface-2 text-xs text-muted">External video link</div> : <video src={item.url} poster={item.thumbnail_url || undefined} controls preload="none" className="aspect-video w-full bg-black" />}
            <div className="flex items-start justify-between gap-2 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-[11px] font-semibold uppercase text-ink-3">{item.status} · {item.category?.replaceAll("_", " ")}</p>{item.caption && <p className="mt-0.5 text-xs text-muted">{item.caption}</p>}</div><button type="button" onClick={() => void remove(item)} aria-label={`Remove ${item.title}`} className="btn-icon text-danger"><Trash2 size={15} /></button></div>
            {canPublish && item.status !== "published" && <button type="button" className="btn btn-primary m-3 mt-0" onClick={() => void moderate(item, "published")}>Publish</button>}
            {canPublish && item.status === "published" && <button type="button" className="btn m-3 mt-0" onClick={() => void moderate(item, "hidden")}>Hide</button>}
            {canPublish && item.status === "pending" && <button type="button" className="btn m-3 mt-0" onClick={() => void moderate(item, "rejected")}>Reject</button>}
          </div>)}</div>}
        </div>
      </div>
    </Modal>
  );
}
