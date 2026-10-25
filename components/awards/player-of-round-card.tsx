"use client";

import type { PlayerOfRoundAward } from "@/lib/types";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Highlight card for the round's best player. */
export function PlayerOfRoundCard({ award }: { award: PlayerOfRoundAward }) {
  const { player, criteria } = award;

  const stats = [
    { label: "Goals", value: player.goals },
    { label: "Assists", value: player.assists },
    player.position === "GK"
      ? { label: "Saves", value: player.saves }
      : { label: "Tackles", value: player.tackles },
    player.position === "GK" || player.position === "DEF"
      ? { label: "Clean sheets", value: player.cleanSheets }
      : { label: "Interceptions", value: player.interceptions },
    { label: "Apps", value: player.appearances },
  ];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="relative h-16 w-16 shrink-0 self-start sm:self-auto">
          {player.photoUrl ? (
            <img
              src={player.photoUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-xl font-bold text-brand-700"
            >
              {initials(player.name)}
            </div>
          )}
          <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-gold text-white shadow-sm">
            <Trophy size={14} aria-hidden="true" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-700">
            Player of the Round
          </p>
          <h2 className="truncate text-xl font-bold text-text">{player.name}</h2>
          <p className="text-sm text-muted">
            {player.teamName} · {player.position}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {criteria.map((criterion) => (
              <span
                key={criterion}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
              >
                {criterion}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-6 sm:flex-col sm:items-end sm:gap-1">
          <div className="text-left sm:text-right">
            <p className="text-2xl font-bold tabular-nums text-text">{player.impact.toFixed(1)}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Impact</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-5">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              "bg-surface px-3 py-2.5 text-center",
              index === stats.length - 1 && "col-span-2 sm:col-span-1"
            )}
          >
            <p className="text-base font-semibold tabular-nums text-text">{stat.value}</p>
            <p className="text-[11px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
