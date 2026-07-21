"use client";

import { useState } from "react";
import type { Player } from "@/lib/types";
import { posLabel } from "@/lib/utils/helpers";
import {
  Pencil,
  Trash2,
  Crown,
  ChevronDown,
  ChevronRight,
  Goal,
  Star,
  Shield,
  Trophy,
  Swords,
  Users,
} from "lucide-react";

interface PlayerCardProps {
  player: Player;
  teamName: string;
  onEdit?: (player: Player) => void;
  onDelete?: (id: number) => void;
}

function stat(label: string, value: string | number, icon?: React.ReactNode) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2/50">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted">{label}</span>
      </div>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function PlayerCard({
  player,
  teamName,
  onEdit,
  onDelete,
}: PlayerCardProps) {
  const [expanded, setExpanded] = useState(false);

  const pos = player.position;
  const isGK = pos === "GK";

  const initials = player.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const CompactStats = () => {
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
        <span className="text-yellow-600">Y:{player.yellowCards}</span>
        <span className="text-danger">R:{player.redCards}</span>
        <span className="font-semibold text-text">
          {player.rating.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <div className="card overflow-hidden border border-line shadow-sm transition-shadow duration-150 hover:shadow-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left focus:outline-none"
      >
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-sm font-bold text-white shrink-0">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold truncate">
                {player.name}
              </span>
              {player.captain && (
                <Crown size={12} className="text-accent shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted">
              #{player.number} &middot; {posLabel(pos)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-[11px] font-semibold">
              {player.rating.toFixed(1)}
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
              {teamName}
            </span>
          </div>

          {expanded ? (
            <ChevronDown size={16} className="text-muted shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-muted shrink-0" />
          )}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-line px-4 pb-4 space-y-3">
          <div className="pt-3">
            <CompactStats />
          </div>

          <hr className="border-line" />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stat("Goals", player.goals, <Goal size={13} className="text-brand" />)}
            {stat("Assists", player.assists, <ChevronRight size={13} className="text-accent" />)}
            {stat("Yellow Cards", player.yellowCards, <div className="w-2.5 h-3.5 rounded-sm bg-yellow-400" />)}
            {stat("Red Cards", player.redCards, <div className="w-2.5 h-3.5 rounded-sm bg-red-500" />)}
            {stat("Tackles", player.tackles, <Swords size={13} className="text-muted" />)}
            {stat("Rating", player.rating.toFixed(1), <Star size={13} className="text-amber-400" />)}
          </div>

          {isGK && (
            <>
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider pt-1">
                Goalkeeper
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stat("Saves", player.saves, <Shield size={13} className="text-brand" />)}
                {stat("Clean Sheets", player.cleanSheets, <Trophy size={13} className="text-green-500" />)}
                {stat("Goals Conceded", player.goalsConceded, <Goal size={13} className="text-danger" />)}
                {stat("Penalty Saves", player.penaltySaves, <Shield size={13} className="text-accent" />)}
                {stat("5+ Saves Bonus", player.bonus5Saves, <Star size={13} className="text-amber-400" />)}
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted">ID: {player.id}</span>
            <div className="flex items-center gap-2">
              {player.captain && (
                <span className="inline-flex items-center gap-1 text-xs text-accent font-medium">
                  <Crown size={12} /> Captain
                </span>
              )}
            </div>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex gap-2 pt-1 border-t border-line">
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(player); }}
                  className="btn-ghost text-xs py-1.5 px-3"
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(player.id); }}
                  className="btn-ghost text-xs py-1.5 px-3 text-danger"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pb-4 -mt-1">
          <CompactStats />
        </div>
      )}
    </div>
  );
}
