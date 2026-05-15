"use client";

import { useState } from "react";
import { PlayerList } from "@/components/players/player-list";
import { PlayerStats } from "@/components/players/player-stats";
import { TeamOfRound } from "@/components/players/team-of-round";

type Tab = "list" | "stats" | "totr";

const tabs: { key: Tab; label: string }[] = [
  { key: "list", label: "Players" },
  { key: "stats", label: "Statistics" },
  { key: "totr", label: "Team of the Round" },
];

export default function PlayersPage() {
  const [tab, setTab] = useState<Tab>("list");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Players &amp; Statistics
          </h1>
          <p className="text-sm text-muted">
            Player management
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-surface shadow-sm text-text"
                : "text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" && <PlayerList />}
      {tab === "stats" && <PlayerStats />}
      {tab === "totr" && <TeamOfRound />}
    </div>
  );
}
