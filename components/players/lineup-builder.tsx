"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { LineupSlot, TeamLineup } from "@/lib/types";

const formationSlotDefinitions: Record<
  string,
  Array<{ slotId: string; label: string; position: LineupSlot["position"] }>
> = {
  "4-3-3": [
    { slotId: "gk", label: "GK", position: "GK" },
    { slotId: "def1", label: "LB", position: "DEF" },
    { slotId: "def2", label: "LCB", position: "DEF" },
    { slotId: "def3", label: "RCB", position: "DEF" },
    { slotId: "def4", label: "RB", position: "DEF" },
    { slotId: "mid1", label: "CM", position: "MID" },
    { slotId: "mid2", label: "LCM", position: "MID" },
    { slotId: "mid3", label: "RCM", position: "MID" },
    { slotId: "att1", label: "LW", position: "ATT" },
    { slotId: "att2", label: "ST", position: "ATT" },
    { slotId: "att3", label: "RW", position: "ATT" },
  ],
  "4-4-2": [
    { slotId: "gk", label: "GK", position: "GK" },
    { slotId: "def1", label: "LB", position: "DEF" },
    { slotId: "def2", label: "LCB", position: "DEF" },
    { slotId: "def3", label: "RCB", position: "DEF" },
    { slotId: "def4", label: "RB", position: "DEF" },
    { slotId: "mid1", label: "LM", position: "MID" },
    { slotId: "mid2", label: "LCM", position: "MID" },
    { slotId: "mid3", label: "RCM", position: "MID" },
    { slotId: "mid4", label: "RM", position: "MID" },
    { slotId: "att1", label: "ST1", position: "ATT" },
    { slotId: "att2", label: "ST2", position: "ATT" },
  ],
  "3-5-2": [
    { slotId: "gk", label: "GK", position: "GK" },
    { slotId: "def1", label: "LCB", position: "DEF" },
    { slotId: "def2", label: "CB", position: "DEF" },
    { slotId: "def3", label: "RCB", position: "DEF" },
    { slotId: "mid1", label: "LM", position: "MID" },
    { slotId: "mid2", label: "LCM", position: "MID" },
    { slotId: "mid3", label: "CM", position: "MID" },
    { slotId: "mid4", label: "RCM", position: "MID" },
    { slotId: "mid5", label: "RM", position: "MID" },
    { slotId: "att1", label: "ST1", position: "ATT" },
    { slotId: "att2", label: "ST2", position: "ATT" },
  ],
};

const formations = ["4-3-3", "4-4-2", "3-5-2"];

function createSlots(formation: string): LineupSlot[] {
  return formationSlotDefinitions[formation].map((slot) => ({
    ...slot,
    playerId: null,
  }));
}

