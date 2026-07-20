"use client";

import type { Player } from "@/lib/types";
import { posLabel } from "@/lib/utils/helpers";
import { X, Trophy, Swords, Shield, Star, Goal, Users, ChevronRight } from "lucide-react";

interface PlayerProfileProps {
  player: Player;
  teamName: string;
  onClose: () => void;
}

function stat(label: string, value: string | number, icon?: React.ReactNode) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2/50">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-muted">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export function PlayerProfile({ player, teamName, onClose }: PlayerProfileProps) {
  const pos = player.position;
  const isGK = pos === "GK";
  const initials = player.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-icon z-10"
        >
          <X size={18} />
        </button>

        <div className="bg-gradient-to-b from-brand/10 to-transparent p-6 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center text-xl font-bold text-brand shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{player.name}</h2>
              <p className="text-sm text-muted">
                #{player.number} &middot; {posLabel(pos)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Users size={12} />
                  {teamName}
                </div>
                <span className="text-muted/40">|</span>
                <div className="flex items-center gap-1 text-xs">
                  <Star size={12} className="text-amber-400" />
                  <span className="font-semibold">{player.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stat("Goals", player.goals, <Goal size={14} className="text-brand" />)}
            {stat("Assists", player.assists, <ChevronRight size={14} className="text-accent" />)}
            {stat("Yellow Cards", player.yellowCards, <div className="w-3 h-4 rounded bg-yellow-400" />)}
            {stat("Red Cards", player.redCards, <div className="w-3 h-4 rounded bg-red-500" />)}
            {stat("Tackles", player.tackles, <Swords size={14} className="text-muted" />)}
            {stat("Rating", player.rating.toFixed(1), <Star size={14} className="text-amber-400" />)}
          </div>

          {isGK && (
            <>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider pt-2">
                Goalkeeper Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stat("Saves", player.saves, <Shield size={14} className="text-brand" />)}
                {stat("Clean Sheets", player.cleanSheets, <Trophy size={14} className="text-green-400" />)}
                {stat("Goals Conceded", player.goalsConceded, <Goal size={14} className="text-danger" />)}
                {stat("Penalty Saves", player.penaltySaves, <Shield size={14} className="text-accent" />)}
                {stat("Bonus (5+ SV)", player.bonus5Saves, <Star size={14} className="text-amber-400" />)}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 pt-2 text-xs text-muted border-t border-line">
            <span>Player ID: {player.id}</span>
            {player.captain && (
              <>
                <span className="text-muted/40">|</span>
                <span className="text-amber-400 font-medium">Captain</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
