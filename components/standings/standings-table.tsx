"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import {
  calculateStandings,
  completedMatches,
} from "@/lib/logic/standings";
import { Download, ChevronDown } from "lucide-react";
import {
  exportAsJSON,
  exportAsPNG,
  exportAsPDF,
} from "@/lib/utils/export";
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
    if (teamId === m.homeId)
      return homeWin ? "W" : awayWin ? "L" : "D";
    return awayWin ? "W" : homeWin ? "L" : "D";
  });
}

function FormGuide({ form }: { form: string[] }) {
  if (!form.length)
    return <span className="text-muted">-</span>;

  const colors: Record<string, string> = {
    W: "bg-brand text-white",
    D: "bg-muted/30 text-muted",
    L: "bg-danger text-white",
  };

  return (
    <span className="flex items-center gap-1 justify-center">
      {form.map((r, i) => (
        <span
          key={i}
          className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold ${
            colors[r] || "bg-muted/20 text-muted"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function StandingsTable() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);

  const standings = calculateStandings(teams, fixtures);

  const rows: (StandingRow & { formArr: string[] })[] =
    standings.map((row) => ({
      ...row,
      formArr: computeForm(row.id, fixtures),
    }));

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleDownloadJSON = () => {
    setMenuOpen(false);
    exportAsJSON(standings, "vuna-standings.json");
  };

  const handleDownloadPNG = async () => {
    setMenuOpen(false);
    if (!tableRef.current) return;
    await exportAsPNG(tableRef.current, "vuna-standings.png");
  };

  const handleDownloadPDF = async () => {
    setMenuOpen(false);
    if (!tableRef.current) return;
    await exportAsPDF(
      tableRef.current,
      "vuna-standings.pdf",
      "League Standings"
    );
  };

  if (!standings.length) {
    return (
      <div className="card p-8 text-center text-muted">
        <p>No teams to display.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden" ref={tableRef}>
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <h2 className="font-semibold">Full League Table</h2>
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
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">#</th>
              <th className="text-left px-5 py-3 font-medium">
                Team
              </th>
              <th className="text-center px-5 py-3 font-medium">
                Rtg
              </th>
              <th className="text-center px-5 py-3 font-medium">
                P
              </th>
              <th className="text-center px-5 py-3 font-medium">
                W
              </th>
              <th className="text-center px-5 py-3 font-medium">
                D
              </th>
              <th className="text-center px-5 py-3 font-medium">
                L
              </th>
              <th className="text-center px-5 py-3 font-medium">
                GF
              </th>
              <th className="text-center px-5 py-3 font-medium">
                GA
              </th>
              <th className="text-center px-5 py-3 font-medium">
                GD
              </th>
              <th className="text-center px-5 py-3 font-medium">
                Pts
              </th>
              <th className="text-center px-5 py-3 font-medium">
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((team, index) => (
              <tr
                key={team.id}
                className="border-b border-line/50 last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <td className="px-5 py-3 font-bold">
                  {index + 1}
                </td>
                <td className="px-5 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    {(() => {
                      const t = teams.find((tt) => tt.id === team.id);
                      return t?.logo_url ? (
                        <img
                          src={t.logo_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-surface-2 inline-block shrink-0" />
                      );
                    })()}
                    {team.name}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  {team.rating?.toFixed(1) || "6.0"}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.played}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.won}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.drawn}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.lost}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.gf}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.ga}
                </td>
                <td className="px-5 py-3 text-center font-medium">
                  {team.gd > 0 ? `+${team.gd}` : team.gd}
                </td>
                <td className="px-5 py-3 text-center font-bold">
                  {team.points}
                </td>
                <td className="px-5 py-3">
                  <FormGuide form={team.formArr} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
