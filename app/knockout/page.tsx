"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { CupBracket } from "@/components/cup/cup-bracket";
import { CupPlayoffSection } from "@/components/cup/cup-playoff-section";
import { CupMatchModal } from "@/components/cup/cup-match-modal";
import type { CupMatch } from "@/lib/types";
import { Trophy, Loader2, AlertCircle } from "lucide-react";

export default function KnockoutPage() {
  const cup = useAppStore((s) => s.cup);
  const teams = useAppStore((s) => s.teams);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const generatePlayoffMatches = useAppStore((s) => s.generatePlayoffMatches);
  const generateCupBracketMatches = useAppStore((s) => s.generateCupBracketMatches);
  const updateCupMatch = useAppStore((s) => s.updateCupMatch);
  const completeCupMatch = useAppStore((s) => s.completeCupMatch);
  const resetCup = useAppStore((s) => s.resetCup);

  const [selectedMatch, setSelectedMatch] = useState<CupMatch | null>(null);
  const [generatingPlayoffs, setGeneratingPlayoffs] = useState(false);
  const [generatingBracket, setGeneratingBracket] = useState(false);

  const getTeamName = (id: number) =>
    teams.find((t) => t.id === id)?.name || `Team ${id}`;

  const getTeamLogo = (id: number) =>
    teams.find((t) => t.id === id)?.logo;

  const playoffMatches = cup.matches.filter((m) => m.round === "playoff");
  const bracketMatches = cup.matches.filter((m) => m.round !== "playoff");
  const playoffsCompleted = playoffMatches.every((m) => m.status === "completed");

  const handleGeneratePlayoffs = async () => {
    setGeneratingPlayoffs(true);
    resetCup();
    generatePlayoffMatches();
    setGeneratingPlayoffs(false);
  };

  const handleGenerateBracket = async () => {
    setGeneratingBracket(true);
    generateCupBracketMatches();
    setGeneratingBracket(false);
  };

  const handleScoreClick = (match: CupMatch) => {
    if (match.homeId == null || match.awayId == null) return;
    setSelectedMatch(match);
  };

  const handleSaveAndComplete = (id: number, data: Partial<CupMatch>) => {
    updateCupMatch(id, data);
    completeCupMatch(id);
  };

  const hasAnyContent = cup.playoffsGenerated || cup.bracketGenerated;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Knockout Stage</p>
          <h1 className="text-2xl font-bold">Cup Tournament</h1>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {cup.playoffsGenerated && (
              <button
                onClick={() => {
                  if (confirm("Reset the entire knockout stage?")) {
                    resetCup();
                  }
                }}
                className="btn-ghost text-sm text-danger"
              >
                Reset
              </button>
            )}

            {!cup.playoffsGenerated && (
              <button
                onClick={handleGeneratePlayoffs}
                disabled={generatingPlayoffs || teams.length < 11}
                className="btn-primary"
              >
                {generatingPlayoffs ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Generate Playoff Matches
              </button>
            )}

            {cup.playoffsGenerated && !cup.bracketGenerated && (
              <button
                onClick={handleGenerateBracket}
                disabled={generatingBracket || !playoffsCompleted}
                className={`btn-primary ${
                  !playoffsCompleted ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {generatingBracket ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Generate Cup Bracket
              </button>
            )}

            {!playoffsCompleted && cup.playoffsGenerated && !cup.bracketGenerated && (
              <span className="text-xs text-muted">
                Enter all playoff results first
              </span>
            )}
          </div>
        )}
      </div>

      {!hasAnyContent && (
        <div className="card p-12 text-center">
          <Trophy size={48} className="mx-auto text-muted/30 mb-4" />
          <h2 className="text-lg font-semibold text-text mb-1">
            Knockout Stage
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            After the league phase is complete, the top 5 teams qualify
            automatically for the cup. Teams placed 6th through 11th
            compete in playoff matches for the remaining 3 spots.
          </p>
          {isAdmin && !cup.playoffsGenerated && (
            <button
              onClick={handleGeneratePlayoffs}
              disabled={generatingPlayoffs || teams.length < 11}
              className="btn-primary mt-6"
            >
              Generate Playoff Matches
            </button>
          )}
        </div>
      )}

      {hasAnyContent && !cup.bracketGenerated && (
        <CupPlayoffSection
          matches={playoffMatches}
          getTeamName={getTeamName}
          getTeamLogo={getTeamLogo}
          onScoreClick={handleScoreClick}
        />
      )}

      {cup.bracketGenerated && (
        <>
          {playoffMatches.length > 0 && (
            <CupPlayoffSection
              matches={playoffMatches}
              getTeamName={getTeamName}
              getTeamLogo={getTeamLogo}
              onScoreClick={handleScoreClick}
            />
          )}

          <CupBracket
            matches={bracketMatches}
            getTeamName={getTeamName}
            getTeamLogo={getTeamLogo}
            onScoreClick={handleScoreClick}
            champion={cup.champion}
          />
        </>
      )}

      {selectedMatch && (
        <CupMatchModal
          match={selectedMatch}
          getTeamName={getTeamName}
          onSave={updateCupMatch}
          onComplete={completeCupMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
