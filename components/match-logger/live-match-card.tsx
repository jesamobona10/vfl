"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LiveFixture } from "@/lib/types";
import { formatLiveClock, livePhase } from "@/lib/logic/live";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function useNowMs(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function Crest({ team }: { team: LiveFixture["homeTeam"] }) {
  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        width={44}
        height={44}
        loading="lazy"
        decoding="async"
        className="h-11 w-11 shrink-0 rounded-full object-cover bg-surface-2"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink-2"
    >
      {initials(team.name)}
    </span>
  );
}

function kickoffLabel(fixture: LiveFixture) {
  if (!fixture.kickoff) return fixture.time || "Kickoff TBD";
  return new Date(fixture.kickoff).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * One live/soon match on the Match Logger list (guide §4.2).
 *
 * The caller's own match is highlighted with a gold border + halo and the
 * "LIVE · YOUR MATCH" label; admins see neutral cards for every fixture.
 */
export function LiveMatchCard({ fixture, slug }: { fixture: LiveFixture; slug: string }) {
  const now = useNowMs(fixture.isLive);
  const loggerHref = `/org/${slug}/match-logger/${fixture.id}`;

  if (!fixture.isLive) {
    const kickoffReached = fixture.kickoff ? now >= new Date(fixture.kickoff).getTime() : false;
    return (
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">
              {fixture.homeTeam.name} <span className="text-ink-3">vs</span>{" "}
              {fixture.awayTeam.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-3">
              {fixture.competitionName ? `${fixture.competitionName} · ` : ""}
              Round {fixture.round} · {kickoffLabel(fixture)}
            </p>
          </div>
          {kickoffReached ? (
            <Link
              href={loggerHref}
              className="btn-secondary h-11 shrink-0 px-4 text-sm inline-flex items-center gap-1.5"
            >
              Start match <ArrowRight size={15} />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Available at kickoff"
              className="btn-secondary h-11 shrink-0 px-4 text-sm"
            >
              Start match
            </button>
          )}
        </div>
      </div>
    );
  }

  const phase = fixture.liveStartedAt ? livePhase(fixture.liveStartedAt, now) : null;
  const clock = phase ? formatLiveClock(phase) : "LIVE";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-panel p-4",
        fixture.isMine
          ? "border-gold-500 shadow-[0_0_0_4px_rgba(217,154,33,0.15)]"
          : "border-line"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <Badge variant="live" dot pulse>
          {fixture.isMine ? "LIVE · YOUR MATCH" : "LIVE"}
        </Badge>
        <span className="font-bold tabular-nums text-text">{clock}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Crest team={fixture.homeTeam} />
          <span className="line-clamp-2 text-[13px] font-semibold text-text">
            {fixture.homeTeam.name}
          </span>
        </div>
        <div className="flex items-center gap-2 px-1 font-extrabold tabular-nums text-text">
          <span className="text-3xl">{fixture.homeScore ?? 0}</span>
          <span className="text-xl text-ink-3">–</span>
          <span className="text-3xl">{fixture.awayScore ?? 0}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <Crest team={fixture.awayTeam} />
          <span className="line-clamp-2 text-[13px] font-semibold text-text">
            {fixture.awayTeam.name}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-ink-3">
          {fixture.competitionName ? `${fixture.competitionName} · ` : ""}
          Round {fixture.round}
          {fixture.venue ? ` · ${fixture.venue}` : ""}
        </p>
        <Link
          href={loggerHref}
          className={cn(
            "h-11 shrink-0 rounded-lg px-4 text-sm font-medium inline-flex items-center gap-1.5",
            fixture.isMine ? "btn-primary" : "btn-secondary"
          )}
        >
          Open logger <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
