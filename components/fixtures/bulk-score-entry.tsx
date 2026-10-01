"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Check } from "lucide-react";
import { TimeInput } from "../shared/time-input";
import { DataTable, DataField, type DataTableColumn } from "@/components/shared/data-table";
import type { Match } from "@/lib/types";

type TeamLike = { name?: string; logo_url?: string | null } | undefined | null;

/**
 * Module scope matters here: a component declared inside the render body is a
 * new type on every render, which would remount the logo <img> on each
 * keystroke in the score inputs.
 */
function TeamCell({ team, align }: { team: TeamLike; align: "left" | "right" }) {
  return (
    <span className={`flex items-center gap-2 min-w-0 ${align === "right" ? "justify-end" : ""}`}>
      {align === "right" && team?.name && (
        <span className="font-medium truncate text-right">{team.name}</span>
      )}
      {team?.logo_url ? (
        <img src={team.logo_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
      ) : (
        <span className="w-5 h-5 rounded bg-surface-2 shrink-0" />
      )}
      {align === "left" && <span className="font-medium truncate">{team?.name || "?"}</span>}
    </span>
  );
}

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

  const scoreColumns: DataTableColumn<Match>[] = [
    {
      key: "home",
      header: "Home",
      className: "text-left",
      render: (match) => <TeamCell team={getTeam(match.homeId)} align="left" />,
    },
    {
      key: "score",
      header: "Score",
      width: "8rem",
      className: "text-center",
      render: (match) => (
        <div className="flex items-center justify-center gap-1">
          <input
            type="number"
            min={0}
            max={99}
            value={match.homeScore ?? ""}
            onChange={(e) => handleScoreChange(match.id, "homeScore", e.target.value)}
            className="input w-12 text-center text-base font-bold py-1"
            aria-label={`${getTeam(match.homeId)?.name || "Home"} goals`}
          />
          <span className="text-muted font-bold">-</span>
          <input
            type="number"
            min={0}
            max={99}
            value={match.awayScore ?? ""}
            onChange={(e) => handleScoreChange(match.id, "awayScore", e.target.value)}
            className="input w-12 text-center text-base font-bold py-1"
            aria-label={`${getTeam(match.awayId)?.name || "Away"} goals`}
          />
        </div>
      ),
    },
    {
      key: "away",
      header: "Away",
      className: "text-right",
      render: (match) => <TeamCell team={getTeam(match.awayId)} align="right" />,
    },
    {
      key: "date",
      header: "Date",
      width: "7rem",
      className: "text-center",
      render: (match) => (
        <input
          type="date"
          value={match.date || ""}
          onChange={(e) => handleDateChange(match.id, e.target.value)}
          className="input text-xs py-1 w-full text-center"
          aria-label={`Match date for ${getTeam(match.homeId)?.name || "home"} vs ${getTeam(match.awayId)?.name || "away"}`}
        />
      ),
    },
    {
      key: "time",
      header: "Time",
      width: "5rem",
      className: "text-center",
      render: (match) => (
        <TimeInput value={match.time || ""} onChange={(val) => handleTimeChange(match.id, val)} />
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "5rem",
      className: "text-center",
      render: (match) => (
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            match.homeScore != null && match.awayScore != null
              ? "bg-brand/10 text-brand"
              : "bg-surface-2 text-muted"
          }`}
        >
          {match.homeScore != null && match.awayScore != null ? "Done" : "—"}
        </span>
      ),
    },
  ];

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
            <DataTable
              rows={round.matches}
              rowKey={(match) => String(match.id)}
              headClassName="text-xs text-muted uppercase tracking-wider"
              columns={scoreColumns}
              mobileCard={(match) => {
                const home = getTeam(match.homeId);
                const away = getTeam(match.awayId);
                return (
                  <div key={match.id} className="rounded-lg border border-line p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <TeamCell team={home} align="left" />
                      <TeamCell team={away} align="right" />
                    </div>
                    <div className="flex items-end gap-3 flex-wrap">
                      <DataField label="Score" className="flex-1 min-w-[140px]">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={match.homeScore ?? ""}
                            onChange={(e) =>
                              handleScoreChange(match.id, "homeScore", e.target.value)
                            }
                            className="input w-full text-center text-base font-bold py-1.5"
                            aria-label={`${home?.name || "Home"} goals`}
                          />
                          <span className="text-muted font-bold">-</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={match.awayScore ?? ""}
                            onChange={(e) =>
                              handleScoreChange(match.id, "awayScore", e.target.value)
                            }
                            className="input w-full text-center text-base font-bold py-1.5"
                            aria-label={`${away?.name || "Away"} goals`}
                          />
                        </div>
                      </DataField>
                      <DataField label="Status" className="shrink-0">
                        {match.homeScore != null && match.awayScore != null ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                            Done
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted">
                            —
                          </span>
                        )}
                      </DataField>
                    </div>
                    <div className="flex items-end gap-3 flex-wrap">
                      <DataField label="Date" className="flex-1 min-w-[140px]">
                        <input
                          type="date"
                          value={match.date || ""}
                          onChange={(e) => handleDateChange(match.id, e.target.value)}
                          className="input text-xs py-1.5"
                          aria-label={`Match date for ${home?.name || "home"} vs ${away?.name || "away"}`}
                        />
                      </DataField>
                      <DataField label="Time" className="shrink-0">
                        <TimeInput
                          value={match.time || ""}
                          onChange={(val) => handleTimeChange(match.id, val)}
                        />
                      </DataField>
                    </div>
                  </div>
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
