"use client";

import { useAppStore } from "@/lib/store";
import { matchMeta, titleCase } from "@/lib/utils/helpers";
import { Calendar } from "lucide-react";

export function UpcomingMatches() {
  const fixtures = useAppStore((s) => s.fixtures);
  const getTeam = useAppStore((s) => s.getTeam);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const managedId = useAppStore((s) => s.getManagedTeamId)();

  const hasTeam = isTeamAccount() && managedId != null;

  const nextRound = fixtures.find((r) =>
    r.matches.some((m) => m.status !== "completed" && (!hasTeam || m.homeId === managedId || m.awayId === managedId))
  );

  if (!fixtures.length) {
    return (
      <div className="card p-6 text-center">
        <Calendar
          size={32}
          className="mx-auto text-muted/30 mb-3"
        />
        <p className="text-sm text-muted">
          Generate fixtures to see upcoming matches.
        </p>
      </div>
    );
  }

  if (!hasTeam && isTeamAccount()) {
    return null;
  }

  if (!nextRound) {
    return (
      <div className="card p-6 text-center">
        <TrophyIcon />
        <p className="text-sm text-muted">
          All fixtures are completed.
        </p>
      </div>
    );
  }

  const upcoming = nextRound.matches.filter(
    (m) => m.status !== "completed" && (!hasTeam || m.homeId === managedId || m.awayId === managedId)
  );

  if (!upcoming.length) {
    return null;
  }

  return (
    <div className="card">
      <div className="px-5 py-3 border-b border-line">
        <h3 className="text-sm font-semibold">
          Upcoming &mdash; Round {nextRound.round}
        </h3>
      </div>
      <div className="p-3 space-y-2">
        {upcoming.map((match) => {
          const home = getTeam(match.homeId);
          const away = getTeam(match.awayId);
          const statusStyles =
            match.status === "live"
              ? "bg-danger/20 text-danger"
              : match.status === "in-progress"
              ? "bg-accent/20 text-accent"
              : "bg-muted/20 text-muted";

          return (
            <div
              key={match.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-line"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">
                  <span>{home?.name || "Unknown"}</span>
                  <span className="text-muted mx-1.5">vs</span>
                  <span>{away?.name || "Unknown"}</span>
                </div>
                <p className="text-xs text-muted truncate mt-0.5">
                  {matchMeta(match)}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${statusStyles}`}
              >
                {titleCase(match.status)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg
      className="mx-auto text-muted/30 mb-3"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C6 4 6 6 6 9" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C18 4 18 6 18 9" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
