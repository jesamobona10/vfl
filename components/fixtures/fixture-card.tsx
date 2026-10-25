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
import { Sparkles, Radio, Trash2, Images, Users, Activity } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { MatchMediaManager } from "./match-media-manager";
import { FixtureLineupsModal } from "./fixture-lineups";
import { useCan } from "@/lib/hooks/use-can";
import { MATCH_EVENT_CATEGORIES, matchEventCategory, matchEventCategoryColor } from "@/lib/match-event-categories";
import { Modal } from "@/components/ui/modal";

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
  const [showMedia, setShowMedia] = useState(false);
  const [showLineups, setShowLineups] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const players = useAppStore((s) => s.players);
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : undefined;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { allowed: canManageMatch } = useCan("match.edit");

  const invalidateSeasonQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["fixtures"] });
    void queryClient.invalidateQueries({ queryKey: ["org-season-fixtures"] });
    void queryClient.invalidateQueries({ queryKey: ["players"] });
    void queryClient.invalidateQueries({ queryKey: ["org-season-players"] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
    void queryClient.invalidateQueries({ queryKey: ["org-season-teams"] });
    void queryClient.invalidateQueries({ queryKey: ["season-standings"] });
    void queryClient.invalidateQueries({ queryKey: ["season-statistics"] });
  };

  const getPlayerName = (playerId: number | null) => {
    if (playerId == null) return "Player unavailable";
    const p = players.find((pl) => Number(pl.id) === Number(playerId));
    return p?.name || "Unknown";
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
    const timer = setTimeout(() => {
      void removed.persistDelete().then((persisted) => {
        if (!persisted) {
          removed.undo();
          toast.error("The event could not be removed from the server. It has been restored; please try again.");
          invalidateSeasonQueries();
        }
      });
    }, UNDO_WINDOW_MS);

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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    if (
      !(await confirm({
        title: "Delete fixture",
        description: `${homeTeam?.name || "Home"} vs ${awayTeam?.name || "Away"} will be deleted. This cannot be undone.`,
      }))
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/fixtures/${match.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete fixture.");
        setDeleting(false);
        return;
      }
      toast.success("Fixture deleted.");
      if (slug) router.refresh();
      else window.location.reload();
    } catch {
      toast.error("Failed to delete fixture.");
      setDeleting(false);
    }
  };

  const renderEventBadge = (event: (typeof events)[0], i: number) => {
    const color = EVENT_COLOR[event.type] || "bg-muted/20 text-muted";
    return (
      <span
        key={i}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
      >
        <span className="font-semibold">{EVENT_ABBR[event.type] || event.type}</span>
        {event.playerId == null && event.type === "goal" ? "Scorer to be assigned" : event.playerName || getPlayerName(event.playerId)}
        {event.playerId == null && event.teamId != null && (
          <span className="opacity-75">· {event.teamId === match.homeId ? homeTeam?.name : awayTeam?.name}</span>
        )}
        {editable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveEvent(i);
            }}
            aria-label={`Remove ${event.type} event for ${event.playerId == null ? "unattributed player" : event.playerName || getPlayerName(event.playerId)}`}
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
      {confirmDialog}
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
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete fixture"
              className="p-1 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
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
          <div className="border-t border-line pt-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowEvents(true)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2/50">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold"><Activity size={15} className="shrink-0 text-brand" /> Match events</span>
              <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums">{events.length}</span>
            </button>
            <div className="flex flex-wrap gap-1.5 px-2 pb-1">
              {MATCH_EVENT_CATEGORIES.map((category) => {
                const count = events.filter((event) => matchEventCategory(event.type) === category).length;
                return count > 0 ? <span key={category} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${matchEventCategoryColor(category)}`}>{category} · {count}</span> : null;
              })}
            </div>
          </div>
        )}

        {(editable || canManageMatch) && (
          <div className="flex gap-2 pt-2 border-t border-line" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowLineups(true)}
              className="flex-1 gap-1.5 text-brand border border-brand/25 hover:bg-brand/5"
            >
              <Users size={13} /> Lineups
            </Button>
            {editable && <>
            <Link
              href={slug ? `/org/${slug}/match/${match.id}` : "#"}
              className="btn btn-ghost btn-sm flex-1 justify-center gap-1.5 text-brand border border-brand/25 hover:bg-brand/5"
            >
              <Radio size={13} /> Match mode
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMedia(true)}
              className="flex-1 gap-1.5 text-brand border border-brand/25 hover:bg-brand/5"
            >
              <Images size={13} /> Media
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReport(true)}
              className="flex-1 gap-1.5 text-brand border border-brand/25 hover:bg-brand/5"
            >
              <Sparkles size={13} /> AI Report
            </Button>
            </>}
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
      <MatchMediaManager
        matchId={match.id}
        homeTeamName={homeTeam?.name || "Home"}
        awayTeamName={awayTeam?.name || "Away"}
        open={showMedia}
        onClose={() => setShowMedia(false)}
      />
      <FixtureLineupsModal fixtureId={match.id} open={showLineups} onClose={() => setShowLineups(false)} />
      <Modal open={showEvents} onClose={() => setShowEvents(false)} title="Match events" subtitle={`${homeTeam?.name || "Home"} ${scoreDisplay || "vs"} ${awayTeam?.name || "Away"} · ${events.length} total`} className="max-w-2xl">
        <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          {MATCH_EVENT_CATEGORIES.map((category) => {
            const categorized = events.map((event, index) => ({ event, index })).filter(({ event }) => matchEventCategory(event.type) === category);
            if (!categorized.length) return null;
            return <section key={category} className="space-y-2">
              <div className="flex items-center justify-between border-b border-line pb-2"><h3 className="text-sm font-bold">{category}</h3><span className="text-xs text-muted">{categorized.length}</span></div>
              <div className="flex flex-wrap gap-1.5">{categorized.map(({ event, index }) => renderEventBadge(event, index))}</div>
            </section>;
          })}
        </div>
      </Modal>
    </>
  );
}
