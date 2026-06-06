"use client";

import { useOrg } from "@/lib/hooks/use-org";
import { useCompetitions } from "@/lib/hooks/use-competitions";
import type { Competition } from "@/lib/types";
import { useParams } from "next/navigation";
import { Trophy, Plus, Loader2, Swords, Users } from "lucide-react";

const typeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  league: { label: "League", icon: <Trophy size={16} /> },
  cup: { label: "Cup", icon: <Swords size={16} /> },
  friendly: { label: "Friendly", icon: <Users size={16} /> },
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-300",
  active: "bg-green-500/20 text-green-400",
  completed: "bg-blue-500/20 text-blue-400",
};

export default function CompetitionsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);
  const { data: competitions = [], isLoading } = useCompetitions(currentOrg?.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competitions</h1>
          <p className="text-sm text-muted">Manage leagues, cups and friendlies</p>
        </div>
        {competitions.length > 0 && (
          <a href={`/org/${slug}/competitions/new`} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Create Competition
          </a>
        )}
      </div>

      {competitions.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy size={48} className="mx-auto text-muted/30 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No competitions yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">
            Create your first competition to get started — a league, cup, or friendly match.
          </p>
          <a href={`/org/${slug}/competitions/new`} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Create Competition
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((comp: Competition) => {
            const cfg = typeConfig[comp.type] ?? typeConfig.league;
            return (
              <a
                key={comp.id}
                href={`/org/${slug}/competitions/${comp.id}`}
                className="card p-4 hover:border-brand/50 transition-colors block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 text-muted">
                    {cfg.icon}
                    <span className="text-xs uppercase tracking-wider">{cfg.label}</span>
                  </div>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[comp.status] ?? statusColors.draft}`}
                  >
                    {comp.status}
                  </span>
                </div>
                <h3 className="font-semibold text-base mb-1">{comp.name}</h3>
                {comp.season && (
                  <p className="text-xs text-muted">Season: {comp.season}</p>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
