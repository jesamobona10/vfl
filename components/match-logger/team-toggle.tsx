"use client";

import { cn } from "@/lib/utils";
import { feedback } from "@/lib/match-logger/haptics";

/** Which team the next logged event belongs to (guide §4.3). */
export function TeamToggle({
  homeTeamName,
  awayTeamName,
  selectedTeamId,
  homeTeamId,
  awayTeamId,
  onSelect,
}: {
  homeTeamName: string;
  awayTeamName: string;
  selectedTeamId: number;
  homeTeamId: number;
  awayTeamId: number;
  onSelect: (teamId: number) => void;
}) {
  const button = (teamId: number, name: string) => {
    const active = teamId === selectedTeamId;
    return (
      <button
        type="button"
        key={teamId}
        aria-pressed={active}
        onClick={() => {
          feedback("select");
          onSelect(teamId);
        }}
        className={cn(
          "h-11 flex-1 truncate rounded-[12px] px-3 text-sm font-semibold transition-colors",
          active
            ? "bg-[var(--ml-gold)] text-[#1A1405]"
            : "text-[var(--ml-muted)] hover:text-[var(--ml-text)]"
        )}
      >
        {name}
      </button>
    );
  };

  return (
    <div
      className="flex items-center gap-1 rounded-[14px] bg-[var(--ml-surface-2)] p-1"
      role="group"
      aria-label="Select the team for the next event"
    >
      {button(homeTeamId, homeTeamName)}
      {button(awayTeamId, awayTeamName)}
    </div>
  );
}
