"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { TeamForm } from "../teams/team-form";
import { DataImporter } from "./data-importer";
import { DashboardOverview } from "./dashboard-overview";
import { OrgManager } from "./org-manager";
import { AdminTeamManager } from "./team-manager";
import { AdminPlayerManager } from "./player-manager";
import { CompManager } from "./comp-manager";
import { AuditViewer } from "./audit-viewer";
import { UsersManager } from "./users-manager";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock3,
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
  Building2,
  LayoutDashboard,
  Trophy,
  ScrollText,
} from "lucide-react";
import type { Team, Player } from "@/lib/types";
import { GeneratePlayerCredentials } from "@/components/players/generate-player-credentials";

type AdminTab = "dashboard" | "orgs" | "teams" | "players" | "competitions" | "fixtures" | "users" | "audit" | "database" | "import";

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
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-xs font-bold text-white shrink-0">
                {p.name.charAt(0).toUpperCase()}
              </div>
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
  const [data, setData] = useState<{
    organizations: Array<{
      id: string;
      name: string;
      slug: string;
      logo_url?: string;
      rounds: Array<{
        round: number;
        byeId: number | null;
        matches: Array<{
          id: number;
          round: number;
          homeId: number;
          awayId: number;
          homeScore: number | null;
          awayScore: number | null;
          status: string;
          date: string;
          time: string;
          venue: string;
          events: Array<{ type: string; playerId: number; minute: number | null; teamId: number }>;
          homeTeamName: string;
          awayTeamName: string;
          homeTeamLogo?: string;
          awayTeamLogo?: string;
        }>;
      }>;
    }>;
  } | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/fixtures")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load fixtures."))
      .finally(() => setLoading(false));
  }, []);

  const statusLabel: Record<string, string> = {
    scheduled: "Scheduled",
    "in-progress": "In Progress",
    live: "Live",
    completed: "Completed",
  };

  const statusTone: Record<string, string> = {
    scheduled: "bg-surface-2 text-muted",
    "in-progress": "bg-accent/10 text-accent",
    live: "bg-brand/10 text-brand",
    completed: "bg-muted/10 text-muted",
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted" /></div>;

  if (error) return <p className="text-sm text-danger text-center py-8">{error}</p>;

  if (!data?.organizations?.length) {
    return (
      <div className="card p-8 text-center text-muted">
        <Calendar size={32} className="mx-auto mb-2" />
        <p>No fixtures have been generated yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Viewing all fixtures across the platform (read-only).</p>
      {data.organizations.map((org) => (
        <div key={org.id} className="card overflow-hidden">
          <button
            onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-2/50 transition-colors text-left"
          >
            {expandedOrg === org.id ? (
              <ChevronDown size={16} className="shrink-0 text-muted" />
            ) : (
              <ChevronRight size={16} className="shrink-0 text-muted" />
            )}
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
            ) : (
              <Building2 size={18} className="text-muted shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold">{org.name}</span>
              <span className="text-xs text-muted ml-2">
                {org.rounds.length} round{org.rounds.length !== 1 ? "s" : ""}
              </span>
            </div>
          </button>

          {expandedOrg === org.id && (
            <div className="border-t border-line px-5 py-4 space-y-5">
              {org.rounds.map((round) => (
                <div key={round.round}>
                  <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
                    Round {round.round}
                    {round.byeId != null && (
                      <span className="ml-2 text-xs text-muted font-normal">
                        (bye: {round.matches.find((m) => m.homeId === round.byeId)?.homeTeamName || round.matches.find((m) => m.awayId === round.byeId)?.awayTeamName || `Team ${round.byeId}`})
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {round.matches.map((match) => (
                      <div key={match.id} className="card overflow-hidden">
                        <button
                          onClick={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors text-left"
                        >
                          {expandedMatch === match.id ? (
                            <ChevronDown size={14} className="shrink-0 text-muted" />
                          ) : (
                            <ChevronRight size={14} className="shrink-0 text-muted" />
                          )}
                          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <div className="flex items-center gap-2 justify-end">
                              {match.homeTeamLogo && <img src={match.homeTeamLogo} alt="" className="w-5 h-5 rounded object-cover" />}
                              <span className="text-sm font-semibold truncate">{match.homeTeamName}</span>
                            </div>
                            <span className="text-base font-bold text-center tabular-nums">
                              {match.homeScore != null ? match.homeScore : "-"} – {match.awayScore != null ? match.awayScore : "-"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold truncate">{match.awayTeamName}</span>
                              {match.awayTeamLogo && <img src={match.awayTeamLogo} alt="" className="w-5 h-5 rounded object-cover" />}
                            </div>
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${statusTone[match.status]}`}>
                            {statusLabel[match.status] || match.status}
                          </span>
                        </button>

                        {expandedMatch === match.id && (
                          <div className="border-t border-line px-4 py-3 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                              <div><span className="text-xs text-muted block">Date</span><span>{match.date || "Not set"}</span></div>
                              <div><span className="text-xs text-muted block">Time</span><span>{match.time || "Not set"}</span></div>
                              <div><span className="text-xs text-muted block">Venue</span><span>{match.venue || "Not set"}</span></div>
                              <div><span className="text-xs text-muted block">Status</span><span className="capitalize">{match.status}</span></div>
                            </div>
                            {match.events.length > 0 && (
                              <div>
                                <h5 className="text-xs text-muted uppercase tracking-wider mb-1 font-semibold">Events ({match.events.length})</h5>
                                <div className="flex flex-wrap gap-1">
                                  {match.events.map((event, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                                      <span className="font-mono font-bold text-[10px] uppercase">{event.type.slice(0, 3).toUpperCase()}</span>
                                      <span>#{event.playerId}</span>
                                      {event.minute != null && <span className="text-muted">{event.minute}&apos;</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
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
  const [tab, setTab] = useState<AdminTab>("dashboard");

  const adminTabs: { key: AdminTab; label: string; icon: typeof Shield }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "orgs", label: "Organizations", icon: Building2 },
    { key: "teams", label: "Teams", icon: Users },
    { key: "players", label: "Players", icon: UserCog },
    { key: "competitions", label: "Competitions", icon: Trophy },
    { key: "fixtures", label: "Fixtures", icon: Calendar },
    { key: "users", label: "Users", icon: KeyRound },
    { key: "audit", label: "Audit", icon: ScrollText },
    { key: "database", label: "Database", icon: Database },
    { key: "import", label: "Import", icon: FileDown },
  ];

  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-muted">Full system management</p>
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 mb-6 overflow-x-auto">
        {adminTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === t.key ? "bg-brand-dark text-white" : "text-muted hover:text-text"
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && <DashboardOverview />}
      {tab === "orgs" && <OrgManager />}
      {tab === "teams" && <AdminTeamManager />}
      {tab === "players" && <AdminPlayerManager />}
      {tab === "competitions" && <CompManager />}
      {tab === "fixtures" && <FixtureManager />}
      {tab === "users" && <UsersManager />}
      {tab === "audit" && <AuditViewer />}
      {tab === "database" && <DatabaseManager />}
      {tab === "import" && <DataImporter />}
    </div>
  );
}
