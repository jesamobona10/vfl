"use client";

import type { Player } from "@/lib/types";
import { posLabel } from "@/lib/utils/helpers";
import { Crown, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { RatingExplanation } from "./rating-explanation";

interface PlayerRowProps {
  player: Player;
  teamName: string;
  teamLogo?: string | null;
  onEdit?: (player: Player) => void;
  onDelete?: (id: number) => void;
  onAnonymize?: (player: Player) => void;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function PlayerRow({
  player,
  teamName,
  teamLogo,
  onEdit,
  onDelete,
  onAnonymize,
}: PlayerRowProps) {
  const pos = player.position;

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:-translate-y-[1px] hover:border-brand/30 hover:shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-white">
          {initials(player.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-text">{player.name}</p>
            {player.captain && <Crown size={12} className="shrink-0 text-gold" />}
            {player.anonymized_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                <ShieldAlert size={10} />
                Anonymized
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>#{player.number || "—"}</span>
            <span className="hidden sm:inline">•</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{posLabel(pos)}</span>
            <span className="hidden md:inline-flex items-center gap-1.5">
              <span>•</span>
              {teamLogo ? (
                <img src={teamLogo} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <span className="h-4 w-4 rounded-full bg-surface-2" />
              )}
              <span className="truncate">{teamName}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs sm:flex sm:items-center sm:gap-4">
        <div className="rounded-lg bg-surface-2/60 px-2 py-1.5 sm:bg-transparent sm:p-0">
          <p className="font-semibold tabular-nums text-text">{player.goals}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">G</p>
        </div>
        <div className="rounded-lg bg-surface-2/60 px-2 py-1.5 sm:bg-transparent sm:p-0">
          <p className="font-semibold tabular-nums text-text">{player.assists}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">A</p>
        </div>
        <div className="rounded-lg bg-surface-2/60 px-2 py-1.5 sm:bg-transparent sm:p-0">
          <p className="font-semibold tabular-nums text-text">{player.yellowCards}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">YC</p>
        </div>
        <div className="rounded-lg bg-surface-2/60 px-2 py-1.5 sm:bg-transparent sm:p-0">
          <p className="font-semibold tabular-nums text-text">{player.redCards}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">RC</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold tabular-nums text-brand">
            {player.rating.toFixed(1)}
          </span>
          <RatingExplanation position={pos} />
        </div>
        {(onEdit || onDelete || onAnonymize) && !player.anonymized_at && (
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            {onEdit && (
              <button
                onClick={() => onEdit(player)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
                aria-label="Edit player"
              >
                <Pencil size={14} />
              </button>
            )}
            {onAnonymize && (
              <button
                onClick={() => onAnonymize(player)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-warn/10 hover:text-warn"
                aria-label="Anonymize player"
              >
                <ShieldAlert size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(player.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                aria-label="Delete player"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
