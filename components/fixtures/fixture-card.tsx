"use client";

import { useRef, useState } from "react";
import type { Match, Team } from "@/lib/types";
import { matchMeta, titleCase } from "@/lib/utils/helpers";
import { GripVertical } from "lucide-react";

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

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
        isDragging
          ? "opacity-50 border-brand"
          : isDragOver
          ? "border-brand bg-brand/5 scale-[1.02]"
          : "border-line bg-surface hover:border-muted/30"
      }`}
    >
      <GripVertical
        size={16}
        className="text-muted/40 cursor-grab active:cursor-grabbing shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-muted font-medium">
            {label}
          </span>
        </div>
        <div className="font-semibold text-sm">
          <span>{homeTeam?.name || "Unknown"}</span>
          <span className="text-muted mx-1.5">vs</span>
          <span>{awayTeam?.name || "Unknown"}</span>
          {match.status === "completed" &&
            Number.isInteger(match.homeScore) &&
            Number.isInteger(match.awayScore) && (
              <span className="ml-2 text-muted font-mono">
                {match.homeScore}-{match.awayScore}
              </span>
            )}
        </div>
        <p className="text-xs text-muted truncate mt-0.5">
          {matchMeta(match)}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor}`}
      >
        {titleCase(match.status)}
      </span>
    </article>
  );
}
