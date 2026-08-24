"use client";

import { useOrg } from "@/lib/hooks/use-org";
import { useCompetitions } from "@/lib/hooks/use-competitions";
import { useQueryClient } from "@tanstack/react-query";
import type { Competition } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { Trophy, Plus, Swords, Users, Trash2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { PageSkeleton } from "@/components/shared/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast";

const typeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  league: { label: "League", icon: <Trophy size={16} /> },
  cup: { label: "Cup", icon: <Swords size={16} /> },
  friendly: { label: "Friendly", icon: <Users size={16} /> },
};

const statusColors: Record<string, string> = {
  draft: "bg-surface-2 text-ink-3",
  active: "bg-live-tint text-live-500",
  completed: "bg-brand-50 text-brand-700",
  archived: "bg-muted/20 text-muted",
};

export default function CompetitionsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const { data: currentOrg } = useOrg(slug);
  const { data: competitions = [], isLoading } = useCompetitions(currentOrg?.id);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleDelete = async (comp: Competition) => {
    if (
      !(await confirm({
        title: `Delete "${comp.name}"?`,
        description: "All its fixtures, cup matches, and seasons will also be deleted. This cannot be undone.",
      }))
    )
      return;
    setError("");
    setDeletingId(comp.id);
    try {
      const res = await fetch(`/api/competitions/${comp.id}`, { method: "DELETE" });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        return;
      }
      toast.success(`Competition "${comp.name}" deleted.`);
      queryClient.invalidateQueries({ queryKey: ["competitions", currentOrg?.id] });
      if (window.location.pathname.includes(comp.id)) router.replace(`/org/${slug}/competitions`);
    } catch {
      setError("Failed to delete competition. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {confirmDialog}
      <div className="page-head">
        <div>
          <p className="page-title">Competitions</p>
          <p className="page-sub">Manage leagues, cups and friendlies</p>
        </div>
        {competitions.length > 0 && (
          <a href={`/org/${slug}/competitions/new`} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Create Competition
          </a>
        )}
      </div>

      {competitions.length === 0 ? (
        <div className="panel p-12 text-center">
          <Trophy size={48} className="mx-auto text-ink-3/40 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No competitions yet</h2>
          <p className="text-sm text-ink-2 max-w-md mx-auto mb-6">
            Create your first competition to get started — a league, cup, or friendly match.
          </p>
          <a
            href={`/org/${slug}/competitions/new`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Create Competition
          </a>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {competitions.map((comp: Competition) => {
              const cfg = typeConfig[comp.type] ?? typeConfig.league;
              return (
                <div key={comp.id} className="relative group">
                  <a
                    href={`/org/${slug}/competitions/${comp.id}`}
                    className="card p-4 hover:border-brand/50 transition-colors block"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 text-ink-2">
                        {cfg.icon}
                        <span className="text-xs uppercase tracking-wider">{cfg.label}</span>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[comp.status] ?? statusColors.draft}`}
                      >
                        {comp.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base mb-1">{comp.name}</h3>
                    {(() => {
                      const joined = (comp as any).seasons;
                      const currentSeason = Array.isArray(joined) ? joined[0] : joined;
                      return currentSeason ? (
                        <p className="text-xs text-ink-2">Season: {currentSeason.name}</p>
                      ) : null;
                    })()}
                  </a>
                  <button
                    onClick={() => handleDelete(comp)}
                    disabled={deletingId === comp.id}
                    className="btn-icon absolute top-2 right-2 text-danger opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                    title="Delete competition"
                  >
                    {deletingId === comp.id ? (
                      <span className="block w-3 h-3 bg-surface-2 rounded animate-pulse" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
