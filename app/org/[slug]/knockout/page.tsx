"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { CupBracket } from "@/components/cup/cup-bracket";
import { CupPlayoffSection } from "@/components/cup/cup-playoff-section";
import { CupMatchModal } from "@/components/cup/cup-match-modal";
import { exportAsJSON, exportAsPNG, exportAsPDF } from "@/lib/utils/export";
import { Download, Loader2, Swords, ChevronDown } from "lucide-react";
import type { CupMatch } from "@/lib/types";

export default function OrgKnockoutPage() {
  const cup = useAppStore((s) => s.cup);
  const teams = useAppStore((s) => s.teams);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const generateKnockoutStage = useAppStore((s) => s.generateKnockoutStage);
  const updateCupMatch = useAppStore((s) => s.updateCupMatch);
  const completeCupMatch = useAppStore((s) => s.completeCupMatch);
  const resetCup = useAppStore((s) => s.resetCup);

  const [selectedMatch, setSelectedMatch] = useState<CupMatch | null>(null);
  const [generating, setGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const hasAnyContent = cup.playoffsGenerated || cup.bracketGenerated;

  const getTeamName = (id: number | null) =>
    teams.find((t) => t.id === id)?.name || "Unknown";
  const getTeamLogo = (id: number | null) =>
    teams.find((t) => t.id === id)?.logo;

  const playoffMatches = cup.matches.filter((m) => m.round === "playoff");
  const bracketMatches = cup.matches.filter((m) => m.round !== "playoff");

  const handleGenerate = () => {
    setGenerating(true);
    resetCup();
    generateKnockoutStage();
    setGenerating(false);
  };

  const handleScoreClick = (match: CupMatch) => {
    setSelectedMatch(match);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSaveScore = (id: number, data: Partial<CupMatch>) => {
    updateCupMatch(id, data);
    completeCupMatch(id);
    setSelectedMatch(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Knockout Stage</h1>
          <p className="text-sm text-muted">Cup competition bracket and playoffs</p>
        </div>

        <div className="flex items-center gap-2">
          {hasAnyContent && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="btn-ghost flex items-center gap-1"
              >
                <Download size={16} />
                Export
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-line rounded-xl shadow-xl z-50 min-w-[160px] overflow-x-auto">
                  <button
                    onClick={() => { exportAsJSON(cup.matches, cup.champion, getTeamName); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => { exportAsPNG(contentRef, getTeamName); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors"
                  >
                    Export as PNG
                  </button>
                  <button
                    onClick={() => { exportAsPDF(contentRef, getTeamName); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors"
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <>
              {cup.bracketGenerated && (
                <button
                  onClick={() => {
                    if (confirm("Reset the entire knockout stage?")) {
                      resetCup();
                    }
                  }}
                  className="btn-ghost text-danger"
                >
                  Reset
                </button>
              )}

              {!cup.bracketGenerated && (
                <button
                  onClick={handleGenerate}
                  disabled={generating || teams.length < 11}
                  className="btn-primary"
                >
                  {generating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  Generate Knockout Stage
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!hasAnyContent && (
        <div className="card p-12 text-center">
          <Swords size={48} className="mx-auto text-muted mb-4" />
          <h2 className="text-xl font-bold mb-2">No Knockout Stage Yet</h2>
          <p className="text-muted max-w-md mx-auto">
            After the league season concludes, the top 5 teams qualify
            automatically for the cup. Teams placed 6th through 11th
            compete in playoff matches for the remaining 3 spots.
          </p>
          {isAdmin && !cup.bracketGenerated && (
            <button
              onClick={handleGenerate}
              disabled={generating || teams.length < 11}
              className="btn-primary mt-6"
            >
              {generating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              Generate Knockout Stage
            </button>
          )}
        </div>
      )}

      <div ref={contentRef}>
        {hasAnyContent && (
          <>
            {playoffMatches.length > 0 && (
              <CupPlayoffSection
                matches={playoffMatches}
                getTeamName={getTeamName}
                getTeamLogo={getTeamLogo}
                onScoreClick={handleScoreClick}
              />
            )}

            {bracketMatches.length > 0 && (
              <div className="mt-8">
                <CupBracket
                  matches={bracketMatches}
                  getTeamName={getTeamName}
                  getTeamLogo={getTeamLogo}
                  onScoreClick={handleScoreClick}
                  champion={cup.champion}
                />
              </div>
            )}
          </>
        )}
      </div>

      {selectedMatch && (
        <CupMatchModal
          match={selectedMatch}
          getTeamName={getTeamName}
          onSave={handleSaveScore}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
