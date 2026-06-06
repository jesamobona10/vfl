"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { CupBracket } from "@/components/cup/cup-bracket";
import { CupPlayoffSection } from "@/components/cup/cup-playoff-section";
import { CupMatchModal } from "@/components/cup/cup-match-modal";
import type { CupMatch } from "@/lib/types";
import { Trophy, Loader2, Download, ChevronDown } from "lucide-react";
import { exportAsJSON, exportAsPNG, exportAsPDF } from "@/lib/utils/export";

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

  const getTeamName = (id: number) =>
    teams.find((t) => t.id === id)?.name || `Team ${id}`;

  const getTeamLogo = (id: number) =>
    teams.find((t) => t.id === id)?.logo;

  const playoffMatches = cup.matches.filter((m) => m.round === "playoff");
  const bracketMatches = cup.matches.filter((m) => m.round !== "playoff");

  const handleGenerate = async () => {
    setGenerating(true);
    resetCup();
    generateKnockoutStage();
    setGenerating(false);
  };

  const handleScoreClick = (match: CupMatch) => {
    if (match.homeId == null || match.awayId == null) return;
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

  const buildExportData = () => {
    const data = cup.matches.map((m) => ({
      round: m.round,
      matchIndex: m.matchIndex,
      home: m.homeId != null ? getTeamName(m.homeId) : "TBD",
      away: m.awayId != null ? getTeamName(m.awayId) : "TBD",
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homeETScore: m.homeETScore,
      awayETScore: m.awayETScore,
      homePenScore: m.homePenScore,
      awayPenScore: m.awayPenScore,
      status: m.status,
      winner: m.winnerId != null ? getTeamName(m.winnerId) : null,
      completedVia: m.completedVia,
      venue: m.venue,
    }));
    return {
      tournament: "Knockout Stage",
      champion: cup.champion != null ? getTeamName(cup.champion) : null,
      matches: data,
      exportedAt: new Date().toISOString(),
    };
  };

  const handleDownloadJSON = () => {
    setMenuOpen(false);
    exportAsJSON(buildExportData(), "vuna-knockout.json");
  };

  const handleDownloadPNG = async () => {
    setMenuOpen(false);
    if (!contentRef.current) return;
    await exportAsPNG(contentRef.current, "vuna-knockout.png");
  };

  const handleDownloadPDF = async () => {
    setMenuOpen(false);
    if (!contentRef.current) return;
    await exportAsPDF(contentRef.current, "vuna-knockout.pdf", "Knockout Stage");
  };

  const hasAnyContent = cup.playoffsGenerated || cup.bracketGenerated;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-muted">Knockout Stage</p>
          <h1 className="text-2xl font-bold">Cup Tournament</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {hasAnyContent && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="btn-ghost text-sm"
              >
                <Download size={14} />
                Download
                <ChevronDown size={12} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg py-1 z-20 w-36">
                  <button
                    onClick={handleDownloadJSON}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-surface-2 transition-colors"
                  >
                    JSON
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-surface-2 transition-colors"
                  >
                    PDF
                  </button>
                  <button
                    onClick={handleDownloadPNG}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-surface-2 transition-colors"
                  >
                    PNG
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
                  className="btn-ghost text-sm text-danger"
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
          <Trophy size={48} className="mx-auto text-muted/30 mb-4" />
          <h2 className="text-lg font-semibold text-text mb-1">
            Knockout Stage
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            After the league phase is complete, the top 5 teams qualify
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

            <CupBracket
              matches={bracketMatches}
              getTeamName={getTeamName}
              getTeamLogo={getTeamLogo}
              onScoreClick={handleScoreClick}
              champion={cup.champion}
            />
          </>
        )}
      </div>

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
