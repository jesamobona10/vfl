"use client";

import { useRef, useState } from "react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { matchMeta, titleCase } from "@/lib/utils/helpers";
import { GripVertical, ImageIcon, Plus } from "lucide-react";
import { MatchFlyer } from "@/components/flyers/match-flyer";
import { TimeInput } from "../shared/time-input";
import { AddEventModal } from "./add-event-modal";

interface FixtureCardProps {
  match: Match;
  label: string;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  editable?: boolean;
  onDrop: (matchId: number, targetId: number) => void;
}

const EVENT_ABBR: Record<string, string> = {
  goal: "G", assist: "A", "own-goal": "OG", yellow: "Y", red: "R",
  save: "SV", "penalty-save": "PS", "clean-sheet": "CS",
  motm: "MOTM", error: "ERR", "penalty-conceded": "PC",
  tackle: "T", interception: "INT", block: "BLK", aerial: "AD",
  "goal-conceded": "GC", "match-win": "W", "bonus-5-saves": "5+S",
};

const EVENT_COLOR: Record<string, string> = {
  goal: "bg-brand/20 text-brand",
  assist: "bg-accent/20 text-accent",
  "own-goal": "bg-muted/20 text-muted",
  yellow: "bg-yellow-500/20 text-yellow-400",
  red: "bg-danger/20 text-danger",
  save: "bg-blue-500/20 text-blue-400",
  "penalty-save": "bg-blue-500/20 text-blue-400",
  "clean-sheet": "bg-green-500/20 text-green-400",
  motm: "bg-purple-500/20 text-purple-400",
  error: "bg-orange-500/20 text-orange-400",
  "penalty-conceded": "bg-orange-500/20 text-orange-400",
  tackle: "bg-cyan-500/20 text-cyan-400",
  interception: "bg-cyan-500/20 text-cyan-400",
  block: "bg-cyan-500/20 text-cyan-400",
  aerial: "bg-cyan-500/20 text-cyan-400",
  "goal-conceded": "bg-red-500/20 text-red-400",
  "match-win": "bg-green-500/20 text-green-400",
  "bonus-5-saves": "bg-blue-500/20 text-blue-400",
};

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
  const [showAddEvent, setShowAddEvent] = useState(false);
  const dragData = useRef<{ matchId: number } | null>(null);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const players = useAppStore((s) => s.players);

  const statusColors: Record<string, string> = {
    scheduled: "bg-muted/20 text-muted",
    "in-progress": "bg-accent/20 text-accent",
    completed: "bg-brand/20 text-brand",
    live: "bg-danger/20 text-danger",
  };

  const statusColor = statusColors[match.status] || "bg-muted/20 text-muted";

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

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const sourceId = Number(e.dataTransfer.getData("text/plain"));
    if (sourceId && sourceId !== match.id) onDrop(sourceId, match.id);
  };

  const showScore =
    match.status === "completed" ||
    match.status === "in-progress" ||
    match.status === "live";

  const events = match.events || [];
  const eventGoals = events.filter((e) => e.type === "goal" || e.type === "own-goal");
  const eventCards = events.filter((e) => e.type === "yellow" || e.type === "red");
  const eventOther = events.filter(
    (e) => e.type !== "goal" && e.type !== "own-goal" && e.type !== "yellow" && e.type !== "red"
  );

  const handleRemoveEvent = (index: number) => {
    const store = useAppStore.getState();
    const event = events[index];
    if (!event) return;
    const updatedEvents = events.filter((_, i) => i !== index);
    updateMatch(match.id, "events", updatedEvents);

    const player = store.players.find((p) => p.id === event.playerId);
    if (player) {
      const STAT_FIELD: Record<string, string> = {
        goal: "goals", assist: "assists", "own-goal": "ownGoals",
        yellow: "yellowCards", red: "redCards",
      };
      const field = STAT_FIELD[event.type];
      if (field) {
        store.updatePlayer(event.playerId, {
          [field]: Math.max(0, ((player as any)[field] || 0) - 1),
        });
      }
    }
    store.recalculateRatings();
  };

  const getPlayerName = (playerId: number) => {
    const p = players.find((pl) => pl.id === playerId);
    return p?.name || "Unknown";
  };

  const renderEventBadge = (event: typeof events[0], i: number) => {
    const color = EVENT_COLOR[event.type] || "bg-muted/20 text-muted";
    return (
      <span
        key={i}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}
      >
        <span className="font-semibold">{EVENT_ABBR[event.type] || event.type}</span>
        {getPlayerName(event.playerId)}
        {editable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveEvent(events.indexOf(event));
            }}
            className="ml-0.5 hover:text-danger leading-none"
          >
            &times;
          </button>
        )}
      </span>
    );
  };

  const allSortedEvents = [...eventGoals, ...eventCards, ...eventOther];

  return (
    <>
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
            {editable && (
              <span className="cursor-grab active:cursor-grabbing touch-none">
                <GripVertical size={14} className="text-muted/40" />
              </span>
            )}
            <span>{label}</span>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusColor}`}
            >
              {titleCase(match.status)}
            </span>
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

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center gap-3 justify-end min-w-0">
            <span className="font-semibold text-sm truncate text-right">
              {homeTeam?.name || "Unknown"}
            </span>
            {homeTeam?.logo_url ? (
              <img
                src={homeTeam.logo_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-muted shrink-0">
                {homeTeam?.name?.[0] || "?"}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            {showScore && match.homeScore != null && match.awayScore != null ? (
              <span className="text-xl font-bold tabular-nums">
                {match.homeScore}-{match.awayScore}
              </span>
            ) : editable ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={match.homeScore ?? ""}
                  onChange={(e) =>
                    updateMatch(match.id, "homeScore", e.target.value)
                  }
                  className="input text-sm py-1 w-10 text-center font-bold"
                  placeholder="H"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-muted font-bold text-sm">-</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={match.awayScore ?? ""}
                  onChange={(e) =>
                    updateMatch(match.id, "awayScore", e.target.value)
                  }
                  className="input text-sm py-1 w-10 text-center font-bold"
                  placeholder="A"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <span className="text-xs text-muted">vs</span>
            )}
          </div>

          <div className="flex items-center gap-3 justify-start min-w-0">
            {awayTeam?.logo_url ? (
              <img
                src={awayTeam.logo_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-muted shrink-0">
                {awayTeam?.name?.[0] || "?"}
              </div>
            )}
            <span className="font-semibold text-sm truncate">
              {awayTeam?.name || "Unknown"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {editable ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={match.venue || ""}
                onChange={(e) =>
                  updateMatch(match.id, "venue", e.target.value)
                }
                className="input text-xs py-1 w-full max-w-[140px]"
                placeholder="Venue"
                onClick={(e) => e.stopPropagation()}
              />
              <input
                type="date"
                value={match.date || ""}
                onChange={(e) =>
                  updateMatch(match.id, "date", e.target.value || null)
                }
                className="input text-xs py-1 w-32"
                onClick={(e) => e.stopPropagation()}
              />
              <TimeInput
                value={match.time || ""}
                onChange={(val) => updateMatch(match.id, "time", val)}
              />
            </div>
          ) : (
            <p className="text-xs text-muted truncate">{matchMeta(match)}</p>
          )}

          {editable && (
            <button
              onClick={() => setShowAddEvent(true)}
              className="btn-secondary text-xs py-1 px-3 shrink-0 flex items-center gap-1"
            >
              <Plus size={12} />
              Add Event
            </button>
          )}
        </div>

        {allSortedEvents.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-line">
            {allSortedEvents.map((event, i) => renderEventBadge(event, i))}
          </div>
        )}
      </article>

      {showAddEvent && (
        <AddEventModal
          match={match}
          homeTeamName={homeTeam?.name || "Home"}
          awayTeamName={awayTeam?.name || "Away"}
          onClose={() => setShowAddEvent(false)}
        />
      )}
    </>
  );
}
