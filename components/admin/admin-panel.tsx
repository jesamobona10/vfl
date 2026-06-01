"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { MatchEditor } from "./match-editor";
import { TeamForm } from "../teams/team-form";
import { DataImporter } from "./data-importer";
import {
  Wrench,
  AlertCircle,
  CheckCircle,
  Info,
  Users,
  UserCog,
  Calendar,
  Shield,
  Trash2,
  Plus,
  Save,
  Edit2,
  X,
  Database,
  Upload,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  FileDown,
} from "lucide-react";
import type { Team, Player } from "@/lib/types";
import { GeneratePlayerCredentials } from "@/components/players/generate-player-credentials";

type AdminTab = "teams" | "players" | "fixtures" | "database" | "accounts" | "import";

function PlayerManager() {
  const isAdmin = useAppStore((s) => s.isAdmin);
  const players = useAppStore((s) => s.players);
  const teams = useAppStore((s) => s.teams);
  const addPlayer = useAppStore((s) => s.addPlayer);
  const deletePlayer = useAppStore((s) => s.deletePlayer);
  const deleteTeamPlayers = useAppStore((s) => s.deleteTeamPlayers);
  const [filterTeam, setFilterTeam] = useState("");
  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState<Player["position"]>("MID");
  const [newNumber, setNewNumber] = useState("");
  const [newTeam, setNewTeam] = useState("");

  const filtered = filterTeam
    ? players.filter((p) => p.teamId === Number(filterTeam))
    : players;

  const handleAdd = () => {
    if (!newName.trim() || !newTeam) return;
    const teamPlayers = players.filter((p) => p.teamId === Number(newTeam));
    const maxId = players.reduce((m, p) => Math.max(m, p.id), 0);
    addPlayer({
      id: maxId + 1,
      teamId: Number(newTeam),
      name: newName.trim(),
      position: newPosition,
      number: parseInt(newNumber) || teamPlayers.length + 1,
      goals: 0, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0,
      saves: 0, penaltySaves: 0, cleanSheets: 0, motm: 0, tackles: 0,
      interceptions: 0, blocks: 0, aerialDuelsWon: 0, errorsLeadingToGoal: 0,
      penaltiesConceded: 0, goalsConceded: 0, matchWins: 0, bonus5Saves: 0,
      captain: false, rating: 6.0, matchRatings: {},
    });
    setNewName("");
    setNewNumber("");
  };

  const handleDelete = (id: number) => {
    const p = players.find((pl) => pl.id === id);
    if (!p) return;
    if (!confirm(`Delete player ${p.name}?`)) return;
    deletePlayer(id);
  };

  const handleDeleteAllFromTeam = () => {
    if (!filterTeam) return;
    const team = teams.find((t) => t.id === Number(filterTeam));
    if (!team) return;
    if (!confirm(`Delete all players from ${team.name}?`)) return;
    deleteTeamPlayers(Number(filterTeam));
  };

  const filterTeamName = filterTeam
    ? teams.find((t) => t.id === Number(filterTeam))?.name
    : undefined;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Players</h3>

      {isAdmin && (
        <GeneratePlayerCredentials
          scope="admin"
          teamId={filterTeam ? Number(filterTeam) : undefined}
          teamName={filterTeamName}
          playerCount={filtered.length}
        />
      )}

      <div className="card p-4 space-y-3">
        <h4 className="text-sm font-semibold text-muted uppercase tracking-wider">Add Player</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <select value={newTeam} onChange={(e) => setNewTeam(e.target.value)} className="input text-sm py-1.5">
            <option value="">Team...</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input text-sm py-1.5" placeholder="Player name" />
          <select value={newPosition} onChange={(e) => setNewPosition(e.target.value as Player["position"])} className="input text-sm py-1.5">
            <option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="ATT">ATT</option>
          </select>
          <input type="number" min={1} max={99} value={newNumber} onChange={(e) => setNewNumber(e.target.value)} className="input text-sm py-1.5" placeholder="Number" />
          <button onClick={handleAdd} className="btn-primary text-sm py-1.5" disabled={!newName.trim() || !newTeam}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="input w-auto text-sm py-1.5">
          <option value="">All Teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {filterTeam && (
          <button onClick={handleDeleteAllFromTeam} className="btn-ghost text-xs text-danger">
            <Trash2 size={14} /> Delete All from Team
          </button>
        )}
        <span className="text-xs text-muted ml-auto">{filtered.length} player(s)</span>
      </div>

      <div className="space-y-1">
        {filtered.map((p) => {
          const team = teams.find((t) => t.id === p.teamId);
          return (
            <div key={p.id} className="card px-4 py-2 flex items-center gap-3 text-sm">
              <span className="w-8 text-muted text-xs">#{p.number}</span>
              <span className="font-medium flex-1">{p.name}</span>
              <span className="text-xs text-muted w-10">{p.position}</span>
              <span className="text-xs text-muted w-24 truncate">{team?.name || "?"}</span>
              <span className="text-xs text-muted">G:{p.goals} A:{p.assists}</span>
              <button onClick={() => handleDelete(p.id)} className="btn-icon text-danger" title="Delete player">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted text-center py-4">No players found.</p>}
      </div>
    </div>
  );
}

function FixtureManager() {
  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const generateFixtures = useAppStore((s) => s.generateFixtures);
  const repairFixtures = useAppStore((s) => s.repairFixtures);
  const repairNotice = useAppStore((s) => s.repairNotice);
  const setRepairNotice = useAppStore((s) => s.setRepairNotice);

  const handleGenerate = () => {
    if (teams.length < 2) {
      setRepairNotice("Need at least 2 teams to generate fixtures.");
      return;
    }
    generateFixtures(teams);
    setRepairNotice("Fixtures generated successfully.");
  };

  const handleRepair = () => {
    if (!fixtures.length) return;
    const result = repairFixtures();
    if (result.ok) {
      setRepairNotice(
        result.changed && result.changed > 0
          ? `Repaired fixtures: adjusted ${result.changed} match(es).`
          : "Fixtures already valid. No changes needed."
      );
    } else {
      setRepairNotice(`Repair failed: ${result.reason}.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleGenerate} disabled={teams.length < 2} className="btn-primary">
          <Calendar size={16} /> Generate Fixtures
        </button>
        <button onClick={handleRepair} disabled={fixtures.length === 0} className="btn-ghost">
          <Wrench size={16} /> Repair Fixtures
        </button>
      </div>

      {repairNotice && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          repairNotice.startsWith("Repair failed")
            ? "bg-danger/10 text-danger"
            : repairNotice.includes("No changes") || repairNotice.startsWith("Need")
            ? "bg-muted/10 text-muted"
            : "bg-brand/10 text-brand"
        }`}>
          {repairNotice.startsWith("Repair failed") ? <AlertCircle size={16} /> :
           repairNotice.includes("No changes") || repairNotice.startsWith("Need") ? <Info size={16} /> : <CheckCircle size={16} />}
          {repairNotice}
        </div>
      )}

      <MatchEditor />
    </div>
  );
}

function DatabaseManager() {
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const fixtures = useAppStore((s) => s.fixtures);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string | null>>({});
  const [teamIdMap, setTeamIdMap] = useState<Record<string, number> | null>(null);

  const syncTeams = async () => {
    setSyncing("teams");
    setResults((r) => ({ ...r, teams: null }));
    try {
      const res = await fetch("/api/sync/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams }),
      });
      const data = await res.json();
      if (data.error) {
        setResults((r) => ({ ...r, teams: data.error }));
      } else {
        const store = useAppStore.getState();
        store.setTeams(data.teams);

        const curPlayers = store.players;
        const remappedPlayers = curPlayers.map((p) => ({
          ...p,
          teamId: data.idMap[p.teamId] ?? p.teamId,
        }));
        store.setPlayers(remappedPlayers);

        const curFixtures = store.fixtures;
        const remappedFixtures = curFixtures.map((r) => ({
          ...r,
          matches: r.matches.map((m) => ({
            ...m,
            homeId: data.idMap[m.homeId] ?? m.homeId,
            awayId: data.idMap[m.awayId] ?? m.awayId,
          })),
        }));
        store.setFixtures(remappedFixtures);

        setTeamIdMap(data.idMap);
        setResults((r) => ({ ...r, teams: `Synced ${data.teams?.length || 0} teams.` }));
      }
    } catch {
      setResults((r) => ({ ...r, teams: "Sync failed." }));
    } finally {
      setSyncing(null);
    }
  };

  const syncPlayers = async () => {
    setSyncing("players");
    setResults((r) => ({ ...r, players: null }));
    try {
      const res = await fetch("/api/sync/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players, teamIdMap }),
      });
      const data = await res.json();
      if (data.error) {
        setResults((r) => ({ ...r, players: data.error }));
      } else {
        setResults((r) => ({ ...r, players: `Synced ${data.players?.length || 0} players.` }));
      }
    } catch {
      setResults((r) => ({ ...r, players: "Sync failed." }));
    } finally {
      setSyncing(null);
    }
  };

  const syncFixtures = async () => {
    setSyncing("fixtures");
    setResults((r) => ({ ...r, fixtures: null }));
    try {
      const res = await fetch("/api/sync/fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtures, teamIdMap }),
      });
      const data = await res.json();
      if (data.error) {
        setResults((r) => ({ ...r, fixtures: data.error }));
      } else {
        setResults((r) => ({ ...r, fixtures: `Synced ${data.fixtures?.length || 0} matches.` }));
      }
    } catch {
      setResults((r) => ({ ...r, fixtures: "Sync failed." }));
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Sync to Database</h3>
        <p className="text-sm text-muted mb-4">
          Upload your current in-app data to the Supabase database.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Teams</h4>
            <p className="text-xs text-muted">{teams.length} teams ready</p>
            {results.teams && (
              <p className={`text-xs mt-1 ${results.teams.startsWith("Synced") ? "text-brand" : "text-danger"}`}>
                {results.teams}
              </p>
            )}
          </div>
          <button onClick={syncTeams} disabled={syncing !== null} className="btn-primary text-sm">
            {syncing === "teams" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {syncing === "teams" ? " Syncing..." : " Sync"}
          </button>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Players</h4>
            <p className="text-xs text-muted">{players.length} players ready</p>
            {results.players && (
              <p className={`text-xs mt-1 ${results.players.startsWith("Synced") ? "text-brand" : "text-danger"}`}>
                {results.players}
              </p>
            )}
          </div>
          <button onClick={syncPlayers} disabled={syncing !== null} className="btn-primary text-sm">
            {syncing === "players" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {syncing === "players" ? " Syncing..." : " Sync"}
          </button>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Fixtures</h4>
            <p className="text-xs text-muted">{fixtures.length} rounds ready</p>
            {results.fixtures && (
              <p className={`text-xs mt-1 ${results.fixtures.startsWith("Synced") ? "text-brand" : "text-danger"}`}>
                {results.fixtures}
              </p>
            )}
          </div>
          <button onClick={syncFixtures} disabled={syncing !== null} className="btn-primary text-sm">
            {syncing === "fixtures" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {syncing === "fixtures" ? " Syncing..." : " Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TeamAccountRow {
  id: string;
  username: string;
  display_name: string;
  team_id: number | null;
  role: string;
  created_at: string;
  teams: { name: string } | null;
}

function TeamAccountManager() {
  const teams = useAppStore((s) => s.teams);
  const [accounts, setAccounts] = useState<TeamAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{
    username?: string;
    password?: string;
    error?: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/team-accounts");
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts || []);
      } else {
        setError(data.error || "Failed to load team accounts.");
      }
    } catch {
      setError("Failed to load team accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreateResult(null);

    if (!selectedTeam || !password) return;
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    setCreating(true);
    try {
      const team = teams.find((t) => t.id === Number(selectedTeam));
      const res = await fetch("/api/admin/create-team-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: team?.name || "",
          password,
          teamId: Number(selectedTeam),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCreateResult({
          username: data.account.username,
          password,
        });
        setPassword("");
        setSelectedTeam("");
        fetchAccounts();
      }
    } catch {
      setError("Failed to create account.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Team Accounts</h3>
        <p className="text-sm text-muted">
          Create login credentials for team coaches and captains.
        </p>
      </div>

      <div className="card p-5">
        <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Create New Account
        </h4>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {createResult ? (
          <div className="space-y-3">
            <div className="bg-brand/10 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-brand">Account Created!</p>
              <p>
                <span className="font-medium">Username:</span>{" "}
                <code className="bg-bg px-2 py-0.5 rounded text-brand font-mono">
                  {createResult.username}
                </code>
              </p>
              <p>
                <span className="font-medium">Password:</span>{" "}
                <code className="bg-bg px-2 py-0.5 rounded text-brand font-mono">
                  {createResult.password}
                </code>
              </p>
            </div>
            <p className="text-xs text-muted">
              This is the only time the password is shown. Share these
              credentials with the team.
            </p>
            <button
              onClick={() => setCreateResult(null)}
              className="btn-primary text-sm"
            >
              Create Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select a team...</option>
                  {teams
                    .filter(
                      (t) =>
                        !accounts.some((a) => a.team_id === t.id)
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  {teams.every((t) =>
                    accounts.some((a) => a.team_id === t.id)
                  ) && <option disabled>All teams have accounts</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input w-full pr-10"
                    placeholder="Min 12 characters"
                    minLength={12}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={creating || !selectedTeam || !password}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <KeyRound size={16} /> Create Account
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Existing Accounts ({accounts.length})
        </h4>

        {accounts.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No team accounts created yet.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="card px-4 py-3 flex items-center gap-3"
              >
                <Shield size={16} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.username}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {a.teams?.name || "No team"} &middot;{" "}
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-muted capitalize">{a.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("fixtures");

  const adminTabs: { key: AdminTab; label: string; icon: typeof Shield }[] = [
    { key: "fixtures", label: "Fixtures & Scores", icon: Calendar },
    { key: "teams", label: "Teams", icon: Users },
    { key: "players", label: "Players", icon: UserCog },
    { key: "accounts", label: "Team Accounts", icon: KeyRound },
    { key: "database", label: "Database", icon: Database },
    { key: "import", label: "Import Data", icon: FileDown },
  ];

  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-muted">Full league management</p>
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 mb-6 w-fit overflow-x-auto">
        {adminTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === t.key ? "bg-surface shadow-sm text-text" : "text-muted hover:text-text"
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "teams" && <TeamForm />}
      {tab === "players" && <PlayerManager />}
      {tab === "fixtures" && <FixtureManager />}
      {tab === "accounts" && <TeamAccountManager />}
      {tab === "database" && <DatabaseManager />}
      {tab === "import" && <DataImporter />}
    </div>
  );
}
