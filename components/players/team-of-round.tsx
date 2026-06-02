"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { downloadFormationImage } from "@/lib/formation-image";
import { Download } from "lucide-react";

type FormationType = "4-3-3" | "4-4-2" | "3-5-2";

const formations: FormationType[] = ["4-3-3", "4-4-2", "3-5-2"];

const formationCounts: Record<FormationType, { GK: number; DEF: number; MID: number; ATT: number }> = {
  "4-3-3": { GK: 1, DEF: 4, MID: 3, ATT: 3 },
  "4-4-2": { GK: 1, DEF: 4, MID: 4, ATT: 2 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, ATT: 2 },
};

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
  const [formation, setFormation] = useState<FormationType>("4-3-3");

  const fixtures = useAppStore((s) => s.fixtures);
  const players = useAppStore((s) => s.players);
  const teamName = useAppStore((s) => s.teamName);

  const selectedRound = fixtures.find((r) => r.round === Number(roundNum));
  const matchIds = selectedRound ? selectedRound.matches.map((m) => m.id) : [];

  const scored = useMemo(
    () =>
      players
        .map((p) => ({
          ...p,
          roundScore: getPlayerRoundScore(p.id, matchIds),
          teamName: teamName(p.teamId),
        }))
        .filter(() => matchIds.length > 0),
    [players, matchIds, teamName]
  );

  const positions: Record<string, typeof scored> = {
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  };

  for (const p of scored) {
    if (positions[p.position]) positions[p.position].push(p);
  }

  const counts = formationCounts[formation];
  const bestGK = positions.GK.sort((a, b) => b.roundScore - a.roundScore)[0];
  const bestDEF = positions.DEF.sort((a, b) => b.roundScore - a.roundScore).slice(0, counts.DEF);
  const bestMID = positions.MID.sort((a, b) => b.roundScore - a.roundScore).slice(0, counts.MID);
  const bestATT = positions.ATT.sort((a, b) => b.roundScore - a.roundScore).slice(0, counts.ATT);

  const handleDownload = () => {
    if (!roundNum || !selectedRound) return;
    downloadFormationImage(
      bestGK || null,
      bestDEF,
      bestMID,
      bestATT,
      roundNum,
      formation
    );
  };

  const formationRows = [
    { label: "Goalkeeper", players: bestGK ? [bestGK] : [], count: counts.GK },
    { label: "Defenders", players: bestDEF, count: counts.DEF },
    { label: "Midfielders", players: bestMID, count: counts.MID },
    { label: "Attackers", players: bestATT, count: counts.ATT },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-text">Round</label>
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
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-text">Formation</label>
          <select
            value={formation}
            onChange={(e) => setFormation(e.target.value as FormationType)}
            className="input w-auto min-w-[140px]"
            disabled={!roundNum}
          >
            {formations.map((form) => (
              <option key={form} value={form}>
                {form}
              </option>
            ))}
          </select>
        </div>

        {roundNum && (
          <button onClick={handleDownload} className="btn-ghost"
            type="button"
          >
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
        <div className="card p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-2 text-center">
              Team of Round {roundNum}
            </h3>
            <p className="text-sm text-center text-muted">
              Formation: <span className="font-semibold">{formation}</span>
            </p>
          </div>

          <div className="space-y-4">
            {formationRows.map((row) => (
              <FormationRow
                key={row.label}
                label={row.label}
                players={row.players}
                count={row.count}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormationRow({
  label,
  players,
  count,
}: {
  label: string;
  players: any[];
  count: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted font-semibold uppercase tracking-wider">
          {label}
        </p>
        <p className="text-xs text-muted">{players.length}/{count}</p>
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: count }).map((_, index) => {
          const player = players[index];
          return (
            <div
              key={`${label}-${index}`}
              className="rounded-2xl border border-line bg-surface-2 p-3 text-center min-h-[96px]"
            >
              {player ? (
                <>
                  <p className="font-semibold text-text">{player.name}</p>
                  <p className="text-xs text-muted">#{player.number}</p>
                  <p className="text-xs text-muted">{player.teamName}</p>
                  <p className="mt-2 text-sm font-semibold text-text">
                    {player.roundScore.toFixed(1)} pts
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">No player</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
