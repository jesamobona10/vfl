"use client";

import { X } from "lucide-react";
import type { MatchEvent, Player } from "@/lib/types";
import { eventTypeLabel } from "@/lib/logic/events";
import { feedback } from "@/lib/match-logger/haptics";
import styles from "./match-logger.module.css";

function teamAbbr(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** The running list of logged events, most recent first (guide §4.3). */
export function Timeline({
  events,
  players,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  onRemove,
  disabled,
}: {
  events: MatchEvent[];
  players: Player[];
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  onRemove: (event: MatchEvent) => void;
  disabled?: boolean;
}) {
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const ordered = [...events].reverse();

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ml-muted)]">
          Timeline
        </h2>
        <span className="text-xs text-[var(--ml-muted)]">{events.length}</span>
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-[14px] bg-[var(--ml-surface-3)] px-4 py-6 text-center text-sm text-[var(--ml-muted)]">
          No events logged yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {ordered.map((event, i) => {
            const teamName =
              event.teamId === homeTeamId
                ? homeTeamName
                : event.teamId === awayTeamId
                  ? awayTeamName
                  : "";
            const playerName = nameById.get(event.playerId) ?? "Unknown";
            return (
              <li
                key={event.id ?? `${event.playerId}-${event.type}-${i}`}
                className="flex items-center gap-3 rounded-[14px] bg-[var(--ml-surface-3)] px-3 py-[9px]"
              >
                <span
                  className={`w-9 shrink-0 text-center text-[color:var(--ml-gold)] ${styles.display}`}
                  style={{ fontSize: 20 }}
                >
                  {event.minute != null ? `${event.minute}'` : "–"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--ml-text)]">
                  {eventTypeLabel(event.type)} — {playerName}
                </span>
                {teamName && (
                  <span className="shrink-0 text-[11px] font-semibold text-[var(--ml-muted)]">
                    {teamAbbr(teamName)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    feedback("tap");
                    onRemove(event);
                  }}
                  disabled={disabled}
                  aria-label={`Remove ${eventTypeLabel(event.type)} for ${playerName}`}
                  className="shrink-0 rounded p-1 text-[var(--ml-muted)] hover:text-[var(--ml-red)] disabled:opacity-40"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
