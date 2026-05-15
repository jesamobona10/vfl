"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { downloadFormationImage } from "@/lib/formation-image";
import { Download } from "lucide-react";

function getPlayerRoundScore(
  playerId: number,
  matchIds: number[]
): number {
  const store = useAppStore.getState();
  const events: { type: string }[] = [];
  for (const round of store.fixtures) {
    for (const match of round.matches) {
      if (matchIds.includes(match.id)) {
        for (const event of match.events || []) {
          if (event.playerId === playerId) {
            events.push(event);
          }
        }
      }
    }
  }

  let score = 0;
  for (const e of events) {
    score += 1;
    if (e.type === "goal") score += 2;
    if (e.type === "assist") score += 1;
    if (e.type === "save") score += 0.5;
    if (e.type === "penalty-save") score += 2;
    if (e.type === "clean-sheet") score += 3;
    if (e.type === "tackle") score += 1;
    if (e.type === "interception") score += 0.5;
    if (e.type === "block") score += 1;
    if (e.type === "aerial") score += 0.5;
  }
  return score;
}

export function TeamOfRound() {
  const [roundNum, setRoundNum] = useState("");

  const fixtures = useAppStore((s) => s.fixtures);
  const players = useAppStore((s) => s.players);
  const teamName = useAppStore((s) => s.teamName);

  const selectedRound = fixtures.find(
    (r) => r.round === Number(roundNum)
  );
  const matchIds = selectedRound
    ? selectedRound.matches.map((m) => m.id)
    : [];

  const scored = players
    .map((p) => ({
      ...p,
      roundScore: getPlayerRoundScore(p.id, matchIds),
      teamName: teamName(p.teamId),
    }))
    .filter((p) => matchIds.length > 0);

  const positions: Record<string, typeof scored> = {
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  };
  for (const p of scored) {
    if (positions[p.position])
      positions[p.position].push(p);
  }

  const bestGK = positions.GK.sort(
    (a, b) => b.roundScore - a.roundScore
  )[0];
  const bestDEF = positions.DEF.sort(
    (a, b) => b.roundScore - a.roundScore
  ).slice(0, 4);
  const bestMID = positions.MID.sort(
    (a, b) => b.roundScore - a.roundScore
  ).slice(0, 3);
  const bestATT = positions.ATT.sort(
    (a, b) => b.roundScore - a.roundScore
  ).slice(0, 3);

  const handleDownload = () => {
    if (!roundNum || !selectedRound) return;
    downloadFormationImage(
      bestGK || null,
      bestDEF,
      bestMID,
      bestATT,
      roundNum
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={roundNum}
          onChange={(e) => setRoundNum(e.target.value)}
          className="input w-auto min-w-[180px]"
        >
          <option value="">Select a round</option>
          {fixtures.map((r) => (
            <option key={r.round} value={r.round}>
              Round {r.round}
            </option>
          ))}
        </select>
        {roundNum && (
          <button onClick={handleDownload} className="btn-ghost">
            <Download size={16} />
            Download
          </button>
        )}
      </div>

      {!roundNum ? (
        <div className="card p-8 text-center text-muted">
          <p>Select a round to view Team of the Round.</p>
        </div>
      ) : (
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-6 text-center">
            Team of Round {roundNum}
          </h3>
          <div className="space-y-4">
            <Row
              label="Goalkeeper"
              players={bestGK ? [bestGK] : []}
              teamName={teamName}
            />
            <Row
              label="Defenders"
              players={bestDEF}
              teamName={teamName}
            />
            <Row
              label="Midfielders"
              players={bestMID}
              teamName={teamName}
            />
            <Row
              label="Attackers"
              players={bestATT}
              teamName={teamName}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  players,
  teamName,
}: {
  label: string;
  players: any[];
  teamName: (id: number) => string;
}) {
  return (
    <div>
      <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {players.length === 0 ? (
          <p className="text-sm text-muted">None</p>
        ) : (
          players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 text-sm"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted">
                #{p.number} | {teamName(p.teamId)}
              </span>
              <span className="text-xs font-semibold">
                {p.rating.toFixed(1)}
              </span>
              <span className="text-xs text-accent">
                {p.roundScore.toFixed(1)}pts
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
