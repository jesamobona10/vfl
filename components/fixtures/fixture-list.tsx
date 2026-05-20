"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { FixtureFilters } from "./fixture-filters";
import { FixtureCreator } from "./fixture-creator";
import { FixtureRoundPanel } from "./fixture-round";
import { RefreshCw, Calendar } from "lucide-react";

export function FixtureList() {
  const [roundFilter, setRoundFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fixtures = useAppStore((s) => s.fixtures);
  const teams = useAppStore((s) => s.teams);
  const generateFixtures = useAppStore((s) => s.generateFixtures);
  const reorderMatch = useAppStore((s) => s.reorderMatch);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const managedId = useAppStore((s) => s.getManagedTeamId)();

  const effectiveTeamFilter = isTeamAccount() ? String(managedId) : teamFilter;
  const captureRef = useRef<HTMLDivElement>(null);

  const handleDrop = (matchId: number, targetId: number) => {
    const round = fixtures.find((r) =>
      r.matches.some((m) => m.id === matchId)
    );
    if (round) {
      reorderMatch(round.round, matchId, targetId);
    }
  };

  const fixturesExist = fixtures.length > 0;
  const allMatches = fixtures.flatMap((round) => round.matches);
  const statusCounts = allMatches.reduce(
    (acc, match) => {
      acc[match.status] = (acc[match.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const visibleRoundPanels = fixtures
    .filter(
      (r) =>
        roundFilter === "all" || String(r.round) === roundFilter
    )
    .map((r) => (
      <FixtureRoundPanel
        key={r.round}
        round={r}
        teamFilter={effectiveTeamFilter}
        statusFilter={statusFilter}
        onDrop={isAdmin ? handleDrop : () => {}}
      />
    ));

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fixtures</h1>
          <p className="text-sm text-muted">
            Calendar and Team Views
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => generateFixtures(teams)}
              disabled={teams.length < 2}
              className="btn-primary"
            >
              <RefreshCw size={16} />
              Generate Fixtures
            </button>
          )}
        </div>
      </div>

      {fixturesExist && (
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <div className="card p-4 border border-line bg-surface">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Rounds
            </p>
            <p className="text-2xl font-semibold">{fixtures.length}</p>
          </div>
          <div className="card p-4 border border-line bg-surface">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Matches
            </p>
            <p className="text-2xl font-semibold">{allMatches.length}</p>
          </div>
          <div className="card p-4 border border-line bg-surface">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Live / In progress
            </p>
            <p className="text-2xl font-semibold">
              {(statusCounts.live ?? 0) + (statusCounts["in-progress"] ?? 0)}
            </p>
          </div>
          <div className="card p-4 border border-line bg-surface">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Completed
            </p>
            <p className="text-2xl font-semibold">{statusCounts.completed ?? 0}</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <FixtureFilters
            roundFilter={roundFilter}
            teamFilter={teamFilter}
            statusFilter={statusFilter}
            onRoundChange={setRoundFilter}
            onTeamChange={setTeamFilter}
            onStatusChange={setStatusFilter}
            captureRef={captureRef}
          />
        </div>
      )}

      {isAdmin && (
        <div className="mb-6">
          <FixtureCreator />
        </div>
      )}

      <div ref={captureRef} className="space-y-4">
        {!fixturesExist ? (
          <div className="text-center py-16">
            <Calendar
              size={48}
              className="mx-auto text-muted/30 mb-4"
            />
            <p className="text-muted">
              No fixtures yet. Click &ldquo;Generate Fixtures&rdquo;
              above or add one manually.
            </p>
          </div>
        ) : (
          visibleRoundPanels
        )}
      </div>
    </div>
  );
}
