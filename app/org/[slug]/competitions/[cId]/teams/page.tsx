"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useSeasonTeams,
  useCreateSeasonTeams,
  useDeleteSeasonTeam,
} from "@/lib/hooks/use-competitions";
import { Plus, X, AlertCircle } from "lucide-react";
import { PageSkeleton, EmptyState } from "@/components/shared/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";

export default function CompTeamsPage() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const seasonId = searchParams.get("seasonId");

  const { data: currentOrg } = useOrg(slug);
  const { data: seasonTeams = [], isLoading } = useSeasonTeams(seasonId || undefined);
  const createMutation = useCreateSeasonTeams(seasonId || "");
  const deleteMutation = useDeleteSeasonTeam(seasonId || "");

  const [orgTeams, setOrgTeams] = useState<any[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentOrg?.id) return;
    fetch(`/api/teams?org_id=${currentOrg.id}`)
      .then((r) => r.json())
      .then((d) => setOrgTeams(d.teams || []))
      .catch(() => {});
  }, [currentOrg?.id]);

  const registeredIds = useMemo(
    () => new Set(seasonTeams.map((st: any) => st.team_id)),
    [seasonTeams]
  );

  const unregistered = orgTeams.filter((t) => !registeredIds.has(t.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  if (!seasonId) {
    return (
      <div className="card p-8 text-center text-muted">Select a season to view its teams.</div>
    );
  }

  const handleToggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRegister = () => {
    setError("");
    if (selectedIds.length === 0) return;
    createMutation.mutate(
      { teamIds: selectedIds },
      {
        onSuccess: () => {
          setRegisterOpen(false);
          setSelectedIds([]);
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to register teams"),
      }
    );
  };

  const handleUnregister = async (seasonTeam: any) => {
    setError("");
    const name = seasonTeam.display_name || seasonTeam.team?.name || "this team";
    if (
      !(await confirm({
        title: `Unregister ${name}?`,
        description: "The team will be removed from this season.",
        confirmLabel: "Unregister",
      }))
    )
      return;
    deleteMutation.mutate(seasonTeam.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to unregister team"),
    });
  };

  return (
    <div className="space-y-5">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Teams</h2>
          <p className="text-sm text-muted">
            {seasonTeams.length} team{seasonTeams.length !== 1 ? "s" : ""} registered this season
          </p>
        </div>
        {unregistered.length > 0 && (
          <button
            onClick={() => setRegisterOpen(!registerOpen)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {registerOpen ? <X size={16} /> : <Plus size={16} />}
            {registerOpen ? "Cancel" : "Register Teams"}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {registerOpen && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold">Register teams to this season</h3>
          {unregistered.length === 0 ? (
            <p className="text-sm text-muted">All organization teams are already registered.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unregistered.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.includes(t.id)
                      ? "border-brand/60 bg-brand-50/50"
                      : "border-line hover:border-brand/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => handleToggle(t.id)}
                    className="accent-brand"
                  />
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" width={28} height={28} loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-xs text-muted">
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium">{t.name}</span>
                </label>
              ))}
            </div>
          )}
          {selectedIds.length > 0 && (
            <button
              onClick={handleRegister}
              disabled={createMutation.isPending}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Register {selectedIds.length} team{selectedIds.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {seasonTeams.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No teams registered yet"
            description="Register teams for this season to build fixtures and standings."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {seasonTeams.map((st: any) => (
            <div key={st.id} className="card p-4 flex items-start justify-between gap-3 group">
              <div className="flex items-center gap-3 min-w-0">
                {st.team?.logo_url || st.logo_url ? (
                  <img
                    src={st.team?.logo_url || st.logo_url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                    width={36}
                    height={36}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-surface-2 flex items-center justify-center text-sm text-muted shrink-0">
                    {(st.display_name || st.team?.name || "?").charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">{st.display_name || st.team?.name}</p>
                  <p className="text-xs text-muted">
                    Registered {new Date(st.registered_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleUnregister(st)}
                disabled={deleteMutation.isPending}
                className="text-danger opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity shrink-0"
                title="Unregister team"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
