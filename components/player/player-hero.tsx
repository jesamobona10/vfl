"use client";

import { Shield, Star } from "lucide-react";

interface PlayerHeroProps {
  player: {
    id: number;
    name: string;
    position: string;
    number: number;
    photoUrl: string | null;
    rating: number;
    captain: boolean;
  };
  team: { name: string; logo: string | null; rating: number } | null;
}

export function PlayerHero({ player, team }: PlayerHeroProps) {
  return (
    <div className="card p-6 flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0">
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.name}
            className="w-20 h-20 rounded-full object-cover border-2 border-line"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center border-2 border-line">
            <Shield size={32} className="text-muted" />
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center border-2 border-surface">
          {player.number}
        </div>
      </div>

      <div className="flex-1 text-center sm:text-left">
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <h2 className="text-xl font-bold">{player.name}</h2>
          {player.captain && (
            <span className="text-[10px] font-semibold uppercase bg-accent/10 text-accent px-2 py-0.5 rounded">
              C
            </span>
          )}
        </div>
        <p className="text-sm text-muted">
          {player.position} &middot; {team?.name || "No team"}
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-3 py-2">
          <Star size={14} className="text-accent" />
          <span className="font-semibold text-sm">{player.rating.toFixed(1)}</span>
          <span className="text-xs text-muted">rating</span>
        </div>
        {team?.logo && (
          <img src={team.logo} alt={team.name} className="w-10 h-10 rounded-full object-cover" />
        )}
      </div>
    </div>
  );
}
