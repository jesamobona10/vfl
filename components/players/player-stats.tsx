"use client";

import { useAppStore } from "@/lib/store";
import { Trophy, Crosshair, ShieldAlert, Ban, Hand, Sword, Sparkles, Download } from "lucide-react";

function StatColumn({
  title,
  icon: Icon,
  data,
}: {
  title: string;
  icon: any;
  data: { rank: number; name: string; teamName: string; value: number }[];
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-muted mb-3">
        <Icon size={16} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {!data.length ? (
        <p className="text-xs text-muted">No data yet.</p>
      ) : (
        <div className="space-y-1.5">
          {data.map((d) => (
            <div key={d.rank} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-xs text-muted font-medium text-right">{d.rank}</span>
              <span className="flex-1 truncate">{d.name}</span>
              <span className="text-xs text-muted truncate max-w-[80px]">{d.teamName}</span>
              <strong className="text-sm w-6 text-right">{d.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerStats() {
  const players = useAppStore((s) => s.players);
  const teamName = useAppStore((s) => s.teamName);

  const top = (field: string, filter?: string) =>
    players
      .filter((p) => !filter || p.position === filter)
      .sort((a, b) => (b as any)[field] - (a as any)[field])
      .slice(0, 10)
      .map((p, i) => ({
        rank: i + 1,
        name: p.name,
        teamName: teamName(p.teamId),
        value: (p as any)[field] as number,
      }));

  const statSections: { title: string; field: string; filter?: string }[] = [
    { title: "Top Scorers", field: "goals" },
    { title: "Top Assists", field: "assists" },
    { title: "Yellow Cards", field: "yellowCards" },
    { title: "Red Cards", field: "redCards" },
    { title: "Saves", field: "saves", filter: "GK" },
    { title: "Tackles", field: "tackles" },
    { title: "Clean Sheets", field: "cleanSheets" },
  ];

  const handleDownload = () => {
    const rows = [["Rank", "Category", "Player", "Team", "Value"]];
    for (const section of statSections) {
      const data = top(section.field, section.filter);
      for (const d of data) {
        rows.push([String(d.rank), section.title, `"${d.name}"`, `"${d.teamName}"`, String(d.value)]);
      }
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "player-statistics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={handleDownload} className="btn-ghost">
          <Download size={16} />
          Download
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatColumn title="Top Scorers" icon={Trophy} data={top("goals")} />
        <StatColumn title="Top Assists" icon={Crosshair} data={top("assists")} />
        <StatColumn title="Yellow Cards" icon={ShieldAlert} data={top("yellowCards")} />
        <StatColumn title="Red Cards" icon={Ban} data={top("redCards")} />
        <StatColumn title="Saves" icon={Hand} data={top("saves", "GK")} />
        <StatColumn title="Tackles" icon={Sword} data={top("tackles")} />
        <StatColumn title="Clean Sheets" icon={Sparkles} data={top("cleanSheets")} />
      </div>
    </div>
  );
}
