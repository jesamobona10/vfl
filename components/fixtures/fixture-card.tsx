"use client";

import { Suspense, lazy, useState } from "react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { matchStatusVariant, statusLabel } from "@/lib/status";
import { MatchReportModal } from "./match-report-modal";
import { LiveBadgeWithLink } from "@/components/live/live-badge";
import { useToast } from "@/components/ui/toast";
import { removeMatchEvent } from "@/lib/match-events";
import { Sparkles, Radio } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

/** Grace window before a removed match event is actually deleted on the server. */
const UNDO_WINDOW_MS = 5000;

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
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : undefined;

  const invalidateSeasonQueries = () => {
    if (match.season_id) {
      queryClient.invalidateQueries({ queryKey: ["season-standings", match.season_id] });
      queryClient.invalidateQueries({ queryKey: ["season-statistics", match.season_id] });
    }
  };

  const events = match.events || [];
  const hasScore = match.homeScore != null || match.awayScore != null;
  const scoreDisplay =
    match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} - ${match.awayScore}`
      : hasScore
        ? `${match.homeScore ?? "?"} - ${match.awayScore ?? "?"}`
        : null;

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setShowFlyer(true);
    }
  };

  const handleRemoveEvent = (index: number) => {
    const removed = removeMatchEvent({
      match,
      index,
      onSettled: invalidateSeasonQueries,
    });
    if (!removed) return;

    // The server delete is deferred: the event hides immediately, the DELETE
    // only fires after the grace window unless the user taps Undo.
    const timer = setTimeout(removed.persistDelete, UNDO_WINDOW_MS);

    toast.info("Event removed", {
      action: {
        label: "Undo",
        onAction: () => {
          clearTimeout(timer);
          removed.undo();
        },
      },
      durationMs: UNDO_WINDOW_MS,
    });
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
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
      >
        <span className="font-semibold">{EVENT_ABBR[event.type] || event.type}</span>
        {getPlayerName(event.playerId)}
        {editable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveEvent(events.indexOf(event));
            }}
            aria-label={`Remove ${event.type} event for ${getPlayerName(event.playerId)}`}
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
        onKeyDown={handleCardKeyDown}
        tabIndex={0}
        aria-label={`${homeTeam?.name || "Unknown"} vs ${awayTeam?.name || "Unknown"} — ${label}, open match card`}
        className={`card-hover flex flex-col gap-3 px-4 py-4 rounded-xl border cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 ${
          editable
            ? "border-line bg-surface hover:bg-surface-2/30"
            : "border-line bg-surface"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{label}</span>
            {match.status === "live" || match.status === "in-progress" ? (
              <LiveBadgeWithLink match={match} />
            ) : (
              <Badge variant={matchStatusVariant(match.status)}>
                {statusLabel(match.status)}
              </Badge>
            )}
          </div>
          {editable && (
            <span className="text-xs text-muted/40 group-hover:text-muted/60 transition-colors">
              +
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 justify-end min-w-0">
            <span className="font-semibold text-sm sm:text-base truncate text-right">
              {homeTeam?.name || "Unknown"}
            </span>
            {homeTeam?.logo_url ? (
              <Image
                src={homeTeam.logo_url}
                alt=""
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-muted shrink-0">
                {homeTeam?.name?.[0] || "?"}
              </div>
            )}
          </div>

          {scoreDisplay ? (
            <span className="text-lg font-bold tabular-nums">{scoreDisplay}</span>
          ) : (
            <span className="text-xs text-muted uppercase tracking-[0.15em] font-semibold">vs</span>
          )}

          <div className="flex items-center gap-2 sm:gap-3 justify-start min-w-0">
            {awayTeam?.logo_url ? (
              <Image
                src={awayTeam.logo_url}
                alt=""
                width={40}
                height={40}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-muted shrink-0">
                {awayTeam?.name?.[0] || "?"}
              </div>
            )}
            <span className="font-semibold text-sm sm:text-base truncate">{awayTeam?.name || "Unknown"}</span>
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
          <div className="flex gap-2 pt-2 border-t border-line" onClick={(e) => e.stopPropagation()}>
            <Link
              href={slug ? `/org/${slug}/match/${match.id}` : "#"}
              className="btn btn-ghost btn-sm flex-1 justify-center gap-1.5 text-brand border border-brand/25 hover:bg-brand/5"
            >
              <Radio size={13} /> Match mode
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReport(true)}
              className="flex-1 gap-1.5 text-brand border border-brand/25 hover:bg-brand/5"
            >
              <Sparkles size={13} /> AI Report
            </Button>
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
