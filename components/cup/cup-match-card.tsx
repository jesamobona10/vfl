"use client";

import type { CupMatch } from "@/lib/types";
import { Shield, Trophy } from "lucide-react";

interface CupMatchCardProps {
  match: CupMatch;
  getTeamName: (id: number) => string;
  getTeamLogo?: (id: number) => string | undefined;
  onScoreClick: (match: CupMatch) => void;
  isNext?: boolean;
}

export function CupMatchCard({
  match,
  getTeamName,
  getTeamLogo,
  onScoreClick,
  isNext,
}: CupMatchCardProps) {
  const isCompleted = match.status === "completed";
  const isTbd = (id: number | null) => id == null;

  const homeTeamId = match.homeId;
  const awayTeamId = match.awayId;
  const homeName = homeTeamId != null ? getTeamName(homeTeamId) : "TBD";
  const awayName = awayTeamId != null ? getTeamName(awayTeamId) : "TBD";
  const homeLogo = homeTeamId != null ? getTeamLogo?.(homeTeamId) : undefined;
  const awayLogo = awayTeamId != null ? getTeamLogo?.(awayTeamId) : undefined;

  const displayScore = isCompleted || (match.homeScore != null && match.awayScore != null);

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        isCompleted
          ? "border-brand/40 bg-brand/[0.03]"
          : isNext
          ? "border-accent/40 bg-accent/[0.03]"
          : "border-line bg-surface"
      }`}
    >
      <button
        onClick={() => onScoreClick(match)}
        className="w-full text-left"
        title={isCompleted ? "View result" : "Enter score"}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {homeLogo ? (
                <img src={homeLogo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <Shield size={16} className="text-muted shrink-0" />
              )}
              <span className={`text-sm font-medium truncate ${isTbd(homeTeamId) ? "text-muted italic" : "text-text"}`}>
                {homeName}
              </span>
            </div>
            {homeTeamId != null && match.playoffPairing && match.round === "quarter" && (
              <p className="text-[10px] text-muted/60 mt-0.5 truncate">{match.playoffPairing}</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {displayScore ? (
              <>
                <span className={`text-base font-bold tabular-nums ${isCompleted && match.winnerId === homeTeamId ? "text-brand" : "text-text"}`}>
                  {match.homeScore}
                </span>
                <span className="text-muted text-xs">-</span>
                <span className={`text-base font-bold tabular-nums ${isCompleted && match.winnerId === awayTeamId ? "text-brand" : "text-text"}`}>
                  {match.awayScore}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted">vs</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 justify-end">
              <span className={`text-sm font-medium truncate ${isTbd(awayTeamId) ? "text-muted italic" : "text-text"}`}>
                {awayName}
              </span>
              {awayLogo ? (
                <img src={awayLogo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <Shield size={16} className="text-muted shrink-0" />
              )}
            </div>
            {awayTeamId != null && match.playoffPairing && match.round === "quarter" && (
              <p className="text-[10px] text-muted/60 mt-0.5 truncate text-right">{match.playoffPairing}</p>
            )}
          </div>
        </div>

        {isCompleted && match.completedVia && (
          <div className="mt-1.5 flex items-center gap-2">
            {match.winnerId != null && (
              <span className="text-[11px] font-semibold text-brand flex items-center gap-1">
                <Trophy size={10} />
                {getTeamName(match.winnerId)} advances
              </span>
            )}
            <span className="text-[10px] text-muted">
              {match.completedVia === "regular" ? "FT" : match.completedVia === "extra_time" ? "AET" : "Pens"}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
