import { StandingsTable } from "@/components/standings/standings-table";

export default function OrgStandingsPage() {
  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold">League Standings</h1>
        <p className="text-sm text-muted">Live table</p>
      </div>
      <StandingsTable />
    </div>
  );
}
