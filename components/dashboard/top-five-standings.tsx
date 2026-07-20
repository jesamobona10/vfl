"use client";

import { useAppStore } from "@/lib/store";
import { calculateStandings } from "@/lib/logic/standings";

export function TopFiveStandings() {
  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);

  const topFive = calculateStandings(teams, fixtures).slice(0, 5);

  if (!topFive.length) return null;

  return (
    <div className="card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-sm font-semibold">Top 5 Standings</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">#</th>
              <th className="text-left px-5 py-3 font-medium">
                Team
              </th>
              <th className="text-center px-5 py-3 font-medium">
                Pts
              </th>
              <th className="text-center px-5 py-3 font-medium">
                GD
              </th>
              <th className="text-center px-5 py-3 font-medium">
                Rtg
              </th>
            </tr>
          </thead>
          <tbody>
            {topFive.map((team, index) => (
              <tr
                key={team.id}
                className="border-b border-line/50 last:border-0 hover:bg-surface-2/50 transition-colors"
              >
                <td className="px-5 py-3 font-bold">{index + 1}</td>
                <td className="px-5 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    {(() => {
                      const t = teams.find((tt) => tt.id === team.id);
                      return t?.logo_url ? (
                        <img
                          src={t.logo_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-surface-2 inline-block shrink-0" />
                      );
                    })()}
                    {team.name}
                  </span>
                </td>
                <td className="px-5 py-3 text-center font-bold">
                  {team.points}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.gd > 0 ? `+${team.gd}` : team.gd}
                </td>
                <td className="px-5 py-3 text-center">
                  {team.rating?.toFixed(1) || "6.0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
