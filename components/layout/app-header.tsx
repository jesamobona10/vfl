"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { parseImportFile, buildImportPlan } from "@/lib/utils/data-import";
import { refreshTeamData } from "@/lib/hooks/use-team-data";
import { Download, Upload, RotateCcw, LogOut, Shield, RefreshCw } from "lucide-react";

export function AppHeader() {
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const logout = useAppStore((s) => s.logout);
  const resetTeams = useAppStore((s) => s.resetTeams);
  const setTeams = useAppStore((s) => s.setTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setPlayers = useAppStore((s) => s.setPlayers);
  const deleteAllPlayers = useAppStore((s) => s.deleteAllPlayers);
  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const players = useAppStore((s) => s.players);
  const [refreshing, setRefreshing] = useState(false);

  const handleExport = () => {
    const data = { teams, fixtures, players };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vfl-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target?.result as string);
          const parsed = parseImportFile(json);
          if ("error" in parsed) {
            alert(`Import error: ${parsed.error}`);
            return;
          }
          const plan = buildImportPlan(parsed, teams);
          setTeams(plan.teams);
          setFixtures(plan.fixtures);
          setPlayers(plan.players);
          alert(`Data imported successfully. ${plan.teams.length} teams, ${plan.players.length} players, ${plan.fixtures.reduce((s, r) => s + r.matches.length, 0)} matches.`);
        } catch {
          alert("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    if (confirm("Reset all data to defaults? This cannot be undone.")) {
      resetTeams();
      setFixtures([]);
      deleteAllPlayers();
    }
  };

  return (
    <header className="bg-surface border-b border-line px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="text-brand" size={28} />
        <div>
          <h1 className="text-lg font-bold text-text">VUNA Football League</h1>
          <p className="text-xs text-muted">Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="btn-icon"
          title="Export data"
        >
          <Download size={18} />
        </button>
        <button
          onClick={handleImport}
          className="btn-icon"
          title="Import data"
        >
          <Upload size={18} />
        </button>
        <button
          onClick={handleReset}
          className="btn-icon text-danger"
          title="Reset to defaults"
        >
          <RotateCcw size={18} />
        </button>
        {(currentTeamAccount || isAdmin) && (
          <div className="flex items-center gap-2 ml-3 pl-3 border-l border-line">
            <span className="text-sm text-muted">
              {isAdmin ? "Admin" : currentTeamAccount?.name}
            </span>
            {currentTeamAccount && (
              <button
                onClick={async () => {
                  setRefreshing(true);
                  await refreshTeamData();
                  setRefreshing(false);
                }}
                disabled={refreshing}
                className="btn-icon"
                title="Refresh team data"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              </button>
            )}
            <button onClick={logout} className="btn-icon" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