export function LineupBuilder() {
  const teams = useAppStore((state) => state.teams);
  const players = useAppStore((state) => state.players);
  const isTeamAccount = useAppStore((state) => state.isTeamAccount());
  const managedTeamId = useAppStore((state) => state.getManagedTeamId());

  const [selectedTeamId, setSelectedTeamId] = useState<number | "">(
    isTeamAccount ? managedTeamId ?? "" : ""
  );
  const [lineups, setLineups] = useState<TeamLineup[]>([]);
  const [selectedLineupId, setSelectedLineupId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [formation, setFormation] = useState<typeof formations[number]>("4-3-3");
  const [slots, setSlots] = useState<LineupSlot[]>(createSlots("4-3-3"));
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isTeamAccount && managedTeamId) {
      setSelectedTeamId(managedTeamId);
    }
  }, [isTeamAccount, managedTeamId]);

  useEffect(() => {
    if (selectedTeamId === "") {
      setLineups([]);
      setSelectedLineupId(null);
      return;
    }

    fetchLineups(selectedTeamId);
  }, [selectedTeamId]);

  const availablePlayers = useMemo(
    () => players.filter((player) => player.teamId === selectedTeamId),
    [players, selectedTeamId]
  );

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  function resetBuilder() {
    setSelectedLineupId(null);
    setName("");
    setFormation("4-3-3");
    setSlots(createSlots("4-3-3"));
    setIsActive(false);
    setError(null);
    setStatus(null);
  }

  function setSlotPlayer(slotId: string, playerId: number | null) {
    setSlots((current) =>
      current.map((slot) =>
        slot.slotId === slotId ? { ...slot, playerId } : slot
      )
    );
  }

  async function fetchLineups(teamId: number | "") {
    if (teamId === "") return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/lineups`);
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Unable to load lineups.");
        setLineups([]);
        return;
      }

      setLineups(data.lineups || []);
    } catch (err) {
      setError("Unable to load lineups.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setError(null);
    setStatus(null);

    if (!selectedTeamId) {
      setError("Select a team first.");
      return;
    }

    if (!name.trim()) {
      setError("Enter a lineup name.");
      return;
    }

    const body = {
      name: name.trim(),
      formation,
      slots,
      is_active: isActive,
    };

    setLoading(true);

    try {
      const method = selectedLineupId ? "PUT" : "POST";
      const endpoint = selectedLineupId
        ? `/api/teams/${selectedTeamId}/lineups/${selectedLineupId}`
        : `/api/teams/${selectedTeamId}/lineups`;

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Unable to save lineup.");
        return;
      }

      setStatus(selectedLineupId ? "Lineup updated." : "Lineup saved.");
      setSelectedLineupId(data.lineup.id);
      fetchLineups(selectedTeamId);
    } catch (err) {
      setError("Unable to save lineup.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedTeamId || !selectedLineupId) {
      return;
    }

    if (!confirm("Delete this lineup?")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/teams/${selectedTeamId}/lineups/${selectedLineupId}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Unable to delete lineup.");
        return;
      }

      resetBuilder();
      fetchLineups(selectedTeamId);
      setStatus("Lineup deleted.");
    } catch (err) {
      setError("Unable to delete lineup.");
    } finally {
      setLoading(false);
    }
  }

  function handleLoadLineup(id: number) {
    const lineup = lineups.find((item) => item.id === id);

    if (!lineup) {
      return;
    }

    setSelectedLineupId(lineup.id);
    setName(lineup.name);
    setFormation(lineup.formation);
    setSlots(lineup.slots);
    setIsActive(lineup.isActive);
    setError(null);
    setStatus(null);
  }

  function handleFormationChange(value: typeof formations[number]) {
    setFormation(value);
    setSlots(createSlots(value));
    setSelectedLineupId(null);
    setName("");
    setIsActive(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Lineup details</h2>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Team
            </label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
              value={selectedTeamId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTeamId(value === "" ? "" : Number(value));
                resetBuilder();
              }}
              disabled={isTeamAccount}
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium text-slate-700">
              Lineup name
            </label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter a lineup name"
            />
            <label className="block text-sm font-medium text-slate-700">
              Formation
            </label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
              value={formation}
              onChange={(event) => handleFormationChange(event.target.value as any)}
            >
              {formations.map((formationOption) => (
                <option key={formationOption} value={formationOption}>
                  {formationOption}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3">
              <input
                id="active-lineup"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
              />
              <label htmlFor="active-lineup" className="text-sm text-slate-700">
                Set as active lineup
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || !selectedTeamId}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {selectedLineupId ? "Update lineup" : "Save lineup"}
            </button>
            <button
              type="button"
              onClick={resetBuilder}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-400"
            >
              New lineup
            </button>
            {selectedLineupId ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:cursor-not-allowed"
              >
                Delete lineup
              </button>
            ) : null}
          </div>
          <div className="space-y-2 pt-3 text-sm">
            {error ? (
              <p className="text-red-600">{error}</p>
            ) : status ? (
              <p className="text-slate-700">{status}</p>
            ) : null}
            {isTeamAccount && !managedTeamId ? (
              <p className="text-sm text-orange-600">
                No managed team found for this account.
              </p>
            ) : null}
            {selectedTeam && (
              <p className="text-sm text-slate-600">
                Building lineup for <strong>{selectedTeam.name}</strong>.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Saved lineups</h2>
          <div className="space-y-4">
            <div>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                value={selectedLineupId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "") {
                    resetBuilder();
                    return;
                  }
                  handleLoadLineup(Number(value));
                }}
              >
                <option value="">Choose saved lineup</option>
                {lineups.map((lineup) => (
                  <option key={lineup.id} value={lineup.id}>
                    {lineup.name} {lineup.isActive ? "(active)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">Available players</p>
              <p>{availablePlayers.length} players in selected team.</p>
              <p>
                Assign players by their primary position and save the lineup to keep it
                across refresh.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Formation builder</h2>
          <div className="grid gap-3">
            {slots.map((slot) => (
              <div key={slot.slotId} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
                    <p className="text-xs text-slate-600">{slot.position}</p>
                  </div>
                  <p className="text-xs uppercase text-slate-500">{slot.slotId}</p>
                </div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                  value={slot.playerId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSlotPlayer(slot.slotId, value === "" ? null : Number(value));
                  }}
                >
                  <option value="">Unassigned</option>
                  {availablePlayers
                    .filter((player) => player.position === slot.position)
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} #{player.number}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Lineup preview</h2>
          <div className="space-y-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold">Selected team</p>
            <p>{selectedTeam ? selectedTeam.name : "No team selected."}</p>
            <p className="font-semibold">Formation</p>
            <p>{formation}</p>
            <p className="font-semibold">Assigned players</p>
            <ul className="space-y-2">
              {slots.map((slot) => {
                const player = availablePlayers.find((item) => item.id === slot.playerId);
                return (
                  <li key={slot.slotId} className="rounded-md bg-white px-3 py-2 shadow-sm">
                    <span className="font-semibold">{slot.label}</span>: {player ? `${player.name} #${player.number}` : "Unassigned"}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
