"use client";

import { Suspense, lazy, useState } from "react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { titleCase } from "@/lib/utils/helpers";
import { MatchReportModal } from "./match-report-modal";
import { LiveBadge } from "@/components/live/live-badge";
import { Sparkles } from "lucide-react";

/** Lazy-loaded flyer — only fetched when the user clicks the card. */
const MatchFlyer = lazy(() =>
  import("@/components/flyers/match-flyer").then((m) => ({ default: m.MatchFlyer }))
);

interface FixtureCardProps {
  match: Match;
  label: string;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  editable?: boolean;
  onDrop: (matchId: number, targetId: number) => void;
}

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

export function FixtureCard({
  match,
  label,
  homeTeam,
  awayTeam,
  editable,
  onDrop,
}: FixtureCardProps) {
  const [showFlyer, setShowFlyer] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const players = useAppStore((s) => s.players);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const queryClient = useQueryClient();

  const invalidateSeasonQueries = () => {
    if (match.season_id) {
      queryClient.invalidateQueries({ queryKey: ["season-standings", match.season_id] });
      queryClient.invalidateQueries({ queryKey: ["season-statistics", match.season_id] });
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-muted/20 text-muted",
    "in-progress": "bg-accent/20 text-accent",
    completed: "bg-brand/20 text-brand",
    live: "bg-danger/20 text-danger",
  };

  const statusColor = statusColors[match.status] || "bg-muted/20 text-muted";

  const events = match.events || [];
  const hasScore = match.homeScore != null || match.awayScore != null;
  const scoreDisplay =
    match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} - ${match.awayScore}`
      : hasScore
        ? `${match.homeScore ?? "?"} - ${match.awayScore ?? "?"}`
        : null;

  const handleRemoveEvent = (index: number) => {
    const store = useAppStore.getState();
    const event = events[index];
    if (!event) return;
    const updatedEvents = events.filter((_, i) => i !== index);
    updateMatch(match.id, "events", updatedEvents);

    const player = store.players.find((p) => p.id === event.playerId);
    if (player) {
      const STAT_FIELD: Record<string, string> = {
        goal: "goals",
        assist: "assists",
        "own-goal": "ownGoals",
        yellow: "yellowCards",
        red: "redCards",
      };
      const field = STAT_FIELD[event.type];
      if (field) {
        store.updatePlayer(event.playerId, {
          [field]: Math.max(0, ((player as any)[field] || 0) - 1),
        });
      }
    }

    if (event.type === "goal" || event.type === "own-goal") {
      const p = store.players.find((pl) => pl.id === event.playerId);
      const teamId = p?.teamId ?? match.homeId;
      const isOwnGoal = event.type === "own-goal";
      const scoringTeam = isOwnGoal
        ? teamId === match.homeId
          ? match.awayId
          : match.homeId
        : teamId;
      const currentHome = match.homeScore ?? 0;
      const currentAway = match.awayScore ?? 0;
      const newHome = scoringTeam === match.homeId ? Math.max(0, currentHome - 1) : currentHome;
      const newAway = scoringTeam === match.awayId ? Math.max(0, currentAway - 1) : currentAway;
      store.updateMatch(match.id, "homeScore", newHome);
      store.updateMatch(match.id, "awayScore", newAway);
      try {
        fetch(`/api/fixtures/${match.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeScore: newHome, awayScore: newAway }),
        });
      } catch {
        // persist silently
      }
    }

    store.recalculateRatings();

    try {
      fetch(`/api/events/0?match_id=${match.id}&player_id=${event.playerId}&type=${event.type}`, {
        method: "DELETE",
      });
      invalidateSeasonQueries();
    } catch {
      // persist silently
    }
  };

  const getPlayerName = (playerId: number) => {
    const p = players.find((pl) => pl.id === playerId);
    return p?.name || "Unknown";
  };

  const renderEventBadge = (event: (typeof events)[0], i: number) => {
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
        onClick={() => setShowFlyer(true)}
        className={`flex flex-col gap-3 px-4 py-4 rounded-3xl border transition-all cursor-pointer ${
          editable
            ? "border-line bg-surface hover:border-brand/30 hover:bg-surface-2/30 hover:shadow-sm"
            : "border-line bg-surface"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{label}</span>
            {match.status === "live" || match.status === "in-progress" ? (
              <LiveBadge match={match} />
            ) : (
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusColor}`}>
                {titleCase(match.status)}
              </span>
            )}
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
              <img
                src={homeTeam.logo_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-muted shrink-0">
                {homeTeam?.name?.[0] || "?"}
              </div>
            )}
          </div>

          {scoreDisplay ? (
            <span className="text-lg font-bold tabular-nums">{scoreDisplay}</span>
          ) : (
            <span className="text-xs text-muted uppercase tracking-[0.15em] font-semibold">vs</span>
          )}

          <div className="flex items-center gap-3 justify-start min-w-0">
            {awayTeam?.logo_url ? (
              <img
                src={awayTeam.logo_url}
                alt=""
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
          <div
            className="flex flex-wrap gap-1 pt-1 border-t border-line"
            onClick={(e) => e.stopPropagation()}
          >
            {events.map((event, i) => renderEventBadge(event, i))}
          </div>
        )}

        {editable && (
          <div className="pt-2 border-t border-line" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowReport(true)}
              className="btn-sm w-full flex items-center justify-center gap-1.5 text-brand border border-brand/25 hover:bg-brand/5"
            >
              <Sparkles size={13} /> AI Report
            </button>
          </div>
        )}
      </article>

      {showFlyer && (
        <Suspense fallback={null}>
          <MatchFlyer
            match={match}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            onClose={() => setShowFlyer(false)}
          />
        </Suspense>
      )}

      {showReport && (
        <MatchReportModal
          match={match}
          homeTeamName={homeTeam?.name || "Home"}
          awayTeamName={awayTeam?.name || "Away"}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
