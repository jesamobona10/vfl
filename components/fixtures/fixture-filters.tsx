"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Download, ChevronDown } from "lucide-react";
import {
  exportAsJSON,
  exportAsPNG,
  exportAsPDF,
} from "@/lib/utils/export";

interface FixtureFiltersProps {
  roundFilter: string;
  teamFilter: string;
  statusFilter: string;
  onRoundChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  captureRef?: React.RefObject<HTMLDivElement | null>;
}

export function FixtureFilters({
  roundFilter,
  teamFilter,
  statusFilter,
  onRoundChange,
  onTeamChange,
  onStatusChange,
  captureRef,
}: FixtureFiltersProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fixtures = useAppStore((s) => s.fixtures);
  const teams = useAppStore((s) => s.teams);

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

  const getFilteredFixtures = () => {
    return fixtures
      .filter(
        (r) =>
          roundFilter === "all" || String(r.round) === roundFilter
      )
      .map((r) => ({
        ...r,
        matches: r.matches.filter((m) => {
          const teamMatch =
            teamFilter === "all" ||
            m.homeId === Number(teamFilter) ||
            m.awayId === Number(teamFilter);
          const statusMatch =
            statusFilter === "all" || m.status === statusFilter;
          return teamMatch && statusMatch;
        }),
      }))
      .filter((r) => r.matches.length > 0);
  };

  const handleDownloadJSON = () => {
    setMenuOpen(false);
    const filtered = getFilteredFixtures();
    if (!filtered.length) {
      alert("No fixtures match the current filters.");
      return;
    }
    const label =
      roundFilter !== "all"
        ? `round-${roundFilter}`
        : "all-fixtures";
    exportAsJSON(filtered, `vuna-fixtures-${label}.json`);
  };

  const handleDownloadPNG = async () => {
    setMenuOpen(false);
    if (!captureRef?.current) return;
    await exportAsPNG(captureRef.current, "vuna-fixtures.png");
  };

  const handleDownloadPDF = async () => {
    setMenuOpen(false);
    if (!captureRef?.current) return;
    await exportAsPDF(
      captureRef.current,
      "vuna-fixtures.pdf",
      "Fixtures"
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={roundFilter}
        onChange={(e) => onRoundChange(e.target.value)}
        className="input w-auto min-w-[130px]"
        aria-label="Filter by round"
      >
        <option value="all">All Rounds</option>
        {fixtures.map((r) => (
          <option key={r.round} value={r.round}>
            Round {r.round}
          </option>
        ))}
      </select>

      <select
        value={teamFilter}
        onChange={(e) => onTeamChange(e.target.value)}
        className="input w-auto min-w-[150px]"
        aria-label="Filter by team"
      >
        <option value="all">All Teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="input w-auto min-w-[140px]"
        aria-label="Filter by status"
      >
        <option value="all">All Statuses</option>
        <option value="scheduled">Scheduled</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="btn-ghost"
        >
          <Download size={16} />
          Download
          <ChevronDown size={14} />
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
  );
}
