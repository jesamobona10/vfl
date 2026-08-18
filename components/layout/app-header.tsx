"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { parseImportFile, buildImportPlan } from "@/lib/utils/data-import";
import { refreshTeamData } from "@/lib/hooks/use-team-data";
import Notifications from "@/components/notifications/notifications";
import {
  Search,
  Download,
  Upload,
  RotateCcw,
  LogOut,
  RefreshCw,
  Settings2,
  Menu,
} from "lucide-react";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";

interface AppHeaderProps {
  onOpenSearch: () => void;
  onOpenMenu?: () => void;
}

export function AppHeader({ onOpenSearch, onOpenMenu }: AppHeaderProps) {
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
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const fixtures = useAppStore((s) => s.fixtures);
  const players = useAppStore((s) => s.players);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
    setMenuOpen(false);
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
            alert(
              `Import complete. ${plan.teams.length} teams, ${plan.players.length} players synced to database.`
            );
          } catch {
            alert(
              `Data imported locally. Sync to database failed — use the Database tab to retry.`
            );
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
    setMenuOpen(false);
  };

  const handleReset = () => {
    setMenuOpen(false);
    if (confirm("Reset all data to defaults? This cannot be undone.")) {
      resetTeams();
      setFixtures([]);
      deleteAllPlayers();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshTeamData();
    setRefreshing(false);
  };

  const displayName = isAdmin
    ? "Admin"
    : isPlayer
      ? userProfile?.displayName || "Player"
      : currentTeamAccount?.name || currentOrg?.name || "LeagueForge";

  return (
    <header className="bg-panel border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenMenu && (
          <button onClick={onOpenMenu} className="btn-icon lg:hidden" aria-label="Open navigation">
            <Menu size={20} />
          </button>
        )}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 text-sm text-ink-3 bg-page border border-line rounded-lg px-3.5 py-2 hover:border-brand-600/30 transition-colors"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Search teams, players, fixtures&hellip;</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Notifications />
        {currentTeamAccount && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-icon"
            title="Refresh team data"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        )}

        {isAdmin && (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((o) => !o)} className="btn-icon" title="Data tools">
              <Settings2 size={17} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-panel border border-line rounded-xl shadow-lg p-1.5 z-50">
                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-2 rounded-lg transition-colors"
                >
                  <Download size={15} /> Export data
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Upload size={15} /> {importing ? "Importing&hellip;" : "Import data"}
                </button>
                <button
                  onClick={handleReset}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-tint rounded-lg transition-colors"
                >
                  <RotateCcw size={15} /> Reset to defaults
                </button>
              </div>
            )}
          </div>
        )}

        {userProfile && (
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-line">
            <span className="text-sm text-ink-2 hidden sm:inline">{displayName}</span>
            <button onClick={logout} className="btn-icon" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
