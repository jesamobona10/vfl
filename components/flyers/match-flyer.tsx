"use client";

import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { CalendarClock, Check, Copy, Download, Share2, X } from "lucide-react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useCompetition } from "@/lib/hooks/use-competitions";
import { useToast } from "@/components/ui/toast";
import { readFlyerSettings } from "@/lib/flyer/settings";
import { FlyerCanvas } from "./flyer-canvas";

interface MatchFlyerProps {
  match: Match;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  onClose: () => void;
}

const MODAL_CSS = `
  .flyer-container {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    background: rgba(0, 0, 0, 0.55);
    overflow-y: auto;
    padding: 24px 16px;
  }
  .flyer-panel {
    position: relative;
    width: 460px;
    max-width: 100%;
    margin: auto;
    display: flex;
    flex-direction: column;
    background: rgb(var(--surface));
    border: 1px solid rgb(var(--line));
    border-radius: 16px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
    outline: none;
    font-family: system-ui, -apple-system, sans-serif;
    max-height: calc(100vh - 48px);
  }
  .flyer-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid rgb(var(--line));
  }
  .flyer-panel-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: rgb(var(--text));
  }
  .flyer-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgb(var(--line));
    background: transparent;
    color: rgb(var(--text));
    cursor: pointer;
  }
  .flyer-close:hover { background: rgb(var(--surface-2)); }
  .flyer-scroll {
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .flyer-canvas-holder {
    align-self: center;
    max-width: 100%;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid rgb(var(--line));
  }
  .flyer-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgb(var(--muted));
  }
  .flyer-field { font-size: 12px; color: var(--ink-3); margin-top: -4px; }
  .flyer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid rgb(var(--line));
  }
`;

/** Wait for every raster asset and webfont used by the canvas before capture. */
async function waitForAssets(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
    })
  );

  const backgrounds = Array.from(
    element.querySelectorAll<HTMLElement>(".fc-bg")
  ).map((node) => (node.style.backgroundImage || "").replace(/^url\(["']?/, "").replace(/["']?\)$/, ""));
  await Promise.all(
    backgrounds.filter(Boolean).map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        })
    )
  );

  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.ready;
  }
}

async function captureFlyer(element: HTMLElement): Promise<Blob | null> {
  await waitForAssets(element);
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    width: element.scrollWidth,
    height: element.scrollHeight,
    scrollX: 0,
    scrollY: 0,
  });
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

function flyerFileName(matchId: string | number, home?: string, away?: string): string {
  const parts = [home || "home", "vs", away || "away"]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `flyer-${parts || matchId}.png`;
}

