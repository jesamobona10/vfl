"use client";

import { useState } from "react";
import { ChevronDown, Plus, Settings } from "lucide-react";
import type { Season } from "@/lib/types";
import Link from "next/link";

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeasonId: string | null;
  onSeasonChange: (seasonId: string) => void;
  competitionId?: string;
  basePath?: string;
}

const statusStyles: Record<string, string> = {
  active: "bg-live-tint text-live-500",
  completed: "bg-brand-50 text-brand-700",
  draft: "bg-surface-2 text-ink-3",
  upcoming: "bg-gold-tint text-gold-700",
  archived: "bg-muted/20 text-muted",
};

export function SeasonSelector({
  seasons,
  selectedSeasonId,
  onSeasonChange,
  competitionId,
  basePath,
}: SeasonSelectorProps) {
  const [open, setOpen] = useState(false);

  const selected = seasons.find((s) => s.id === selectedSeasonId);
  const current = seasons.find((s) => s.is_current);
  const activeLabel = selected?.name || current?.name || "Select Season";

  if (!seasons.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-line rounded-lg bg-surface hover:bg-surface-2 transition-colors max-w-full min-w-[200px]"
      >
        <span className="truncate">{activeLabel}</span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg py-1 z-20 min-w-[220px] max-w-[calc(100vw-2rem)]"
          >
            {seasons.map((s) => (
              <button
                key={s.id}
                role="menuitem"
                onClick={() => {
                  onSeasonChange(s.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors flex items-center justify-between ${
                  s.id === selectedSeasonId ? "font-semibold text-brand" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate min-w-0">{s.name}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                      statusStyles[s.status] || "bg-surface-2 text-ink-3"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                {s.is_current && (
                  <span className="flex items-center gap-1 text-xs font-medium text-brand shrink-0 ml-2">
                    <span className="relative top-[1px]">★</span>
                    Current
                  </span>
                )}
              </button>
            ))}
            <hr className="my-1 border-line" />
            {competitionId && basePath && (
              <Link
                href={`${basePath}/settings`}
                role="menuitem"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors flex items-center gap-2 text-brand font-medium"
              >
                <Settings size={14} />
                <span>Manage Seasons</span>
              </Link>
            )}
            {competitionId && (
              <Link
                href={`${basePath}/settings/new`}
                role="menuitem"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors flex items-center gap-2 text-brand font-medium"
              >
                <Plus size={14} />
                <span>Create New Season</span>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}