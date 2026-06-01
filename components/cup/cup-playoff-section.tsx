"use client";

import type { CupMatch } from "@/lib/types";
import { CupMatchCard } from "./cup-match-card";
import { Shield } from "lucide-react";

interface CupPlayoffSectionProps {
  matches: CupMatch[];
  getTeamName: (id: number) => string;
  getTeamLogo?: (id: number) => string | undefined;
  onScoreClick: (match: CupMatch) => void;
}

export function CupPlayoffSection({
  matches,
  getTeamName,
  getTeamLogo,
  onScoreClick,
}: CupPlayoffSectionProps) {
  if (!matches.length) return null;

  const allCompleted = matches.every((m) => m.status === "completed");
  const winners = matches
    .filter((m) => m.winnerId != null)
    .map((m) => m.winnerId!);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Playoff Round
        </h3>
        {allCompleted && (
          <span className="text-xs font-medium text-brand bg-brand/10 px-2.5 py-1 rounded-full">
            Complete
          </span>
        )}
      </div>

      <div className="space-y-2">
        {matches.map((m) => (
          <CupMatchCard
            key={m.id}
            match={m}
            getTeamName={getTeamName}
            getTeamLogo={getTeamLogo}
            onScoreClick={onScoreClick}
          />
        ))}
      </div>

      {allCompleted && winners.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line">
          <p className="text-xs text-muted mb-2">Qualified for Cup:</p>
          <div className="flex flex-wrap gap-2">
            {winners.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand bg-brand/10 px-2.5 py-1 rounded-full"
              >
                <Shield size={10} />
                {getTeamName(id)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
