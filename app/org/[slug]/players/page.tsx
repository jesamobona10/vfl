"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useCan } from "@/lib/hooks/use-can";
import { useOrg } from "@/lib/hooks/use-org";
import { PlayerRow } from "@/components/players/player-row";
import { AnonymizeConfirm } from "@/components/players/anonymize-confirm";
import { SeasonEmptyState } from "@/components/dashboard/season-empty-state";
import { useOrgSeason } from "@/components/competitions/org-season-provider";
import {
  Plus,
  AlertCircle,
  Upload,
  BarChart3,
  Users,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
} from "lucide-react";
import { EmptyState } from "@/components/shared/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";

const PlayerModal = dynamic(
  () => import("@/components/players/player-modal").then((m) => m.PlayerModal),
  { ssr: false, loading: () => null }
);

const PlayerImportModal = dynamic(
  () => import("@/components/players/player-import-modal").then((m) => m.PlayerImportModal),
  { ssr: false, loading: () => null }
);

const POSITIONS = [
  { value: "all", label: "All positions" },
  { value: "GK", label: "Goalkeepers" },
  { value: "DEF", label: "Defenders" },
  { value: "MID", label: "Midfielders" },
  { value: "ATT", label: "Attackers" },
] as const;

export default function OrgPlayersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: currentOrg } = useOrg(slug);
  const players = useAppStore((s) => s.players);
  const teams = useAppStore((s) => s.teams);
  const teamName = useAppStore((s) => s.teamName);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount)();
  const managedTeamId = useAppStore((s) => s.getManagedTeamId)();
  const { allowed: canManagePlayers } = useCan("players.manage");
  const { selectedOrgSeasonId, loading: seasonLoading, hasTeams, isOrgAdmin: ctxIsOrgAdmin } =
    useOrgSeason();
  const deletePlayer = useAppStore((s) => s.deletePlayer);
  const setPlayers = useAppStore((s) => s.setPlayers);
  const setTeams = useAppStore((s) => s.setTeams);
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [anonymizePlayer, setAnonymizePlayer] = useState<Player | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"players" | "statistics">("players");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "grid">("list");

  const handleImported = async () => {
    if (!currentOrg?.id) return;
    try {
      const [teamsRes, playersRes] = await Promise.all([
        fetch(
          `/api/teams?org_id=${currentOrg.id}${selectedOrgSeasonId ? `&org_season_id=${selectedOrgSeasonId}` : ""}`
        ),
        fetch(
          `/api/players?org_id=${currentOrg.id}${selectedOrgSeasonId ? `&org_season_id=${selectedOrgSeasonId}` : ""}`
        ),
      ]);
      if (teamsRes.ok) {
        const t = await teamsRes.json();
        setTeams(t.teams || []);
      }
      if (playersRes.ok) {
        const p = await playersRes.json();
        setPlayers(p.players || []);
      }
    } catch {
      // Non-fatal
    }
  };

  const handleEdit = (player: Player) => {
    setModalPlayer(player);
    setAddModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const p = players.find((pl) => pl.id === id);
    if (!p) return;
    if (!(await confirm({ title: `Delete player "${p.name}"?`, description: "This cannot be undone." })))
      return;
    setError("");
    try {
      const res = await fetch(`/api/players/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        return;
      }
      deletePlayer(id);
    } catch {
      setError("Failed to delete player. Please try again.");
    }
  };

  const handleAnonymize = (player: Player) => {
    setAnonymizePlayer(player);
  };

  const handleAnonymizeConfirm = async () => {
    if (!anonymizePlayer || !currentOrg?.id) return;
    setError("");
    try {
      const res = await fetch(`/api/players/${anonymizePlayer.id}/anonymize`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to anonymize player.");
        return;
      }
      const [teamsRes, playersRes] = await Promise.all([
        fetch(
          `/api/teams?org_id=${currentOrg.id}${selectedOrgSeasonId ? `&org_season_id=${selectedOrgSeasonId}` : ""}`
        ),
        fetch(
          `/api/players?org_id=${currentOrg.id}${selectedOrgSeasonId ? `&org_season_id=${selectedOrgSeasonId}` : ""}`
        ),
      ]);
      if (teamsRes.ok) setTeams((await teamsRes.json()).teams || []);
      if (playersRes.ok) setPlayers((await playersRes.json()).players || []);
      setAnonymizePlayer(null);
    } catch {
      setError("Unable to anonymize player. Please try again.");
    }
  };

  const handleAnonymizeCancel = () => setAnonymizePlayer(null);

  const basePlayers = useMemo(() => {
    const list = isTeamAccount && managedTeamId ? players.filter((p) => p.teamId === managedTeamId) : players;
    return list;
  }, [isTeamAccount, managedTeamId, players]);

  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const availableTeams = useMemo(() => {
    const ids = new Set(basePlayers.map((p) => p.teamId));
    return teams.filter((t) => ids.has(t.id));
  }, [basePlayers, teams]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return basePlayers
      .filter((p) => {
        if (position !== "all" && p.position !== position) return false;
        if (teamFilter !== "all" && String(p.teamId) !== teamFilter) return false;
        if (!q) return true;
        return p.name.toLowerCase().includes(q) || String(p.number).includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [basePlayers, position, teamFilter, search]);

  const statsSummary = useMemo(
    () => [
      { label: "Players", value: basePlayers.length },
      { label: "Teams", value: availableTeams.length },
      { label: "Goals", value: basePlayers.reduce((sum, p) => sum + (p.goals || 0), 0) },
      { label: "Assists", value: basePlayers.reduce((sum, p) => sum + (p.assists || 0), 0) },
    ],
    [availableTeams.length, basePlayers]
  );

  return (
    <div className="space-y-6">
      {confirmDialog}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Players</h1>
          <p className="mt-1 text-sm text-muted">
            Manage rosters, track stats, and keep player data up to date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-ghost">
            <Upload size={16} />
            Import CSV
          </button>
          {canManagePlayers && (
            <button
              onClick={() => {
                setModalPlayer(null);
                setAddModalOpen(true);
              }}
              className="btn-primary"
            >
              <Plus size={16} />
              Add player
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statsSummary.map((item) => (
          <div key={item.label} className="card flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{item.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-text sm:text-2xl">
                {item.value}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Users size={16} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players or numbers..."
              className="input pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-surface-2/70 p-1">
            <SlidersHorizontal size={14} className="ml-2 mr-1 text-muted" />
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="bg-transparent py-1.5 pl-1 pr-7 text-sm text-text focus:outline-none"
              aria-label="Filter by position"
            >
              {POSITIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!isTeamAccount && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="border-l border-line bg-transparent py-1.5 pl-3 pr-7 text-sm text-text focus:outline-none"
                aria-label="Filter by team"
              >
                <option value="all">All teams</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="inline-flex rounded-xl bg-surface-2/70 p-1" role="tablist" aria-label="Player view">
            <button
              type="button"
              onClick={() => setActiveTab("players")}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                activeTab === "players"
                  ? "bg-surface text-text shadow-sm"
                  : "text-muted hover:text-text"
              )}
            >
              <Users size={15} />
              Players
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("statistics")}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                activeTab === "statistics"
                  ? "bg-surface text-text shadow-sm"
                  : "text-muted hover:text-text"
              )}
            >
              <BarChart3 size={15} />
              Statistics
            </button>
          </div>
          <div className="inline-flex rounded-xl bg-surface-2/70 p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                view === "list" ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
              )}
              aria-label="List view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                view === "grid" ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
              )}
              aria-label="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {ctxIsOrgAdmin && selectedOrgSeasonId && !seasonLoading && !hasTeams && (
        <SeasonEmptyState
          hasTeams={false}
          sheetHref={`/org/${slug}/teams`}
          fixturesHref={`/org/${slug}/competitions`}
        />
      )}

      {activeTab === "statistics" ? (
        <section className="card overflow-hidden rounded-2xl">
          <header className="flex flex-col gap-1 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-text">Player statistics</h2>
              <p className="text-sm text-muted">Season performance across all recorded events</p>
            </div>
          </header>
          {filteredPlayers.length === 0 ? (
            <EmptyState
              title="No statistics to show"
              description="Players will appear here once they have match activity."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-2/40 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 sm:px-6">Player</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-3 py-3 text-center">Pos</th>
                    <th className="px-3 py-3 text-center">G</th>
                    <th className="px-3 py-3 text-center">A</th>
                    <th className="px-3 py-3 text-center">YC</th>
                    <th className="px-3 py-3 text-center">RC</th>
                    <th className="px-3 py-3 text-center">SV</th>
                    <th className="px-3 py-3 text-center">CS</th>
                    <th className="px-4 py-3 text-center sm:px-6">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {[...filteredPlayers]
                    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.rating - a.rating)
                    .map((player) => {
                      const team = teamMap[player.teamId];
                      return (
                        <tr key={player.id} className="transition-colors hover:bg-surface-2/40">
                          <td className="px-4 py-3 sm:px-6">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-bold text-white">
                                {player.name
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-text">{player.name}</p>
                                <p className="text-xs text-muted">#{player.number || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted">{team?.name || teamName(player.teamId)}</td>
                          <td className="px-3 py-3 text-center text-muted">{player.position}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{player.goals}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{player.assists}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{player.yellowCards}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{player.redCards}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{player.saves}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{player.cleanSheets}</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums sm:px-6">
                            {player.rating.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : filteredPlayers.length === 0 ? (
        <EmptyState
          title={basePlayers.length === 0 ? "No players yet" : "No players match your filters"}
          description={
            basePlayers.length === 0
              ? canManagePlayers
                ? "Add your first player or import a CSV to build your roster."
                : "No players have been added to this organization yet."
              : "Try adjusting your search or filters."
          }
          action={
            basePlayers.length === 0 && canManagePlayers ? (
              <button
                onClick={() => {
                  setModalPlayer(null);
                  setAddModalOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} />
                Add player
              </button>
            ) : undefined
          }
        />
      ) : view === "list" ? (
        <section className="space-y-2">
          {filteredPlayers.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              teamName={teamName(player.teamId)}
              teamLogo={teamMap[player.teamId]?.logo_url}
              onEdit={canManagePlayers ? handleEdit : undefined}
              onDelete={canManagePlayers ? handleDelete : undefined}
              onAnonymize={canManagePlayers ? handleAnonymize : undefined}
            />
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredPlayers.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              teamName={teamName(player.teamId)}
              teamLogo={teamMap[player.teamId]?.logo_url}
              onEdit={canManagePlayers ? handleEdit : undefined}
              onDelete={canManagePlayers ? handleDelete : undefined}
              onAnonymize={canManagePlayers ? handleAnonymize : undefined}
            />
          ))}
        </section>
      )}

      {addModalOpen && (
        <PlayerModal
          player={modalPlayer}
          onClose={() => {
            setAddModalOpen(false);
            setModalPlayer(null);
          }}
        />
      )}
      {importOpen && <PlayerImportModal slug={slug} onClose={() => setImportOpen(false)} onImported={handleImported} />}
      <AnonymizeConfirm
        playerName={anonymizePlayer?.name ?? ""}
        onConfirm={handleAnonymizeConfirm}
        onCancel={handleAnonymizeCancel}
        isOpen={anonymizePlayer !== null}
      />
    </div>
  );
}
