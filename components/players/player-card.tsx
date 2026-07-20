"use client";

import type { Player, Team } from "@/lib/types";
import { posLabel } from "@/lib/utils/helpers";
import { Pencil, Trash2, Crown } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  teamName: string;
  onEdit?: (player: Player) => void;
  onDelete?: (id: number) => void;
}

export function PlayerCard({
  player,
  teamName,
  onEdit,
  onDelete,
}: PlayerCardProps) {
  const StatRow = () => {
    const pos = player.position;
    const items: { label: string; value: number }[] = [];

    if (pos === "GK") {
      items.push(
        { label: "SV", value: player.saves },
        { label: "PS", value: player.penaltySaves },
        { label: "CS", value: player.cleanSheets },
        { label: "GC", value: player.goalsConceded }
      );
    } else if (pos === "DEF") {
      items.push(
        { label: "T", value: player.tackles },
        { label: "INT", value: player.interceptions },
        { label: "BLK", value: player.blocks },
        { label: "AD", value: player.aerialDuelsWon },
        { label: "G", value: player.goals },
        { label: "A", value: player.assists }
      );
    } else if (pos === "MID") {
      items.push(
        { label: "G", value: player.goals },
        { label: "A", value: player.assists },
        { label: "T", value: player.tackles },
        { label: "INT", value: player.interceptions }
      );
    } else {
      items.push(
        { label: "G", value: player.goals },
        { label: "A", value: player.assists }
      );
    }

    return (
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        {items.map((i) => (
          <span key={i.label}>
            {i.label}:{i.value}
          </span>
        ))}
        <span className="text-yellow-600">
          Y:{player.yellowCards}
        </span>
        <span className="text-danger">R:{player.redCards}</span>
        <span className="font-semibold text-text">
          {player.rating.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <div className="card p-4 shadow-sm border border-line hover:shadow-md transition-shadow duration-150">
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <strong className="text-sm font-semibold truncate">
                {player.name}
              </strong>
              {player.captain && (
                <Crown
                  size={14}
                  className="text-accent shrink-0"
                />
              )}
            </div>
            <p className="text-xs text-muted">
              #{player.number} · {posLabel(player.position)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted">
              {teamName}
            </span>
            <span className="rounded-full bg-brand/10 text-brand px-2 py-1 text-[11px] font-semibold">
              {player.rating.toFixed(1)}
            </span>
          </div>
        </div>

        <StatRow />
      </div>

      <div className="flex gap-1 shrink-0">
        {onEdit && (
          <button
            onClick={() => onEdit(player)}
            className="btn-icon"
            title="Edit player"
          >
            <Pencil size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(player.id)}
            className="btn-icon text-danger"
            title="Delete player"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
