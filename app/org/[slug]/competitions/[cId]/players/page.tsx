"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useSeasonTeams,
  useSeasonPlayers,
  useSeasonTeamPlayers,
  useRegisterSeasonPlayers,
  useDeleteSeasonPlayer,
} from "@/lib/hooks/use-competitions";
import { Users, X, Plus, AlertCircle, UserRound, ChevronDown } from "lucide-react";
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
  const { data: seasonPlayers = [], isLoading: isLoadingPlayerCounts } = useSeasonPlayers(
    seasonId || undefined
  );

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
  const openTeam = useMemo(
    () => seasonTeams.find((st: any) => st.id === openTeamId),
    [seasonTeams, openTeamId]
  );
  const openTeamRealId = openTeam?.team_id ?? openTeam?.team?.id;
  const availableForTeam = useMemo(
    () =>
      orgPlayers.filter((p: any) => {
        const pid = p.teamId ?? p.team_id ?? p.team?.id;
        if (openTeamRealId && pid !== openTeamRealId) return false;
        if (registeredPlayerIds.has(p.id)) return false;
        return true;
      }),
    [orgPlayers, openTeamRealId, registeredPlayerIds]
  );
  const playerCountsByTeam = useMemo(() => {
    const counts = new Map<string, number>();
    for (const registration of seasonPlayers) {
      counts.set(registration.season_team_id, (counts.get(registration.season_team_id) || 0) + 1);
    }
    return counts;
  }, [seasonPlayers]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  if (!seasonId) {
    return (
      <div className="card rounded-2xl p-8 text-center text-muted">Select a season to view its players.</div>
    );
  }

  if (seasonTeams.length === 0) {
    return (
      <div className="card p-8 sm:p-12 text-center">
        <Users size={48} className="mx-auto text-ink-3/40 mb-4" />
        <h2 className="text-lg font-semibold mb-1">No teams registered yet</h2>
        <p className="text-sm text-muted mb-6">
          Register teams for this season first, then come back to add players.
        </p>
        <Link
          href={`/org/${slug}/competitions/${params.cId}/teams?seasonId=${seasonId}`}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} />
          Register Teams
        </Link>
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
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Season roster</p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Players</h2>
          <p className="mt-1 text-sm text-muted">Manage the players registered to each team this season.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
          <Users size={14} /> {seasonTeams.length} teams
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid gap-3 sm:gap-4">
        {seasonTeams.map((st: any) => {
          const isOpen = openTeamId === st.id;
          const isRegisterOpen = registerOpenTeamId === st.id;
          return (
            <div key={st.id} className={`card overflow-hidden rounded-2xl transition-colors ${isOpen || isRegisterOpen ? "border-brand-600/30" : "hover:border-brand-600/20"}`}>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <button
                  onClick={() => {
                    setOpenTeamId(isOpen ? null : st.id);
                    setRegisterOpenTeamId(null);
                    setSelectedPlayerIds([]);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-80"
                >
                  {st.team?.logo_url || st.logo_url ? (
                    <img
                      src={st.team?.logo_url || st.logo_url}
                      alt=""
                      className="h-11 w-11 rounded-xl border border-line bg-surface object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700">
                      {(st.display_name || st.team?.name || "?").charAt(0)}
                    </div>
                  )}
                  <span className="truncate font-semibold">{st.display_name || st.team?.name}</span>
                  <ChevronDown size={16} className={`ml-auto shrink-0 text-ink-3 transition-transform sm:ml-0 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                    <UserRound size={13} /> {isLoadingPlayerCounts ? "…" : (playerCountsByTeam.get(st.id) || 0)} players
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
                    <p className="text-sm text-muted">
                      No unregistered players in this team&apos;s roster.
                    </p>
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
