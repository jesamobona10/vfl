"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { PlayerList } from "@/components/players/player-list";
import { PlayerStats } from "@/components/players/player-stats";
import { TeamOfRound } from "@/components/players/team-of-round";
import { LineupBuilder } from "@/components/players/lineup-builder";

type Tab = "list" | "stats" | "totr" | "lineup";

const tabs: { key: Tab; label: string }[] = [
  { key: "list", label: "Players" },
  { key: "stats", label: "Statistics" },
  { key: "totr", label: "Team of the Round" },
  { key: "lineup", label: "Lineup Builder" },
];

export default function OrgPlayersPage() {
  const [tab, setTab] = useState<Tab>("list");
  const players = useAppStore((s) => s.players);

  const totalPlayers = players.length;
  const totalTeams = new Set(players.map((player) => player.teamId)).size;
  const totalPositions = new Set(players.map((player) => player.position)).size;

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Players &amp; Statistics</h1>
          <p className="text-sm text-muted">Player management and league insights</p>
        </div>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-4 border border-line bg-surface">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Total players</p>
            <p className="text-2xl font-semibold">{totalPlayers}</p>
          </div>
          <div className="card p-4 border border-line bg-surface">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Teams represented</p>
            <p className="text-2xl font-semibold">{totalTeams}</p>
          </div>
          <div className="card p-4 border border-line bg-surface">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Positions tracked</p>
            <p className="text-2xl font-semibold">{totalPositions}</p>
          </div>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 bg-surface-2 rounded-full p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
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
      {tab === "lineup" && <LineupBuilder />}
    </div>
  );
}
