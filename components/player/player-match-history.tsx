"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";

interface Match {
  id: number;
  round: number;
  homeId: number;
  awayId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  date: string;
  time: string;
  venue: string;
  events: { playerId: number; type: string; minute?: number }[];
}

interface PlayerMatchHistoryProps {
  teamFixtures: Match[];
  playerId: number;
  playerName: string;
  teamName: string;
  teamId: number;
  matchRatings: Record<string, number>;
}

export function PlayerMatchHistory({
  teamFixtures,
  playerId,
  teamName,
  teamId,
  matchRatings,
}: PlayerMatchHistoryProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const completed = teamFixtures
    .filter((m) => m.status === "completed")
    .sort((a, b) => b.round - a.round);

  const toggle = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  if (completed.length === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        <Calendar size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No completed matches yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
        Match History ({completed.length})
      </h3>
      {completed.map((m) => {
        const isHome = m.homeId === teamId;
        const opponent = isHome ? "Away Team" : "Home Team";
        const score = `${m.homeScore ?? "?"}-${m.awayScore ?? "?"}`;
        const won = isHome
          ? (m.homeScore ?? 0) > (m.awayScore ?? 0)
          : (m.awayScore ?? 0) > (m.homeScore ?? 0);
        const rating = matchRatings[m.id] ?? null;
        const hasEvents = m.events.some((e) => e.playerId === playerId);
        const isOpen = expanded.has(m.id);

        return (
          <div key={m.id} className="card overflow-hidden">
            <button
              onClick={() => toggle(m.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50 transition-colors"
            >
              {isOpen ? <ChevronDown size={14} className="shrink-0 text-muted" /> : <ChevronRight size={14} className="shrink-0 text-muted" />}
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted">Round {m.round}</span>
                <p className="text-sm font-medium truncate">
                  {isHome ? teamName : opponent} {score} {isHome ? opponent : teamName}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rating != null && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    rating >= 7 ? "bg-brand/10 text-brand" : rating >= 5 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
                  }`}>
                    {rating.toFixed(1)}
                  </span>
                )}
                {hasEvents && <span className="text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded">Events</span>}
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  won ? "bg-brand/10 text-brand" : "bg-danger/10 text-danger"
                }`}>
                  {won ? "W" : "L"}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-line px-4 py-3 space-y-2">
                <div className="text-xs text-muted flex flex-wrap gap-3">
                  <span>{m.date}{m.time ? ` ${m.time}` : ""}</span>
                  {m.venue && <span>{m.venue}</span>}
                </div>
                {hasEvents && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted">Your Events</p>
                    {m.events
                      .filter((e) => e.playerId === playerId)
                      .map((e, i) => (
                        <span key={i} className="inline-block text-xs bg-surface-2 px-2 py-0.5 rounded mr-1">
                          {e.type}{e.minute ? ` ${e.minute}'` : ""}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
