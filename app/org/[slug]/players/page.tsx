"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { PlayerCard } from "@/components/players/player-card";
import { PlayerModal } from "@/components/players/player-modal";
import { PlayerImportModal } from "@/components/players/player-import-modal";
import { Plus, AlertCircle, Upload } from "lucide-react";
import { EmptyState } from "@/components/shared/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { Player } from "@/lib/types";

export default function OrgPlayersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: currentOrg } = useOrg(slug);
  const players = useAppStore((s) => s.players);
  const teams = useAppStore((s) => s.teams);
  const teamName = useAppStore((s) => s.teamName);
  const deletePlayer = useAppStore((s) => s.deletePlayer);
  const setPlayers = useAppStore((s) => s.setPlayers);
  const setTeams = useAppStore((s) => s.setTeams);
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState("");

  const handleImported = async () => {
    if (!currentOrg?.id) return;
    try {
      const [teamsRes, playersRes] = await Promise.all([
        fetch(`/api/teams?org_id=${currentOrg.id}`),
        fetch(`/api/players?org_id=${currentOrg.id}`),
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
      // Non-fatal; the store refreshes on next visit.
    }
  };

  const handleEdit = (player: Player) => {
    setModalPlayer(player);
    setAddModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const p = players.find((pl) => pl.id === id);
    if (!p) return;
    if (
      !(await confirm({
        title: `Delete player "${p.name}"?`,
        description: "This cannot be undone.",
      }))
    )
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

  const grouped = teams
    .map((team) => ({
      team,
      players: players.filter((p) => p.teamId === team.id),
    }))
    .filter((g) => g.players.length > 0);

  return (
    <div className="space-y-5">
      {confirmDialog}
      <div className="page-head">
        <div>
          <p className="page-title">Players</p>
          <p className="page-sub">
            {players.length} player{players.length !== 1 ? "s" : ""} across {grouped.length} team
            {grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-ghost">
            <Upload size={16} />
            Import CSV
          </button>
          <button onClick={() => setAddModalOpen(true)} className="btn-primary">
            <Plus size={16} />
            Add Player
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3 mb-4">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No players yet"
            description="Register players to see them grouped by team here."
          />
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ team, players: teamPlayers }) => (
            <div key={team.id}>
              <div className="flex items-center gap-3 mb-3">
                {team.logo_url ? (
                  <img src={team.logo_url} alt="" className="w-8 h-8 rounded-full object-cover" width={32} height={32} loading="lazy" decoding="async" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs text-muted">
                    {team.name.charAt(0)}
                  </div>
                )}
                <h2 className="text-lg font-semibold">{team.name}</h2>
                <span className="text-xs text-muted">
                  {teamPlayers.length} player{teamPlayers.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {teamPlayers.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    teamName={teamName(p.teamId)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
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

      {importOpen && (
        <PlayerImportModal
          slug={slug}
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
        />
      )}
    </div>
  );
}
