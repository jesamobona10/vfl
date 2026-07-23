"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Check } from "lucide-react";
import { TimeInput } from "../shared/time-input";

export function BulkScoreEntry() {
  const fixtures = useAppStore((s) => s.fixtures);
  const getTeam = useAppStore((s) => s.getTeam);
  const updateMatch = useAppStore((s) => s.updateMatch);

  const [savedRounds, setSavedRounds] = useState<Set<number>>(new Set());

  const handleScoreChange = (matchId: number, field: "homeScore" | "awayScore", value: string) => {
    const num = value === "" ? null : Math.max(0, Math.min(99, Number(value) || 0));
    updateMatch(matchId, field, num);
  };

  const handleDateChange = (matchId: number, value: string) => {
    updateMatch(matchId, "date", value || null);
  };

  const handleTimeChange = (matchId: number, value: string) => {
    updateMatch(matchId, "time", value || null);
  };

  const saveRound = (round: number) => {
    const roundMatches = fixtures.find((r) => r.round === round)?.matches || [];
    for (const match of roundMatches) {
      if (match.homeScore != null && match.awayScore != null) {
        updateMatch(match.id, "status", "completed");
      }
    }
    setSavedRounds((prev) => new Set(prev).add(round));
  };

  if (!fixtures.length) return null;

  return (
    <div className="space-y-6">
      {fixtures.map((round) => {
        const isSaved = savedRounds.has(round.round);

        return (
          <div key={round.round} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Round {round.round}
                {round.byeId != null && (
                  <span className="ml-2 text-xs text-muted font-normal">
                    (bye: {getTeam(round.byeId)?.name || `Team ${round.byeId}`})
                  </span>
                )}
              </h3>
              <button
                onClick={() => saveRound(round.round)}
                disabled={isSaved}
                className={`btn-sm flex items-center gap-1.5 ${isSaved ? "text-muted" : "btn-primary"}`}
              >
                <Check size={14} />
                {isSaved ? "Saved" : "Save Round"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted uppercase tracking-wider border-b border-line">
                    <th className="text-left py-2 pr-2">Home</th>
                    <th className="text-center py-2 px-2 w-32">Score</th>
                    <th className="text-right py-2 pl-2">Away</th>
                    <th className="text-center py-2 px-2 w-28">Date</th>
                    <th className="text-center py-2 px-2 w-20">Time</th>
                    <th className="text-center py-2 px-2 w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {round.matches.map((match) => {
                    const home = getTeam(match.homeId);
                    const away = getTeam(match.awayId);
                    const hasBothScores = match.homeScore != null && match.awayScore != null;

                    return (
                      <tr key={match.id} className="border-b border-line/50 hover:bg-surface-2/50 transition-colors">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            {home?.logo_url && <img src={home.logo_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />}
                            <span className="font-medium truncate">{home?.name || "?"}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={match.homeScore ?? ""}
                              onChange={(e) => handleScoreChange(match.id, "homeScore", e.target.value)}
                              className="input w-12 text-center text-base font-bold py-1"
                            />
                            <span className="text-muted font-bold">-</span>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={match.awayScore ?? ""}
                              onChange={(e) => handleScoreChange(match.id, "awayScore", e.target.value)}
                              className="input w-12 text-center text-base font-bold py-1"
                            />
                          </div>
                        </td>
                        <td className="py-2 pl-2">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="font-medium truncate">{away?.name || "?"}</span>
                            {away?.logo_url && <img src={away.logo_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="date"
                            value={match.date || ""}
                            onChange={(e) => handleDateChange(match.id, e.target.value)}
                            className="input text-xs py-1 w-28 text-center"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <TimeInput
                            value={match.time || ""}
                            onChange={(val) => handleTimeChange(match.id, val)}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            hasBothScores
                              ? "bg-brand/10 text-brand"
                              : "bg-surface-2 text-muted"
                          }`}>
                            {hasBothScores ? "Done" : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
