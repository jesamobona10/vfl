"use client";

import type { PlayerPosition, TeamOfRoundSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROWS: Array<{ slot: PlayerPosition; label: string }> = [
  { slot: "ATT", label: "Attack" },
  { slot: "MID", label: "Midfield" },
  { slot: "DEF", label: "Defence" },
  { slot: "GK", label: "Goalkeeper" },
];

const SLOT_LABELS: Record<PlayerPosition, string[]> = {
  GK: ["GK"],
  DEF: ["LB", "LCB", "RCB", "RB"],
  MID: ["LCM", "CM", "RCM"],
  ATT: ["LW", "ST", "RW"],
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function PlayerTile({ entry, label }: { entry: TeamOfRoundSlot; label: string }) {
  const { player, outOfPosition } = entry;

  return (
    <div className="rounded-xl border border-line bg-surface/95 p-2 text-center shadow-sm">
      <div className="relative mx-auto mb-1 h-9 w-9">
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt=""
            width={36}
            height={36}
            loading="lazy"
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700"
          >
            {initials(player.name)}
          </div>
        )}
        <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-600 px-1 text-[9px] font-bold leading-4 text-white">
          {player.impact.toFixed(1)}
        </span>
      </div>
      <p className="truncate text-[11px] font-semibold text-text" title={player.name}>
        {player.name}
      </p>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-muted">
        {player.teamLogo && (
          <img
            src={player.teamLogo}
            alt=""
            width={12}
            height={12}
            loading="lazy"
            className="h-3 w-3 shrink-0 rounded-sm object-cover"
          />
        )}
        <span className="truncate">{player.teamName}</span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-1">
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-2">
          {label}
        </span>
        {outOfPosition && (
          <span
            className="rounded-full bg-warn-tint px-1 py-0.5 text-[9px] font-semibold uppercase text-warn"
            title={`Naturally a ${player.position}`}
          >
            OOP
          </span>
        )}
      </div>
    </div>
  );
}

/** Pitch-style 4-3-3 used by the Team of the Round screen. */
export function RoundPitch({ team }: { team: TeamOfRoundSlot[] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-brand-50/50 to-surface-2/40 p-3 sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-1/2 border-t border-brand-600/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-600/10"
      />
      <div className="relative space-y-4">
        {ROWS.map((row) => {
          const entries = team.filter((entry) => entry.slot === row.slot);
          if (!entries.length) return null;
          const labels = SLOT_LABELS[row.slot];
          return (
            <div key={row.slot} className="space-y-1.5">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                {row.label}
              </p>
              <div
                className={cn(
                  "mx-auto grid gap-2 sm:gap-3",
                  row.slot === "DEF"
                    ? "grid-cols-2 sm:grid-cols-4"
                    : row.slot === "GK"
                      ? "max-w-[7rem] grid-cols-1"
                      : "grid-cols-2 sm:grid-cols-3"
                )}
              >
                {entries.map((entry, index) => (
                  <PlayerTile
                    key={`${entry.slot}-${entry.player.playerId}`}
                    entry={entry}
                    label={labels[index] ?? row.slot}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
