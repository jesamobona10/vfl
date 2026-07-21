"use client";

import { useRef, useState } from "react";
import type { Match, Team } from "@/lib/types";
import { matchMeta, titleCase } from "@/lib/utils/helpers";
import { GripVertical, ImageIcon } from "lucide-react";

interface FixtureCardProps {
  match: Match;
  label: string;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  onDrop: (matchId: number, targetId: number) => void;
}

export function FixtureCard({
  match,
  label,
  homeTeam,
  awayTeam,
  onDrop,
}: FixtureCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragData = useRef<{ matchId: number } | null>(null);

  const statusColors: Record<string, string> = {
    scheduled: "bg-muted/20 text-muted",
    "in-progress": "bg-accent/20 text-accent",
    completed: "bg-brand/20 text-brand",
    live: "bg-danger/20 text-danger",
  };

  const statusColor =
    statusColors[match.status] || "bg-muted/20 text-muted";

  const handleDragStart = (e: React.DragEvent) => {
    dragData.current = { matchId: match.id };
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(match.id));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setIsDragOver(false);
    dragData.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const sourceId = Number(e.dataTransfer.getData("text/plain"));
    if (sourceId && sourceId !== match.id) {
      onDrop(sourceId, match.id);
    }
  };

  const showScore =
    match.status === "completed" ||
    match.status === "in-progress" ||
    match.status === "live";

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col gap-3 px-4 py-4 rounded-3xl border transition-all ${
        isDragging
          ? "opacity-50 border-brand"
          : isDragOver
          ? "border-brand bg-brand/5 scale-[1.02]"
          : "border-line bg-surface hover:border-muted/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{label}</span>
          <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold">
            {titleCase(match.status)}
          </span>
        </div>
        {showScore && match.homeScore != null && match.awayScore != null ? (
          <div className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-text">
            {match.homeScore}-{match.awayScore}
          </div>
        ) : (
          <div className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted">
            {match.time || match.date || "TBA"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 text-right">
          <div className="font-semibold truncate">{homeTeam?.name || "Unknown"}</div>
          {match.homeScore != null && match.status !== "scheduled" ? (
            <div className="text-xs text-muted">{match.homeScore}</div>
          ) : null}
        </div>

        <div className="text-center text-xs text-muted uppercase tracking-[0.2em]">
          vs
        </div>

        <div className="min-w-0 text-left">
          <div className="font-semibold truncate">{awayTeam?.name || "Unknown"}</div>
          {match.awayScore != null && match.status !== "scheduled" ? (
            <div className="text-xs text-muted">{match.awayScore}</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted truncate">{matchMeta(match)}</p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(`/api/flyers/${match.id}`, "_blank");
          }}
          className="btn-icon shrink-0"
          title="Generate match flyer"
        >
          <ImageIcon size={14} />
        </button>
      </div>
    </article>
  );
}
