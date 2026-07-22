"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { parseImportFile, buildImportPlan } from "@/lib/utils/data-import";
import { refreshTeamData } from "@/lib/hooks/use-team-data";
import Notifications from "@/components/notifications/notifications";
import { Search, Download, Upload, RotateCcw, LogOut, Shield, RefreshCw, Sun, Moon } from "lucide-react";

interface AppHeaderProps {
  onOpenSearch: () => void;
}

export function AppHeader({ onOpenSearch }: AppHeaderProps) {
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const userProfile = useAppStore((s) => s.userProfile);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isPlayer = userProfile?.role === "player";
  const currentOrg = useAppStore((s) => s.currentOrg);
  const logout = useAppStore((s) => s.logout);
  const resetTeams = useAppStore((s) => s.resetTeams);
  const setTeams = useAppStore((s) => s.setTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setPlayers = useAppStore((s) => s.setPlayers);
  const deleteAllPlayers = useAppStore((s) => s.deleteAllPlayers);
  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const players = useAppStore((s) => s.players);
  const [dark, setDark] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("vfl-dark-mode");
    const isDark = stored === "true" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("vfl-dark-mode", String(next));
  };

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
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
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
          setImporting(true);
          try {
            const teamsRes = await fetch("/api/sync/teams", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teams: plan.teams }),
            });
            const teamsData = await teamsRes.json();
            if (!teamsData.error && teamsData.idMap) {
              const idMap = teamsData.idMap;
              await fetch("/api/sync/players", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ players: plan.players, teamIdMap: idMap }),
              });
              await fetch("/api/sync/fixtures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fixtures: plan.fixtures, teamIdMap: idMap }),
              });
            }
            alert(`Import complete. ${plan.teams.length} teams, ${plan.players.length} players synced to database.`);
          } catch {
            alert(`Data imported locally. Sync to database failed — use the Database tab to retry.`);
          } finally {
            setImporting(false);
          }
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
          <h1 className="text-lg font-bold text-text">
            {currentOrg ? currentOrg.name : "VUNA Football League"}
          </h1>
          <p className="text-xs text-muted">
            {currentOrg ? (
              <><span className="capitalize">{currentOrg.type}</span> &middot; Management System</>
            ) : (
              "Management System"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDark}
          className="btn-icon"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={onOpenSearch}
          className="btn-icon"
          title="Search"
        >
          <Search size={18} />
        </button>
        {isAdmin && (
          <>
            <button
              onClick={handleExport}
              className="btn-icon"
              title="Export data"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-icon"
              title={importing ? "Importing & syncing..." : "Import data"}
            >
              {importing ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : <Upload size={18} />}
            </button>
            <button
              onClick={handleReset}
              className="btn-icon text-danger"
              title="Reset to defaults"
            >
              <RotateCcw size={18} />
            </button>
          </>
        )}
        {userProfile && (
          <div className="flex items-center gap-2 ml-3 pl-3 border-l border-line">
            <span className="text-sm text-muted">
              {isAdmin ? "Admin" : isPlayer ? userProfile.displayName || "Player" : currentTeamAccount?.name}
            </span>
            {/* Notifications */}
            <div className="ml-2">
              <Notifications />
            </div>
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
