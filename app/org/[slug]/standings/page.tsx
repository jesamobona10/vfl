"use client";

import { StandingsTable } from "@/components/standings/standings-table";

export default function OrgStandingsPage() {
  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-title">Standings</p>
          <p className="page-sub">League table and positions</p>
        </div>
      </div>
      <StandingsTable />
    </div>
  );
}
