"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useSeasonStandings } from "@/lib/hooks/use-competitions";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { calculateStandings, completedMatches } from "@/lib/logic/standings";
import { Download, ChevronDown, ChevronRight, Crown, ChevronLeft, Eye } from "lucide-react";
import { exportAsJSON, exportAsPNG, exportAsPDF } from "@/lib/utils/export";
import { SkeletonTable, EmptyState } from "@/components/shared/skeleton";
import type { StandingRow } from "@/lib/types";

function computeForm(
  teamId: number,
  fixtures: ReturnType<typeof useAppStore.getState>["fixtures"]
): string[] {
  const teamMatches = completedMatches(fixtures)
    .filter((m) => m.homeId === teamId || m.awayId === teamId)
    .slice(-5);

  return teamMatches.map((m) => {
    const homeWin = m.homeScore! > m.awayScore!;
    const awayWin = m.awayScore! > m.homeScore!;
    if (teamId === m.homeId) return homeWin ? "W" : awayWin ? "L" : "D";
    return awayWin ? "W" : homeWin ? "L" : "D";
  });
}

function FormGuide({ form }: { form: string[] }) {
  if (!form.length) return <span className="text-muted">—</span>;

  const colors: Record<string, string> = {
    W: "bg-brand text-white",
    D: "bg-muted/30 text-muted",
    L: "bg-danger text-white",
  };

  return (
    <span className="flex items-center gap-1 justify-center" role="img" aria-label={`Form: ${form.join(", ")}`}>
      {form.map((r, i) => (
        <span
          key={i}
          className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${
            colors[r] || "bg-muted/20 text-muted"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

interface StandingsTableProps {
  overviewMode?: boolean;
}

export function StandingsTable({ overviewMode = false }: StandingsTableProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableElementRef = useRef<HTMLTableElement>(null);

  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const fixtures = useAppStore((s) => s.fixtures);

  const { data: seasonStandings, isPending: standingsPending } = useSeasonStandings(
    currentSeasonId ?? undefined
  );
  const teams = useResolvedTeams(currentSeasonId);

  const standings = seasonStandings?.length
    ? seasonStandings.map((s: any, i: number) => ({
        id: s.team_id ?? s.id,
        name: s.team_name ?? s.name,
        played: s.played ?? s.p,
        won: s.won ?? s.w,
        drawn: s.drawn ?? s.d,
        lost: s.lost ?? s.l,
        gf: s.goals_for ?? s.gf,
        ga: s.goals_against ?? s.ga,
        gd: s.goal_difference ?? s.gd,
        points: s.points ?? s.pts,
        rating: s.rating ?? 6.0,
      }))
    : calculateStandings(teams, fixtures);

  const rows: (StandingRow & { formArr: string[] })[] = standings.map((row) => {
    const formArr = computeForm(row.id, fixtures);
    return {
      ...row,
      formArr,
      form: formArr.join(""),
    } as StandingRow & { formArr: string[] };
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDownloadJSON = () => {
    setMenuOpen(false);
    exportAsJSON(standings, "leagueforge-standings.json");
  };

  const handleDownloadPNG = async () => {
    setMenuOpen(false);
    if (!tableElementRef.current) return;
    await exportAsPNG(tableElementRef.current, "leagueforge-standings.png");
  };

  const handleDownloadPDF = async () => {
    setMenuOpen(false);
    if (!tableElementRef.current) return;
    await exportAsPDF(tableElementRef.current, "leagueforge-standings.pdf", "League Standings");
  };

  const toggleRow = (teamId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const isExpanded = (teamId: number) => expandedRows.has(teamId);

  if (standingsPending && !standings.length) {
    return (
      <div className="card p-4">
        <SkeletonTable rows={8} cols={6} />
      </div>
    );
  }

  if (!standings.length) {
    return (
      <div className="card p-5 sm:p-8 text-center text-muted">
        <p>No teams to display.</p>
      </div>
    );
  }

  const getTier = (index: number, total: number) => {
    if (index === 0) return "champion";
    if (index < 4) return "promotion";
    if (index >= total - 2) return "relegation";
    return "mid";
  };

  const tierLabels: Record<string, { label: string; color: string }> = {
    champion: { label: "🏆 Champion", color: "bg-gold-tint text-gold-700" },
    promotion: { label: "📈 Promotion", color: "bg-brand-50 text-brand-700" },
    mid: { label: "⚽ Mid-table", color: "bg-surface-2 text-ink-3" },
    relegation: { label: "📉 Relegation", color: "bg-danger-tint text-danger-700" },
  };

  const renderTableRows = () => {
    return rows.map((team, index) => {
      const tier = getTier(index, rows.length);
      const tierInfo = tierLabels[tier];
      const isChamp = index === 0;
      const isExpandedRow = isExpanded(team.id);
      const hasAdvancedData = false;

      return (
        <React.Fragment key={team.id}>
          {overviewMode && (index === 0 || index === 4 || index >= rows.length - 2) && (
            <tr className={tierInfo.color}>
              <td colSpan={overviewMode ? 10 : 14} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
                {tierInfo.label}
              </td>
            </tr>
          )}
          <tr
            className={`border-b border-line/50 last:border-0 hover:bg-surface-2/40 transition-colors ${
              isChamp ? "bg-gold-tint/30" : ""
            } ${isExpandedRow ? "bg-surface-2/50" : ""}`}
          >
            <td className="px-4 py-3 font-bold sticky left-0 bg-panel w-12">
              {isChamp ? (
                <span className="inline-flex items-center justify-center gap-1 text-gold-700">
                  <Crown size={15} className="fill-gold-500 text-gold-500" />
                </span>
              ) : (
                index + 1
              )}
            </td>
            <td className="px-4 py-3 font-medium sticky left-12 bg-panel">
              <span className="flex items-center gap-2">
                {(() => {
                  const t = teams.find((tt) => tt.id === team.id);
                  return t?.logo_url ? (
                    <img
                      src={t.logo_url}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                      width={20}
                      height={20}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-surface-2 inline-block shrink-0" />
                  );
                })()}
                <span className="truncate max-w-[200px]">{team.name}</span>
                {isChamp && (
                  <Crown size={12} className="fill-gold-500 text-gold-500 shrink-0 ml-1" />
                )}
              </span>
            </td>
            {!overviewMode && (
              <td className="px-5 py-3 text-center">{team.rating?.toFixed(1) || "6.0"}</td>
            )}
            <td className="px-5 py-3 text-center">{team.played}</td>
            <td className="px-5 py-3 text-center">{team.won}</td>
            <td className="px-5 py-3 text-center">{team.drawn}</td>
            <td className="px-5 py-3 text-center">{team.lost}</td>
            {!overviewMode && (
              <>
                <td className="px-5 py-3 text-center">{team.gf}</td>
                <td className="px-5 py-3 text-center">{team.ga}</td>
              </>
            )}
            <td className="px-5 py-3 text-center font-medium">
              {team.gd > 0 ? `+${team.gd}` : team.gd}
            </td>
            <td className="px-5 py-3 text-center font-bold">{team.points}</td>
            <td className="px-5 py-3">
              <FormGuide form={team.formArr} />
            </td>
            {showAdvanced && !overviewMode && (
              <>
                <td className="px-5 py-3 text-center text-muted">—</td>
                <td className="px-5 py-3 text-center text-muted">—</td>
                <td className="px-5 py-3 text-center text-muted">—</td>
                <td className="px-5 py-3 text-center text-muted">—</td>
                <td className="px-5 py-3 text-center text-muted">—</td>
              </>
            )}
          </tr>
          {(hasAdvancedData || !overviewMode) && (
            <tr className={`border-b border-line/50 ${!isExpandedRow ? "hidden" : ""} bg-surface-2/30`}>
              <td colSpan={overviewMode ? 10 : 14} className="px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="bg-surface p-3 rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">Last 5</p>
                    <FormGuide form={team.formArr} />
                  </div>
                  <div className="bg-surface p-3 rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">Streak</p>
                    <p className="font-semibold">{team.formArr.join("") || "—"}</p>
                  </div>
                  <div className="bg-surface p-3 rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">Home / Away</p>
                    <p className="text-muted">—</p>
                  </div>
                  <div className="bg-surface p-3 rounded-lg">
                    <p className="text-xs text-muted uppercase tracking-wider">Next Fixture</p>
                    <p className="text-muted">—</p>
                  </div>
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });
  };

  if (standingsPending && !standings.length) {
    return (
      <div className="card p-4">
        <SkeletonTable rows={8} cols={6} />
      </div>
    );
  }

  if (!standings.length) {
    return (
      <div className="card p-8 sm:p-12 text-center">
        <EmptyState
          title="No standings data available"
          description="Register teams and generate fixtures to build the league table."
        />
      </div>
    );
  }

  return (
    <div className="panel" ref={tableRef}>
      <div className="panel-head flex flex-wrap items-center justify-between gap-2 mb-4">
        <span className="panel-title">Full League Table</span>
        <div className="flex items-center gap-2">
          {!overviewMode && (
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="btn-ghost text-sm flex items-center gap-1"
              aria-pressed={showAdvanced}
            >
              <ChevronDown size={14} className={showAdvanced ? "rotate-180" : ""} />
              <span>{showAdvanced ? "Hide" : "Show"} Advanced</span>
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="btn-ghost text-sm">
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" ref={tableElementRef}>
          <thead>
            <tr className="text-xs uppercase tracking-[0.04em] text-ink-3 font-semibold">
              <th className="text-left px-4 py-2.5 font-semibold border-b border-line sticky left-0 bg-panel z-10 w-12">
                #
              </th>
              <th className="text-left px-4 py-2.5 font-semibold border-b border-line sticky left-12 bg-panel z-10">
                Team
              </th>
              {!overviewMode && (
                <>
                  <th className="text-center px-4 py-2.5 font-semibold border-b border-line">Rtg</th>
                </>
              )}
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">P</th>
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">W</th>
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">D</th>
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">L</th>
              {!overviewMode && (
                <>
                  <th className="text-center px-4 py-2.5 font-semibold border-b border-line">GF</th>
                  <th className="text-center px-4 py-2.5 font-semibold border-b border-line">GA</th>
                </>
              )}
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">GD</th>
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">Pts</th>
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">Form</th>
            </tr>
            {showAdvanced && !overviewMode && (
              <tr className="text-xs uppercase tracking-[0.04em] text-ink-3 font-semibold bg-surface-2/50">
                <th className="px-4 py-2 border-b border-line" colSpan={2}></th>
                <th className="text-center px-4 py-2 border-b border-line">xG</th>
                <th className="text-center px-4 py-2 border-b border-line">xGA</th>
                <th className="text-center px-4 py-2 border-b border-line">xPts</th>
                <th className="text-center px-4 py-2 border-b border-line">CS</th>
                <th className="text-center px-4 py-2 border-b border-line">FTS</th>
              </tr>
            )}
          </thead>
          <tbody>
            {renderTableRows()}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="lg:hidden mt-4 space-y-3">
        {rows.map((team, index) => {
          const tier = getTier(index, rows.length);
          const tierInfo = tierLabels[tier];
          const isChamp = index === 0;

          return (
            <div
              key={team.id}
              className={`card p-4 ${isChamp ? "bg-gold-tint/30 border-gold-500/50" : ""} ${
                tier === "promotion" ? "border-brand/20" : tier === "relegation" ? "border-danger/20" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{isChamp ? "🏆" : index + 1}</span>
                  <span className="font-semibold">{team.name}</span>
                  {isChamp && <Crown size={16} className="fill-gold-500 text-gold-500" />}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierInfo.color}`}>
                  {tierInfo.label}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                <div className="bg-surface-2 rounded p-2"><p className="font-bold">{team.points}</p><p className="text-xs text-muted">Pts</p></div>
                <div className="bg-surface-2 rounded p-2"><p className="font-bold">{team.played}</p><p className="text-xs text-muted">P</p></div>
                <div className="bg-surface-2 rounded p-2"><p className="font-bold text-brand">{team.won}</p><p className="text-xs text-muted">W</p></div>
                <div className="bg-surface-2 rounded p-2"><p className="font-bold text-danger">{team.lost}</p><p className="text-xs text-muted">L</p></div>
                <div className="bg-surface-2 rounded p-2"><p className="font-bold">{team.gd > 0 ? `+${team.gd}` : team.gd}</p><p className="text-xs text-muted">GD</p></div>
              </div>
              <div className="mt-2 flex items-center justify-center">
                <FormGuide form={team.formArr} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const tierLabels: Record<string, { label: string; color: string }> = {
  champion: { label: "🏆 Champion", color: "bg-gold-tint text-gold-700" },
  promotion: { label: "📈 Promotion", color: "bg-brand-50 text-brand-700" },
  mid: { label: "⚽ Mid-table", color: "bg-surface-2 text-ink-3" },
  relegation: { label: "📉 Relegation", color: "bg-danger-tint text-danger-700" },
};

function getTier(index: number, total: number) {
  if (index === 0) return "champion";
  if (index < 4) return "promotion";
  if (index >= total - 2) return "relegation";
  return "mid";
}