"use client";

import { useParams, useRouter } from "next/navigation";
import { Trophy, Swords, Users, Plus, ArrowRight } from "lucide-react";

interface CompetitionCardItem {
  id: string;
  name: string;
  type: string;
  status: string;
}

export function CompetitionsCard({
  competitions,
  emptyHref,
}: {
  competitions: CompetitionCardItem[];
  emptyHref?: string;
}) {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) || "";
  const createHref = emptyHref ?? `/org/${slug}/competitions/new`;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Competitions</h2>
        <button
          onClick={() => router.push(`/org/${slug}/competitions`)}
          className="btn-ghost text-sm"
        >
          View all <ArrowRight size={14} />
        </button>
      </div>
      {competitions.length === 0 ? (
        <div className="text-center py-6">
          <Trophy size={32} className="mx-auto text-ink-3/40 mb-2" />
          <p className="text-sm text-ink-2 mb-3">No competitions yet</p>
          <button onClick={() => router.push(createHref)} className="btn-ghost text-sm">
            <Plus size={14} /> Create Competition
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.slice(0, 6).map((comp) => (
            <button
              key={comp.id}
              onClick={() => router.push(`/org/${slug}/competitions/${comp.id}`)}
              className="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-brand hover:bg-brand/5 transition-colors text-left"
            >
              {comp.type === "league" ? (
                <Trophy size={18} className="text-brand" />
              ) : comp.type === "cup" ? (
                <Swords size={18} className="text-brand" />
              ) : (
                <Users size={18} className="text-brand" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{comp.name}</p>
                <p className="text-xs text-ink-2 capitalize">{comp.status}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
