"use client";

import { useRef, useState } from "react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { matchMeta, titleCase } from "@/lib/utils/helpers";
import { GripVertical, ImageIcon } from "lucide-react";
import { MatchFlyer } from "@/components/flyers/match-flyer";
import { TimeInput } from "../shared/time-input";

interface FixtureCardProps {
  match: Match;
  label: string;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  editable?: boolean;
  onDrop: (matchId: number, targetId: number) => void;
}

export function FixtureCard({
  match,
  label,
  homeTeam,
  awayTeam,
  editable,
  onDrop,
}: FixtureCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFlyer, setShowFlyer] = useState(false);
  const dragData = useRef<{ matchId: number } | null>(null);
  const updateMatch = useAppStore((s) => s.updateMatch);

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
        ) : editable ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={match.date || ""}
              onChange={(e) => updateMatch(match.id, "date", e.target.value || null)}
              className="input text-xs py-1 w-32 text-center"
              onClick={(e) => e.stopPropagation()}
            />
            <TimeInput
              value={match.time || ""}
              onChange={(val) => updateMatch(match.id, "time", val)}
            />
          </div>
        ) : (
          <div className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted">
            {match.time || match.date || "TBA"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 text-right flex items-center gap-2 justify-end">
          <span className="font-semibold truncate">{homeTeam?.name || "Unknown"}</span>
          {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />}
        </div>
        <div className="text-center text-xs text-muted uppercase tracking-[0.2em]">
          vs
        </div>
        <div className="min-w-0 text-left flex items-center gap-2">
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />}
          <span className="font-semibold truncate">{awayTeam?.name || "Unknown"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {editable && (
            <input
              type="text"
              value={match.venue || ""}
              onChange={(e) => updateMatch(match.id, "venue", e.target.value)}
              className="input text-xs py-1 w-40"
              placeholder="Venue"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {!editable && <p className="text-xs text-muted truncate">{matchMeta(match)}</p>}
        </div>
        <div className="flex items-center gap-1">
          {showFlyer && (
            <MatchFlyer
              match={match}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              onClose={() => setShowFlyer(false)}
            />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFlyer(true);
            }}
            className="btn-icon shrink-0"
            title="Generate match flyer"
          >
            <ImageIcon size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
