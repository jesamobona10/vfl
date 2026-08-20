"use client";

import { useState } from "react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { AddEventModal } from "@/components/fixtures/add-event-modal";
import { LiveClock } from "./live-clock";
import { useLiveClock } from "./live-clock";
import { CheckCircle, Plus, Flag } from "lucide-react";
import type { LiveClockSettings } from "@/lib/logic/live";
import Image from "next/image";

const EVENT_ABBR: Record<string, string> = {
  goal: "G",
  assist: "A",
  "own-goal": "OG",
  yellow: "Y",
  red: "R",
  save: "SV",
  "penalty-save": "PS",
  "clean-sheet": "CS",
  motm: "MOTM",
  error: "ERR",
  "penalty-conceded": "PC",
  tackle: "T",
  interception: "INT",
  block: "BLK",
  aerial: "AD",
  "goal-conceded": "GC",
  "match-win": "W",
  "bonus-5-saves": "5+S",
};

const EVENT_COLOR: Record<string, string> = {
  goal: "bg-brand/20 text-brand",
  assist: "bg-accent/20 text-accent",
  "own-goal": "bg-muted/20 text-muted",
  yellow: "bg-warn-500/20 text-warn-500",
  red: "bg-danger/20 text-danger",
  save: "bg-live-500/20 text-live-500",
  "penalty-save": "bg-live-500/20 text-live-500",
  "clean-sheet": "bg-live-500/20 text-live-500",
  motm: "bg-gold-500/20 text-gold-700",
  error: "bg-warn-500/20 text-warn-500",
  "penalty-conceded": "bg-warn-500/20 text-warn-500",
  tackle: "bg-brand-600/20 text-brand-600",
  interception: "bg-brand-600/20 text-brand-600",
  block: "bg-brand-600/20 text-brand-600",
  aerial: "bg-brand-600/20 text-brand-600",
  "goal-conceded": "bg-danger-500/20 text-danger-500",
  "match-win": "bg-live-500/20 text-live-500",
  "bonus-5-saves": "bg-live-500/20 text-live-500",
};

interface LiveMatchCardProps {
  match: Match;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  settings?: LiveClockSettings;
  canEdit: boolean;
  onFinished: () => void;
}

export function LiveMatchCard({
  match,
  homeTeam,
  awayTeam,
  settings,
  canEdit,
  onFinished,
}: LiveMatchCardProps) {
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const phase = useLiveClock(match.live_started_at, settings);

  const players = useAppStore((s) => s.players);
  const getTeam = useAppStore((s) => s.getTeam);

  const currentMinute =
    phase && phase.label !== "HT" && phase.label !== "FT" ? phase.minute : undefined;

  const getPlayerName = (playerId: number) => {
    const p = players.find((pl) => pl.id === playerId);
    return p?.name || "Unknown";
  };

  const events = match.events || [];

  const handleFinish = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setFinishing(true);
    const home = match.homeScore ?? 0;
    const away = match.awayScore ?? 0;
    try {
      const res = await fetch(`/api/fixtures/${match.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeScore: home, awayScore: away, status: "completed" }),
      });
      if (res.ok) {
        useAppStore.getState().updateMatch(match.id, "status", "completed");
        useAppStore.getState().recalculateRatings();
        onFinished();
      }
    } catch {
      // persist silently
    } finally {
      setFinishing(false);
      setConfirming(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-surface-2 border-b border-line">
        <div className="flex items-center gap-2">
          <LiveClock match={match} settings={settings} />
          <span className="text-xs text-muted">Round {match.round}</span>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddEvent(true)}
            className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
          >
            <Plus size={12} />
            Add Event
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-3 justify-end min-w-0">
            <span className="font-semibold text-base truncate text-right">
              {homeTeam?.name || "Unknown"}
            </span>
            {homeTeam?.logo_url ? (
              <Image
                src={homeTeam.logo_url}
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-muted shrink-0">
                {homeTeam?.name?.[0] || "?"}
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums">
              {match.homeScore ?? 0} - {match.awayScore ?? 0}
            </div>
            <div className="text-[11px] uppercase tracking-widest text-muted">
              {phase?.label === "HT" ? "Half-time" : phase?.label === "FT" ? "Full Time" : "Live"}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-start min-w-0">
            {awayTeam?.logo_url ? (
              <Image
                src={awayTeam.logo_url}
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-muted shrink-0">
                {awayTeam?.name?.[0] || "?"}
              </div>
            )}
            <span className="font-semibold text-base truncate">{awayTeam?.name || "Unknown"}</span>
          </div>
        </div>

        {events.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line space-y-1.5">
            {events.map((event, i) => {
              const player = players.find((p) => p.id === event.playerId);
              const team = player ? getTeam(player.teamId) : undefined;
              const color = EVENT_COLOR[event.type] || "bg-muted/20 text-muted";
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-9 shrink-0 text-[11px] text-muted tabular-nums text-right">
                    {event.minute ? `${event.minute}'` : "—"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}
                  >
                    <span className="font-semibold">{EVENT_ABBR[event.type] || event.type}</span>
                  </span>
                  <span className="truncate">
                    {getPlayerName(event.playerId)}
                    {team ? <span className="text-muted text-xs ml-1.5">{team.name}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="px-5 py-3 border-t border-line bg-surface-2/40 flex justify-end">
          {confirming ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={finishing}
                className="btn-ghost text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                onClick={handleFinish}
                disabled={finishing}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <CheckCircle size={14} />
                {finishing ? "Saving..." : "Confirm Finished"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleFinish}
              className="btn-ghost text-xs text-danger flex items-center gap-1.5"
            >
              <Flag size={14} />
              Mark as Finished
            </button>
          )}
        </div>
      )}

      {showAddEvent && (
        <AddEventModal
          match={match}
          homeTeamName={homeTeam?.name || "Home"}
          awayTeamName={awayTeam?.name || "Away"}
          initialMinute={currentMinute}
          onClose={() => setShowAddEvent(false)}
        />
      )}
    </div>
  );
}
