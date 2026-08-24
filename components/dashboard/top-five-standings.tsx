"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { calculateStandings } from "@/lib/logic/standings";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

export function TopFiveStandings() {
  const params = useParams();
  const slug = params.slug as string;
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const fixtures = useAppStore((s) => s.fixtures);

  const topFive = calculateStandings(teams, fixtures).slice(0, 5);

  if (!topFive.length) return null;

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Standings</span>
        <Link href={`/org/${slug}/standings`} className="panel-link">
          Full table <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-xs uppercase tracking-[0.04em] text-ink-3 font-semibold">
              <th className="text-left px-4 py-2.5 font-semibold border-b border-line">#</th>
              <th className="text-left px-4 py-2.5 font-semibold border-b border-line">Team</th>
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">P</th>
              <th className="text-center px-4 py-2.5 font-semibold border-b border-line">GD</th>
              <th className="text-right px-4 py-2.5 font-semibold border-b border-line">Pts</th>
            </tr>
          </thead>
          <tbody>
            {topFive.map((team, index) => (
              <tr
                key={team.id}
                className="border-b border-line last:border-0 hover:bg-surface-2/50 transition-colors"
              >
                <td className="px-4 py-2.5 text-ink-3">{index + 1}</td>
                <td className="px-4 py-2.5 font-medium">
                  <span className="flex items-center gap-2">
                    {(() => {
                      const t = teams.find((tt) => tt.id === team.id);
                      return t?.logo_url ? (
                        <Image
                          src={t.logo_url}
                          alt=""
                          width={20}
                          height={20}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-surface-2 inline-block shrink-0" />
                      );
                    })()}
                    {team.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">{team.played}</td>
                <td className="px-4 py-2.5 text-center">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                <td className="px-4 py-2.5 text-right font-bold">{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
