"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Season } from "@/lib/types";

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeasonId: string | null;
  onSeasonChange: (seasonId: string) => void;
}

export function SeasonSelector({
  seasons,
  selectedSeasonId,
  onSeasonChange,
}: SeasonSelectorProps) {
  const [open, setOpen] = useState(false);

  const selected = seasons.find((s) => s.id === selectedSeasonId);
  const activeLabel = selected?.name || seasons.find((s) => s.is_current)?.name || "Select Season";

  if (!seasons.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-line rounded-lg bg-surface hover:bg-surface-2 transition-colors"
      >
        {activeLabel}
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg py-1 z-20 min-w-[180px]">
            {seasons.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSeasonChange(s.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-2 transition-colors flex items-center justify-between ${
                  s.id === selectedSeasonId ? "font-semibold text-brand" : ""
                }`}
              >
                <span>{s.name}</span>
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                  s.status === "active"
                    ? "bg-green-500/20 text-green-400"
                    : s.status === "completed"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-gray-500/20 text-gray-300"
                }`}>
                  {s.status}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
