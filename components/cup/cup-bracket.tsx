"use client";

import type { CupMatch } from "@/lib/types";
import { CupMatchCard } from "./cup-match-card";
import { Trophy, ChevronRight } from "lucide-react";

interface CupBracketProps {
  matches: CupMatch[];
  getTeamName: (id: number) => string;
  getTeamLogo?: (id: number) => string | undefined;
  onScoreClick: (match: CupMatch) => void;
  champion: number | null;
}

const roundConfig = [
  { key: "quarter" as const, label: "Quarter-Finals" },
  { key: "semi" as const, label: "Semi-Finals" },
  { key: "final" as const, label: "Final" },
];

export function CupBracket({
  matches,
  getTeamName,
  getTeamLogo,
  onScoreClick,
  champion,
}: CupBracketProps) {
  const bracketMatches = matches.filter((m) => m.round !== "playoff");
  if (!bracketMatches.length) return null;

  const getNextMatchIndex = (
    round: "quarter" | "semi",
    matchIndex: number
  ): number => {
    if (round === "quarter") return Math.floor(matchIndex / 2);
    if (round === "semi") return 0;
    return 0;
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Cup Bracket
        </h3>
        {champion != null && (
          <span className="flex items-center gap-1.5 text-sm font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">
            <Trophy size={14} />
            {getTeamName(champion)} Champions
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {roundConfig.map((round, ri) => {
          const columnMatches = bracketMatches.filter(
            (m) => m.round === round.key
          );

          const isFinal = round.key === "final";

          return (
            <div key={round.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {round.label}
                </span>
                {ri < roundConfig.length - 1 && (
                  <ChevronRight
                    size={14}
                    className="text-muted/30 hidden md:block"
                  />
                )}
              </div>

              <div className="space-y-3">
                {columnMatches.map((m) => {
                  const isPlayable =
                    m.homeId != null && m.awayId != null;

                  return (
                    <div
                      key={m.id}
                      className={
                        isFinal ? "md:mt-6" : ""
                      }
                    >
                      <CupMatchCard
                        match={m}
                        getTeamName={getTeamName}
                        getTeamLogo={getTeamLogo}
                        onScoreClick={onScoreClick}
                        isNext={isPlayable && !isFinal}
                      />
                    </div>
                  );
                })}
              </div>

              {isFinal && champion != null && (
                <div className="mt-4 pt-3 border-t border-line text-center">
                  <Trophy size={24} className="mx-auto text-accent mb-1" />
                  <p className="text-xs font-bold text-text">
                    {getTeamName(champion)}
                  </p>
                  <p className="text-[10px] text-muted">Champion</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
