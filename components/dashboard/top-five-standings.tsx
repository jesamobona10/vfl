"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { calculateStandings } from "@/lib/logic/standings";
import { ArrowUpRight, Crown } from "lucide-react";
import Image from "next/image";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

type Row = ReturnType<typeof calculateStandings>[number];

export function TopFiveStandings() {
  const params = useParams();
  const slug = params.slug as string;
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const fixtures = useAppStore((s) => s.fixtures);

  const topFive = calculateStandings(teams, fixtures).slice(0, 5);

  if (!topFive.length) return null;

  const crest = (team: Row) => {
    const t = teams.find((tt) => tt.id === team.id);
    return t?.logo_url ? (
      <Image
        src={t.logo_url}
        alt=""
        width={20}
        height={20}
        className="w-5 h-5 rounded-full object-cover shrink-0"
      />
    ) : (
      <span className="w-5 h-5 rounded-full bg-surface-2 inline-block shrink-0" />
    );
  };

  const columns: DataTableColumn<Row>[] = [
    { key: "pos", header: "#", className: "text-left w-10 text-ink-3", render: (_r, i) => i + 1 },
    {
      key: "team",
      header: "Team",
      className: "text-left font-medium",
      render: (team) => (
        <span className="flex items-center gap-2 min-w-0">
          {crest(team)}
          <span className="truncate">{team.name}</span>
        </span>
      ),
    },
    { key: "p", header: "P", className: "text-center w-12", render: (r) => r.played },
    {
      key: "gd",
      header: "GD",
      className: "text-center w-12",
      render: (r) => (r.gd > 0 ? `+${r.gd}` : r.gd),
    },
    { key: "pts", header: "Pts", className: "text-right font-bold w-14", render: (r) => r.points },
  ];

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Standings</span>
        <Link href={`/org/${slug}/standings`} className="panel-link">
          Full table <ArrowUpRight size={12} />
        </Link>
      </div>

      <DataTable
        rows={topFive}
        columns={columns}
        rowKey={(team) => String(team.id)}
        mobileCard={(team, index) => (
          <div className="card px-3 py-2.5 flex items-center gap-2 text-[12.5px]">
            <span className="w-5 text-ink-3 shrink-0">{index + 1}</span>
            <span className="flex items-center gap-2 min-w-0 flex-1 font-medium">
              {crest(team)}
              <span className="truncate">{team.name}</span>
              {index === 0 && <Crown size={13} className="fill-gold-500 text-gold-500 shrink-0" />}
            </span>
            <span className="text-ink-2 shrink-0 w-8 text-center">{team.played}P</span>
            <span className="text-ink-2 shrink-0 w-10 text-center">
              {team.gd > 0 ? `+${team.gd}` : team.gd}
            </span>
            <span className="font-bold shrink-0 w-8 text-right">{team.points}</span>
          </div>
        )}
      />
    </div>
  );
}
