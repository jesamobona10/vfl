"use client";

import { useRouter } from "next/navigation";
import { Users, CalendarPlus } from "lucide-react";
import { useOrgSeason } from "@/components/competitions/org-season-provider";

interface SeasonEmptyStateProps {
  hasTeams?: boolean;
  sheetHref: string;
  fixturesHref: string;
}

/**
 * Professional empty state shown when the selected org season has no data yet.
 * Uses the shared org-season context so the season name stays accurate.
 */
export function SeasonEmptyState({
  hasTeams = false,
  sheetHref,
  fixturesHref,
}: SeasonEmptyStateProps) {
  const router = useRouter();
  const { selectedSeasonName, loading } = useOrgSeason();

  if (loading) return null;

  const seasonLabel = selectedSeasonName || "this season";

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          {hasTeams ? (
            <CalendarPlus size={22} className="text-brand" />
          ) : (
            <Users size={22} className="text-brand" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold">
            {hasTeams
              ? `${seasonLabel} has teams but no fixtures yet`
              : `${seasonLabel} doesn't have any data yet`}
          </h3>
          <p className="text-sm text-ink-2 mt-0.5">
            {hasTeams
              ? "Generate fixtures to get the league table, upcoming matches, and statistics up and running."
              : "Register teams and generate fixtures to start building the season."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!hasTeams && (
            <button
              onClick={() => router.push(sheetHref)}
              className="btn-ghost text-sm"
            >
              <Users size={14} /> Register teams
            </button>
          )}
          <button
            onClick={() => router.push(fixturesHref)}
            className="btn-primary text-sm"
          >
            <CalendarPlus size={14} /> Generate fixtures
          </button>
        </div>
      </div>
    </div>
  );
}