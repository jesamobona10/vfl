"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useSeasonTeams,
  useSeasonTeamPlayers,
  useRegisterSeasonPlayers,
  useDeleteSeasonPlayer,
} from "@/lib/hooks/use-competitions";
import { Users, X, Plus, AlertCircle } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";

export default function CompPlayersPage() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const seasonId = searchParams.get("seasonId");

  const { data: currentOrg } = useOrg(slug);
  const { data: seasonTeams = [], isLoading } = useSeasonTeams(seasonId || undefined);

  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [orgPlayers, setOrgPlayers] = useState<any[]>([]);
  const [registerOpenTeamId, setRegisterOpenTeamId] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);

  const { data: openTeamPlayers = [] } = useSeasonTeamPlayers(
    seasonId || undefined,
    openTeamId || undefined
  );
  const registerMutation = useRegisterSeasonPlayers(seasonId || "", registerOpenTeamId || "");
  const deleteMutation = useDeleteSeasonPlayer(seasonId || "", openTeamId || "");

  useEffect(() => {
    if (!currentOrg?.id) return;
    fetch(`/api/players?org_id=${currentOrg.id}`)
      .then((r) => r.json())
      .then((d) => setOrgPlayers(Array.isArray(d.players) ? d.players : d.players || []))
      .catch(() => {});
  }, [currentOrg?.id]);

  const registeredPlayerIds = useMemo(
    () => new Set(openTeamPlayers.map((p: any) => p.player_id)),
    [openTeamPlayers]
  );
  const availableForTeam = orgPlayers.filter((p) => !registeredPlayerIds.has(p.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  if (!seasonId) {
    return (
      <div className="card p-8 text-center text-muted">Select a season to view its players.</div>
    );
  }

  if (seasonTeams.length === 0) {
    return (
      <div className="text-center py-16">
        <Users size={48} className="mx-auto text-ink-3/40 mb-4" />
        <p className="text-ink-2">
          No teams registered yet. Register teams in the Teams tab first.
        </p>
      </div>
    );
  }

  const handleTogglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleRegister = () => {
    setError("");
    if (selectedPlayerIds.length === 0 || !registerOpenTeamId) return;
    registerMutation.mutate(
      { playerIds: selectedPlayerIds },
      {
        onSuccess: () => {
          setRegisterOpenTeamId(null);
          setSelectedPlayerIds([]);
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Failed to register players"),
      }
    );
  };

  const handleDelete = async (registrationId: string) => {
    setError("");
    if (
      !(await confirm({
        title: "Remove this player from the season roster?",
        confirmLabel: "Remove",
      }))
    )
      return;
    deleteMutation.mutate(registrationId, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to remove player"),
    });
  };

  return (
    <div className="space-y-5">
      {confirmDialog}
      <div>
        <h2 className="text-lg font-semibold">Players</h2>
        <p className="text-sm text-muted">Season-scoped player registrations</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="space-y-4">
        {seasonTeams.map((st: any) => {
          const isOpen = openTeamId === st.id;
          const isRegisterOpen = registerOpenTeamId === st.id;
          return (
            <div key={st.id} className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 gap-3">
                <button
                  onClick={() => {
                    setOpenTeamId(isOpen ? null : st.id);
                    setRegisterOpenTeamId(null);
                    setSelectedPlayerIds([]);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                >
                  {st.team?.logo_url || st.logo_url ? (
                    <img
                      src={st.team?.logo_url || st.logo_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-sm text-muted">
                      {(st.display_name || st.team?.name || "?").charAt(0)}
                    </div>
                  )}
                  <span className="font-medium truncate">{st.display_name || st.team?.name}</span>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted">
                    {isOpen ? openTeamPlayers.length : "—"} players
                  </span>
                  <button
                    onClick={() => {
                      setRegisterOpenTeamId(isRegisterOpen ? null : st.id);
                      setSelectedPlayerIds([]);
                      setOpenTeamId(isRegisterOpen ? null : st.id);
                    }}
                    className="btn-ghost text-xs"
                    disabled={registerMutation.isPending}
                  >
                    {isRegisterOpen ? <X size={14} /> : <Plus size={14} />}
                    {isRegisterOpen ? "Cancel" : "Register"}
                  </button>
                </div>
              </div>

              {isRegisterOpen && (
                <div className="border-t border-line p-4 space-y-3">
                  <h3 className="text-sm font-medium">
                    Register players from {st.display_name || st.team?.name}
                  </h3>
                  {availableForTeam.length === 0 ? (
                    <p className="text-sm text-muted">No unregistered players available.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {availableForTeam.map((p) => (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            selectedPlayerIds.includes(p.id)
                              ? "border-brand/60 bg-brand-50/50"
                              : "border-line hover:border-brand/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPlayerIds.includes(p.id)}
                            onChange={() => handleTogglePlayer(p.id)}
                            className="accent-brand"
                          />
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          <span className="text-xs text-muted ml-auto">{p.position || "—"}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedPlayerIds.length > 0 && (
                    <button
                      onClick={handleRegister}
                      disabled={registerMutation.isPending}
                      className="btn-primary flex items-center gap-2 text-sm"
                    >
                      <Plus size={16} />
                      Register {selectedPlayerIds.length} player
                      {selectedPlayerIds.length !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              )}

              {isOpen && !isRegisterOpen && (
                <div className="border-t border-line p-4">
                  {openTeamPlayers.length === 0 ? (
                    <p className="text-sm text-muted">
                      No players registered for this team this season.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {openTeamPlayers.map((reg: any) => (
                        <div
                          key={reg.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-surface-2"
                        >
                          <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-sm font-medium shrink-0">
                            {(reg.player?.name || "?").charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{reg.player?.name}</p>
                            <p className="text-xs text-muted">
                              {reg.position || reg.player?.position || "—"}
                              {reg.jersey_number ? ` · #${reg.jersey_number}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(reg.id)}
                            disabled={deleteMutation.isPending}
                            className="text-danger hover:opacity-70 transition-opacity shrink-0"
                            title="Remove from season roster"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
