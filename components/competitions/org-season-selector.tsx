"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { OrganizationSeason } from "@/lib/types";

interface OrgSeasonSelectorProps {
  seasons: OrganizationSeason[];
  selectedSeasonId: string | null;
  onSeasonChange: (seasonId: string) => void;
}

export function OrgSeasonSelector({
  seasons,
  selectedSeasonId,
  onSeasonChange,
}: OrgSeasonSelectorProps) {
  const [open, setOpen] = useState(false);

  const selected = seasons.find((s) => s.id === selectedSeasonId);
  const activeLabel = selected?.name || seasons.find((s) => s.is_current)?.name || "Select Season";

  if (!seasons.length) return null;

  const badge = (s: OrganizationSeason) =>
    s.status === "active"
      ? "bg-live-tint text-live-500"
      : s.status === "completed"
        ? "bg-brand-50 text-brand-700"
        : "bg-surface-2 text-ink-3";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-line rounded-lg bg-surface hover:bg-surface-2 transition-colors max-w-full"
      >
        <span className="truncate">{activeLabel}</span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg py-1 z-20 min-w-[180px] max-w-[calc(100vw-2rem)]"
          >
            {seasons.map((s) => (
              <button
                key={s.id}
                role="menuitem"
                onClick={() => {
                  onSeasonChange(s.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-surface-2 transition-colors flex items-center justify-between ${
                  s.id === selectedSeasonId ? "font-semibold text-brand" : ""
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{s.name}</span>
                  {s.is_current && (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 shrink-0">
                      Current
                    </span>
                  )}
                </span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${badge(s)}`}>
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