export function MatchFlyer({ match, homeTeam, awayTeam, onClose }: MatchFlyerProps) {
  const flyerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [baseline, setBaseline] = useState(() => ({
    date: match.date || "",
    time: match.time || "",
    venue: match.venue || "",
  }));
  const [date, setDate] = useState(() => match.date || "");
  const [time, setTime] = useState(() => match.time || "");
  const [venue, setVenue] = useState(() => match.venue || "");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"download" | "copy" | "share" | null>(null);
  const [error, setError] = useState("");

  const isAdmin = useAppStore((s) => s.isAdmin);
  const userProfile = useAppStore((s) => s.userProfile);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const toast = useToast();

  const { data: competition } = useCompetition(match.competition_id || undefined);
  const settings = readFlyerSettings(competition?.settings);

  const canEdit = isAdmin || userProfile?.role === "org_admin";
  const dirty = date !== baseline.date || time !== baseline.time || venue !== baseline.venue;
  const hasSchedule = Boolean(date && time);

  // Modal a11y: focus management, Escape, focus trap, body scroll lock.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const handleSave = async () => {
    if (date && !time) {
      setError("Add a kick-off time too, or clear the date.");
      return;
    }
    if (time && !date) {
      setError("Add a match date too, or clear the time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/fixtures/${match.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, venue }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Unable to save.");
        return;
      }
      updateMatch(match.id, "date", date);
      updateMatch(match.id, "time", time);
      updateMatch(match.id, "venue", venue);
      setBaseline({ date, time, venue });
      toast.success("Match details saved.");
    } catch {
      setError("Unable to save. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const getCanvasBlob = async (): Promise<Blob | null> => {
    if (!flyerRef.current) return null;
    return captureFlyer(flyerRef.current);
  };

  const handleDownload = async () => {
    setBusy("download");
    setError("");
    try {
      const blob = await getCanvasBlob();
      if (!blob) {
        setError("Could not generate the flyer.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = flyerFileName(match.id, homeTeam?.name, awayTeam?.name);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Flyer generation failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      toast.error("Copying images is not supported in this browser.");
      return;
    }
    setBusy("copy");
    setError("");
    try {
      const blob = await getCanvasBlob();
      if (!blob) {
        setError("Could not generate the flyer.");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Flyer copied to clipboard.");
    } catch {
      setError("Could not copy the image. Try downloading instead.");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (!navigator.share) {
      toast.error("Sharing is not supported in this browser.");
      return;
    }
    setBusy("share");
    setError("");
    try {
      const blob = await getCanvasBlob();
      if (!blob) {
        setError("Could not generate the flyer.");
        return;
      }
      const file = new File([blob], flyerFileName(match.id, homeTeam?.name, awayTeam?.name), {
        type: "image/png",
      });
      const shareData: ShareData = { files: [file], title: "Match flyer", text: "Match day flyer" };
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        toast.error("This browser cannot share image files.");
        return;
      }
      await navigator.share(shareData);
    } catch {
      // User cancellation is not an error.
      setError("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="flyer-container"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <style>{MODAL_CSS}</style>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flyer-dialog-title"
        tabIndex={-1}
        className="flyer-panel"
      >
        <div className="flyer-panel-header">
          <h2 id="flyer-dialog-title">Match Flyer</h2>
          <button type="button" className="flyer-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flyer-scroll">
          <div ref={flyerRef} className="flyer-canvas-holder">
            <FlyerCanvas
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              date={date}
              time={time}
              venue={venue}
              competitionName={competition?.name}
              settings={settings}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="flyer-section-title">
              <CalendarClock size={14} />
              Match details
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError("");
                }}
                disabled={!canEdit}
                className="input flex-1 text-sm py-1.5"
                aria-label="Match date"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setError("");
                }}
                disabled={!canEdit}
                className="input flex-1 text-sm py-1.5"
                aria-label="Match time"
              />
            </div>
            <input
              type="text"
              value={venue}
              onChange={(e) => {
                setVenue(e.target.value);
                setError("");
              }}
              disabled={!canEdit}
              placeholder="Venue"
              className="input w-full text-sm py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Match venue"
            />
            {!canEdit && (
              <p className="flyer-field">
                Date, time and venue are managed by an organizer — download or share as-is.
              </p>
            )}
            {!hasSchedule && (
              <p className="flyer-field">No kick-off set yet — the flyer shows “TBD”.</p>
            )}
            {error && <p style={{ fontSize: 12, color: "var(--danger-500)" }}>{error}</p>}
          </div>
        </div>

        <div className="flyer-actions">
          {canEdit && dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 justify-center text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy !== null || saving}
            className={`btn-secondary justify-center text-sm disabled:opacity-50 ${
              canEdit && dirty ? "" : "flex-1"
            }`}
          >
            <Download size={15} />
            {busy === "download" ? "Generating…" : "Download"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={busy !== null || saving}
            aria-label="Copy flyer to clipboard"
            className="btn-secondary justify-center text-sm disabled:opacity-50"
          >
            {busy === "copy" ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={busy !== null || saving}
            aria-label="Share flyer"
            className="btn-secondary justify-center text-sm disabled:opacity-50"
          >
            <Share2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
