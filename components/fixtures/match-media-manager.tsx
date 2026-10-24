"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  getVideoEmbedUrl, isMatchMediaMimeType, MATCH_MEDIA_BUCKET, MATCH_MEDIA_MAX_FILE_BYTES,
  type MatchMediaItem,
} from "@/lib/match-media";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export function MatchMediaManager({ matchId, homeTeamName, awayTeamName, open, onClose }: {
  matchId: number; homeTeamName: string; awayTeamName: string; open: boolean; onClose: () => void;
}) {
  const [items, setItems] = useState<MatchMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/fixtures/${matchId}/media`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load media.");
      setItems(body.media || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load media.");
    } finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true); setError("");
    try {
      for (const file of Array.from(files)) {
        if (!isMatchMediaMimeType(file.type)) throw new Error(`${file.name}: unsupported file type.`);
        if (file.size > MATCH_MEDIA_MAX_FILE_BYTES) throw new Error(`${file.name}: files must be under 100 MB.`);
        const signedResponse = await fetch(`/api/fixtures/${matchId}/media/upload-url`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mimeType: file.type, size: file.size }),
        });
        const signed = await signedResponse.json();
        if (!signedResponse.ok) throw new Error(signed.error || "Unable to prepare upload.");
        const storage = createClient();
        const { error: uploadError } = await storage.storage.from(MATCH_MEDIA_BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message || "Upload failed.");
        const saved = await fetch(`/api/fixtures/${matchId}/media`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "upload", path: signed.path, mimeType: file.type, title: file.name, caption }),
        });
        const body = await saved.json();
        if (!saved.ok) throw new Error(body.error || "Unable to save media details.");
      }
      setCaption(""); await load(); toast.success("Match media added.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  async function addLink() {
    const embed = getVideoEmbedUrl(url.trim());
    if (!embed) { setError("Enter a valid YouTube or Vimeo link."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/fixtures/${matchId}/media`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "link", url: url.trim(), title: "Match highlight", caption }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to add highlight.");
      setUrl(""); setCaption(""); await load(); toast.success("Highlight added.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add highlight."); }
    finally { setBusy(false); }
  }

  async function remove(item: MatchMediaItem) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/fixtures/${matchId}/media/${item.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to remove media.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      toast.success("Media removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove media."); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Match photos & highlights" subtitle={`${homeTeamName} vs ${awayTeamName}`} className="max-w-2xl">
      <div className="space-y-5">
        <p className="text-sm text-muted">Upload photos or videos (up to 100 MB), or add a YouTube/Vimeo highlight link. Fans can view these on the public match page.</p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/30 p-4 text-sm font-semibold hover:border-brand/40">
          {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Upload size={17} />} Add photos or videos
          <input type="file" accept={ACCEPT} multiple disabled={busy} className="sr-only" onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} />
        </label>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Link2 size={16} className="text-muted" /><span className="text-sm font-semibold">Add a video highlight link</span></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtu.be/..." className="input min-w-0 flex-1" />
            <button type="button" onClick={() => void addLink()} disabled={busy || !url.trim()} className="btn btn-primary">Add highlight</button>
          </div>
        </div>
        <input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} placeholder="Optional caption for next item" className="input w-full" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">Added media <span className="text-muted">({items.length})</span></h3>
          {loading ? <p className="text-sm text-muted">Loading media…</p> : items.length === 0 ? <p className="text-sm text-muted">No photos or highlights added yet.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => <div key={item.id} className="overflow-hidden rounded-xl border border-line bg-surface-2/20">
                {item.media_type === "photo" ? <img src={item.url} alt={item.title} className="aspect-video w-full object-cover" /> : item.embed_url ? <iframe src={item.embed_url} title={item.title} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <video src={item.url} controls preload="metadata" className="aspect-video w-full bg-black" />}
                <div className="flex items-start justify-between gap-2 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p>{item.caption && <p className="mt-0.5 text-xs text-muted">{item.caption}</p>}</div>
                  <button type="button" onClick={() => void remove(item)} disabled={busy} aria-label={`Remove ${item.title}`} className="btn-icon text-danger"><Trash2 size={15} /></button></div>
              </div>)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
