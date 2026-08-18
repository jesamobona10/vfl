"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { matchMeta, titleCase } from "@/lib/utils/helpers";
import { Calendar, Clock, MapPin, ArrowUpRight } from "lucide-react";

export function UpcomingMatches() {
  const params = useParams();
  const slug = params.slug as string;
  const fixtures = useAppStore((s) => s.fixtures);
  const getTeam = useAppStore((s) => s.getTeam);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const managedId = useAppStore((s) => s.getManagedTeamId)();

  const hasTeam = isTeamAccount() && managedId != null;

  const nextRound = fixtures.find((r) =>
    r.matches.some(
      (m) =>
        m.status !== "completed" && (!hasTeam || m.homeId === managedId || m.awayId === managedId)
    )
  );

  if (!fixtures.length) {
    return (
      <div className="panel p-6 text-center">
        <Calendar size={32} className="mx-auto text-ink-3/40 mb-3" />
        <p className="text-sm text-ink-2">Generate fixtures to see upcoming matches.</p>
      </div>
    );
  }

  if (!hasTeam && isTeamAccount()) {
    return null;
  }

  if (!nextRound) {
    return (
      <div className="panel p-6 text-center">
        <p className="text-sm text-ink-2">All fixtures are completed.</p>
      </div>
    );
  }

  const upcoming = nextRound.matches.filter(
    (m) =>
      m.status !== "completed" && (!hasTeam || m.homeId === managedId || m.awayId === managedId)
  );

  if (!upcoming.length) {
    return null;
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Upcoming &mdash; Round {nextRound.round}</span>
        <Link href={`/org/${slug}/fixtures`} className="panel-link">
          View all <ArrowUpRight size={12} />
        </Link>
      </div>
      <div>
        {upcoming.map((match) => {
          const home = getTeam(match.homeId);
          const away = getTeam(match.awayId);
          const meta = matchMeta(match);
          return (
            <div key={match.id} className="fixture-row">
              <div className="min-w-0">
                <div className="fixture-teams">
                  {home?.name || "Unknown"}
                  <span className="text-ink-3 mx-1.5">vs</span>
                  {away?.name || "Unknown"}
                </div>
                <div className="fixture-meta">
                  {meta && (
                    <span>
                      <Clock size={11} />
                      {meta}
                    </span>
                  )}
                  {match.venue && (
                    <span>
                      <MapPin size={11} />
                      {match.venue}
                    </span>
                  )}
                </div>
              </div>
              {match.status === "live" ? (
                <span className="dot-live">
                  <span className="dot-live-pulse" />
                  Live
                </span>
              ) : (
                <span className="dot-scheduled">{titleCase(match.status)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
