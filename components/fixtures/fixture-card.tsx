"use client";

import { useState } from "react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { titleCase } from "@/lib/utils/helpers";
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
  const [showAddEvent, setShowAddEvent] = useState(false);
  const players = useAppStore((s) => s.players);
  const updateMatch = useAppStore((s) => s.updateMatch);

  const statusColors: Record<string, string> = {
    scheduled: "bg-muted/20 text-muted",
    "in-progress": "bg-accent/20 text-accent",
    completed: "bg-brand/20 text-brand",
    live: "bg-danger/20 text-danger",
  };

  const statusColor = statusColors[match.status] || "bg-muted/20 text-muted";

  const events = match.events || [];

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

  return (
    <>
      <article
        onClick={() => setShowAddEvent(true)}
        className={`flex flex-col gap-3 px-4 py-4 rounded-3xl border transition-all cursor-pointer ${
          editable
            ? "border-line bg-surface hover:border-brand/30 hover:bg-surface-2/30 hover:shadow-sm"
            : "border-line bg-surface"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{label}</span>
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusColor}`}>
              {titleCase(match.status)}
            </span>
          </div>
          {editable && (
            <span className="text-xs text-muted/40 group-hover:text-muted/60 transition-colors">
              +
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-3 justify-end min-w-0">
            <span className="font-semibold text-base truncate text-right">
              {homeTeam?.name || "Unknown"}
            </span>
            {homeTeam?.logo_url ? (
              <img src={homeTeam.logo_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-muted shrink-0">
                {homeTeam?.name?.[0] || "?"}
              </div>
            )}
          </div>

          <span className="text-xs text-muted uppercase tracking-[0.15em] font-semibold">vs</span>

          <div className="flex items-center gap-3 justify-start min-w-0">
            {awayTeam?.logo_url ? (
              <img src={awayTeam.logo_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-muted shrink-0">
                {awayTeam?.name?.[0] || "?"}
              </div>
            )}
            <span className="font-semibold text-base truncate">
              {awayTeam?.name || "Unknown"}
            </span>
          </div>
        </div>

        {events.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-line" onClick={(e) => e.stopPropagation()}>
            {events.map((event, i) => renderEventBadge(event, i))}
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
