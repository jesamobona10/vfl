"use client";

import { StandingsTable } from "@/components/standings/standings-table";

export default function OrgStandingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Standings</h1>
        <p className="text-sm text-muted">League table and positions</p>
      </div>
      <StandingsTable />
    </div>
  );
}
