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
import { Users, X, Plus, AlertCircle, UserRound, ChevronDown, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/shared/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

export default function CompPlayersPage() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
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
  const [search, setSearch] = useState("");

  const { data: openTeamPlayers = [] } = useSeasonTeamPlayers(seasonId || undefined, openTeamId || undefined);
  const registerMutation = useRegisterSeasonPlayers(seasonId || "", registerOpenTeamId || "");
  const deleteMutation = useDeleteSeasonPlayer(seasonId || "", openTeamId || "");

  useEffect(() => {
    if (!currentOrg?.id) return;
    fetch(`/api/players?org_id=${currentOrg.id}`)
      .then((r) => r.json())
      .then((d) => setOrgPlayers(Array.isArray(d.players) ? d.players : d.players || []))
      .catch(() => {});
  }, [currentOrg?.id]);

  const registeredPlayerIds = useMemo(() => new Set(openTeamPlayers.map((p: any) => p.player_id)), [openTeamPlayers]);
  const openTeam = useMemo(() => seasonTeams.find((st: any) => st.id === openTeamId), [seasonTeams, openTeamId]);
  const openTeamRealId = openTeam?.team_id ?? openTeam?.team?.id;

  const availableForTeam = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgPlayers
      .filter((p: any) => {
        const pid = p.teamId ?? p.team_id ?? p.team?.id;
        if (openTeamRealId && pid !== openTeamRealId) return false;
        if (registeredPlayerIds.has(p.id)) return false;
        if (!q) return true;
        return p.name?.toLowerCase().includes(q) || String(p.number).includes(q);
      })
      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [orgPlayers, openTeamRealId, registeredPlayerIds, search]);

  const playerCountsByTeam = useMemo(() => {
    const counts = new Map<string, number>();
    for (const registration of seasonPlayers) {
      counts.set(registration.season_team_id, (counts.get(registration.season_team_id) || 0) + 1);
    }
    return counts;
  }, [seasonPlayers]);

  const totalRegistered = seasonPlayers.length;

  if (isLoading) {
    return (
      <div className="card rounded-2xl">
        <SkeletonList items={4} />
      </div>
    );
  }

  if (!seasonId) {
    return (
      <EmptyState
        icon={Users}
        title="Select a season"
        description="Choose a season from the top bar to manage registered players."
      />
    );
  }

  if (seasonTeams.length === 0) {
    return (
      <div className="card rounded-2xl">
        <EmptyState
          icon={Users}
          title="No teams registered yet"
          description="Register teams for this season first, then come back to add players."
          action={
            <Link
              href={`/org/${slug}/competitions/${cId}/teams?seasonId=${seasonId}`}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Register teams
            </Link>
          }
        />
      </div>
    );
  }

  const handleTogglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRegister = (playerIds: number[]) => {
    setError("");
    if (playerIds.length === 0 || !registerOpenTeamId) return;
    registerMutation.mutate(
      { playerIds },
      {
        onSuccess: () => {
          setRegisterOpenTeamId(null);
          setSelectedPlayerIds([]);
          setSearch("");
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to register players"),
      }
    );
  };

  const handleDelete = async (registrationId: string) => {
    setError("");
    if (!(await confirm({ title: "Remove this player from the season roster?", confirmLabel: "Remove" })))
      return;
    deleteMutation.mutate(registrationId, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to remove player"),
    });
  };

  const initials = (name?: string) =>
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  return (
    <div className="space-y-6">
      {confirmDialog}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            Season roster
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Season players</h1>
          <p className="mt-1 text-sm text-muted">
            Register eligible players to teams for this competition season.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted">
            <Users size={14} className="text-brand-600" />
            <span className="font-medium text-text">{totalRegistered}</span> registered across{" "}
            <span className="font-medium text-text">{seasonTeams.length}</span> teams
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <section className="grid gap-3 sm:gap-4">
        {seasonTeams.map((st: any) => {
          const isOpen = openTeamId === st.id;
          const isRegisterOpen = registerOpenTeamId === st.id;
          const count = playerCountsByTeam.get(st.id) || 0;
          const teamName = st.display_name || st.team?.name || "Team";
          const logo = st.team?.logo_url || st.logo_url;

          return (
            <div
              key={st.id}
              className={cn(
                "card overflow-hidden rounded-2xl transition-all",
                isOpen || isRegisterOpen ? "border-brand/40 shadow-sm" : "hover:border-brand/30"
              )}
            >
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <button
                  onClick={() => {
                    setOpenTeamId(isOpen ? null : st.id);
                    setRegisterOpenTeamId(null);
                    setSelectedPlayerIds([]);
                    setSearch("");
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {logo ? (
                    <img src={logo} alt="" className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700">
                      {initials(teamName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text">{teamName}</p>
                    <p className="text-sm text-muted">
                      {count} {count === 1 ? "player" : "players"} registered
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "ml-auto shrink-0 text-muted transition-transform sm:ml-4",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <button
                  onClick={() => {
                    setRegisterOpenTeamId(isRegisterOpen ? null : st.id);
                    setOpenTeamId(null);
                    setSelectedPlayerIds([]);
                    setSearch("");
                  }}
                  className="btn-primary btn-sm self-start sm:self-auto"
                >
                  <Plus size={14} />
                  Add players
                </button>
              </div>

              {(isOpen || isRegisterOpen) && (
                <div className="border-t border-line bg-surface-2/30">
                  {isRegisterOpen && (
                    <div className="space-y-4 p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-text">Select players from the roster</p>
                          <p className="text-sm text-muted">
                            Only players assigned to this team in the organization appear here.
                          </p>
                        </div>
                        <div className="relative w-full sm:w-72">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                          <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search available players..."
                            className="input pl-9"
                          />
                        </div>
                      </div>
                      {availableForTeam.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                          {search
                            ? "No players match your search."
                            : "All eligible players for this team are already registered."}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {availableForTeam.map((player: any) => {
                            const selected = selectedPlayerIds.includes(player.id);
                            return (
                              <button
                                key={player.id}
                                type="button"
                                onClick={() => handleTogglePlayer(player.id)}
                                className={cn(
                                  "flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                                  selected
                                    ? "border-brand bg-brand-50/60 shadow-sm"
                                    : "border-line bg-surface hover:border-brand/40"
                                )}
                              >
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-bold text-white">
                                  {initials(player.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-text">{player.name}</p>
                                  <p className="text-xs text-muted">
                                    #{player.number || "—"} • {player.position || "—"}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    selected ? "bg-brand" : "bg-surface-2"
                                  )}
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted">
                          {selectedPlayerIds.length} {selectedPlayerIds.length === 1 ? "player" : "players"} selected
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setRegisterOpenTeamId(null);
                              setSelectedPlayerIds([]);
                              setSearch("");
                            }}
                            className="btn-ghost btn-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRegister(selectedPlayerIds)}
                            disabled={selectedPlayerIds.length === 0 || registerMutation.isPending}
                            className="btn-primary btn-sm"
                          >
                            {registerMutation.isPending ? "Registering..." : "Register selected"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isOpen && (
                    <div className="p-4 sm:p-5">
                      {openTeamPlayers.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-6 text-center">
                          <UserRound size={18} className="text-muted" />
                          <p className="text-sm font-medium text-text">No players registered yet</p>
                          <p className="text-sm text-muted">Add players to build this team&rsquo;s season roster.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-line/70 rounded-xl border border-line bg-surface">
                          {openTeamPlayers.map((entry: any) => (
                            <div
                              key={entry.id}
                              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-bold text-white">
                                  {initials(entry.player?.name)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-text">
                                    {entry.player?.name || "Unknown player"}
                                  </p>
                                  <p className="text-xs text-muted">
                                    #{entry.jersey_number || entry.player?.number || "—"} •{" "}
                                    {entry.position || entry.player?.position || "—"}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deleteMutation.isPending}
                                className="btn-ghost btn-sm self-start text-danger hover:bg-danger/10 sm:self-auto"
                              >
                                <X size={14} />
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
