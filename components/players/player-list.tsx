"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { PlayerCard } from "./player-card";
import { PlayerModal } from "./player-modal";
import { CsvImport } from "./csv-import";
import type { Player } from "@/lib/types";
import { Plus, Trash2, Users, Download } from "lucide-react";

export function PlayerList() {
  const [teamFilter, setTeamFilter] = useState("all");
  const [posFilter, setPosFilter] = useState("all");
  const [modalPlayer, setModalPlayer] = useState<Player | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  const players = useAppStore((s) => s.players);
  const teams = useAppStore((s) => s.teams);
  const teamName = useAppStore((s) => s.teamName);
  const deletePlayer = useAppStore((s) => s.deletePlayer);
  const deleteAllPlayers = useAppStore((s) => s.deleteAllPlayers);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const getManagedTeamId = useAppStore((s) => s.getManagedTeamId);

  const managedId = getManagedTeamId();

  const filtered = players.filter((p) => {
    if (managedId && p.teamId !== managedId) return false;
    if (
      !managedId &&
      teamFilter !== "all" &&
      p.teamId !== Number(teamFilter)
    )
      return false;
    if (posFilter !== "all" && p.position !== posFilter)
      return false;
    return true;
  });

  const openAdd = () => {
    setModalPlayer(null);
    setModalOpen(true);
  };

  const openEdit = (player: Player) => {
    setModalPlayer(player);
    setModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this player?")) {
      deletePlayer(id);
    }
  };

  const handleDeleteAll = () => {
    if (
      players.length > 0 &&
      confirm(
        `Delete all ${players.length} player(s)? This cannot be undone.`
      )
    ) {
      deleteAllPlayers();
    }
  };

  const handleDownload = () => {
    const csv = [
      ["Name", "Position", "Number", "Team", "Goals", "Assists", "Yellow Cards", "Red Cards", "Saves", "Clean Sheets", "MOTM", "Rating"].join(","),
      ...filtered.map((p) =>
        [
          `"${p.name}"`,
          p.position,
          p.number,
          `"${teamName(p.teamId)}"`,
          p.goals,
          p.assists,
          p.yellowCards,
          p.redCards,
          p.saves,
          p.cleanSheets,
          p.motm,
          p.rating,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "players-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} />
            Add Player
          </button>
          <CsvImport />
          <button onClick={handleDownload} className="btn-ghost">
            <Download size={16} />
            Download
          </button>
          <button onClick={handleDeleteAll} className="btn-ghost text-danger">
            <Trash2 size={16} />
            Delete All
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {!managedId && (
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
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
        )}
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className="input w-auto min-w-[140px]"
          aria-label="Filter by position"
        >
          <option value="all">All Positions</option>
          <option value="GK">Goalkeeper</option>
          <option value="DEF">Defender</option>
          <option value="MID">Midfielder</option>
          <option value="ATT">Attacker</option>
        </select>

        <span className="text-sm text-muted">
          {filtered.length} player{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users
            size={48}
            className="mx-auto text-muted/30 mb-4"
          />
          <p className="text-muted">
            {players.length === 0
              ? "No players yet. Add one or import from CSV."
              : "No players match the selected filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              teamName={teamName(p.teamId)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <PlayerModal
          player={modalPlayer}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
