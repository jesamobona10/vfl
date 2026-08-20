"use client";

import { useState } from "react";
import type { Match, MatchEvent, Player } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldQuestion,
  UserX,
} from "lucide-react";

interface ReportedEvent {
  type: string;
  minute: number | null;
  minuteInference?: { text: string; confidence: number; requiresReview: boolean } | null;
  playerId: number | null;
  playerName: string | null;
  playerStatus: "RESOLVED" | "AMBIGUOUS" | "NOT_FOUND";
  teamId: number | null;
  assistPlayerId: number | null;
  assistStatus?: "CLEAR" | "NONE" | "UNCLEAR";
  confidence: number;
  evidence: string;
  candidateIds?: number[];
}

interface Warning {
  code: string;
  message: string;
}

interface AnalysisResponse {
  analysis: {
    id: number;
    status: string;
    score: { homeScore: number | null; awayScore: number | null };
    events: ReportedEvent[];
    warnings: Warning[];
    model: string;
  };
}

const EVENT_META: Record<string, { label: string; abbr: string; color: string }> = {
  GOAL: { label: "Goal", abbr: "G", color: "bg-brand/20 text-brand" },
  OWN_GOAL: { label: "Own Goal", abbr: "OG", color: "bg-muted/20 text-muted" },
  PENALTY_GOAL: { label: "Penalty Goal", abbr: "P", color: "bg-brand/20 text-brand" },
  YELLOW_CARD: { label: "Yellow Card", abbr: "Y", color: "bg-warn-500/20 text-warn-500" },
  RED_CARD: { label: "Red Card", abbr: "R", color: "bg-danger/20 text-danger" },
};

const EVENT_TYPES = ["GOAL", "OWN_GOAL", "PENALTY_GOAL", "YELLOW_CARD", "RED_CARD"];

interface MatchReportModalProps {
  match: Match;
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
}

export function MatchReportModal({
  match,
  homeTeamName,
  awayTeamName,
  onClose,
}: MatchReportModalProps) {
  const players = useAppStore((s) => s.players);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const updatePlayer = useAppStore((s) => s.updatePlayer);

  const [step, setStep] = useState<"input" | "review" | "done">("input");
  const [report, setReport] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse["analysis"] | null>(null);

  const eligiblePlayers = players.filter(
    (p) => p.teamId === match.homeId || p.teamId === match.awayId
  );
  const playerById = (id: number | null) => eligiblePlayers.find((p) => p.id === id);

  const nameFor = (id: number | null) => playerById(id)?.name || "—";

  const handleAnalyze = async () => {
    if (!report.trim()) {
      setError("Paste or type a match report first.");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch(`/api/fixtures/${match.id}/report/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed.");
        setAnalyzing(false);
        return;
      }
      setAnalysis(data.analysis);
      setStep("review");
    } catch {
      setError("Failed to analyze the report. Try again or enter events manually.");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateEvent = (index: number, patch: Partial<ReportedEvent>) => {
    if (!analysis) return;
    const events = analysis.events.map((e, i) => (i === index ? { ...e, ...patch } : e));
    setAnalysis({ ...analysis, events });
  };

  const handleConfirm = async () => {
    if (!analysis) return;
    setConfirming(true);
    setError("");
    try {
      const payload = analysis.events.filter((e) => e.playerId != null).map((e) => ({ ...e }));
      const res = await fetch(`/api/fixtures/${match.id}/report/analyses/${analysis.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Confirmation failed.");
        setConfirming(false);
        return;
      }
      applyToStore(data);
      setStep("done");
    } catch {
      setError("Failed to confirm events.");
    } finally {
      setConfirming(false);
    }
  };

  const applyToStore = (data: { homeScore: number; awayScore: number; eventsInserted: number }) => {
    if (!analysis) return;
    const events = analysis.events
      .filter((e) => e.playerId != null)
      .map((e): MatchEvent => ({
        playerId: e.playerId!,
        type: eventTypeToStore(e.type),
        minute: e.minute ?? undefined,
        teamId: e.teamId ?? undefined,
      }));

    // Attach assist rows (app stores assist as its own event).
    analysis.events.forEach((e) => {
      if (
        (e.type === "GOAL" || e.type === "PENALTY_GOAL") &&
        e.assistPlayerId != null &&
        e.playerId != null
      ) {
        events.push({
          playerId: e.assistPlayerId,
          type: "assist",
          minute: e.minute ?? undefined,
          teamId: e.teamId ?? undefined,
        });
      }
    });

    updateMatch(match.id, "events", [...(match.events || []), ...events]);
    updateMatch(match.id, "homeScore", data.homeScore);
    updateMatch(match.id, "awayScore", data.awayScore);
    if (match.status !== "completed") updateMatch(match.id, "status", "completed");

    // Mirror player stat increments (same as AddEventModal).
    const STAT_FIELD: Record<string, keyof Player> = {
      goal: "goals",
      assist: "assists",
      "own-goal": "ownGoals",
      yellow: "yellowCards",
      red: "redCards",
    };
    const bumps: { playerId: number; field: keyof Player }[] = [];
    analysis.events.forEach((e) => {
      if (e.playerId == null) return;
      const type = eventTypeToStore(e.type);
      if (STAT_FIELD[type]) bumps.push({ playerId: e.playerId, field: STAT_FIELD[type] });
      if ((e.type === "GOAL" || e.type === "PENALTY_GOAL") && e.assistPlayerId != null) {
        bumps.push({ playerId: e.assistPlayerId, field: "assists" });
      }
    });
    bumps.forEach(({ playerId, field }) => {
      const p = players.find((pl) => pl.id === playerId);
      if (p) updatePlayer(playerId, { [field]: ((p[field] as number) || 0) + 1 });
    });
    useAppStore.getState().recalculateRatings();
  };

  const requiresAction = analysis?.events.some((e) => e.playerStatus !== "RESOLVED");

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brand" />
              <h3 className="text-lg font-bold">AI Match Report</h3>
            </div>
            <p className="text-xs text-muted">
              {homeTeamName} vs {awayTeamName}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {step === "input" && (
            <>
              <textarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
                rows={8}
                maxLength={4000}
                placeholder={
                  'Paste or type the match report here.\n\nExample:\n"Veritas FC opened strongly. Daniel Musa scored in the 17th minute after a pass from David John. Samuel Peter equalised shortly before halftime from a free kick."'
                }
                className="input w-full resize-y text-sm min-h-40"
              />
              <p className="text-[11px] text-muted text-right">
                {report.length.toLocaleString()} / 4,000
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-muted">
                <ShieldQuestion size={14} className="shrink-0" />
                <span>
                  Suggested events are shown for your review — nothing is saved until you confirm
                  them.
                </span>
              </div>
            </>
          )}

          {step === "review" && analysis && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Proposed Analysis</p>
                  <p className="text-xs text-muted">Model: {analysis.model}</p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    analysis.status === "REVIEW_REQUIRED"
                      ? "bg-warn-500/15 text-warn-500"
                      : "bg-brand/15 text-brand"
                  }`}
                >
                  {analysis.status === "REVIEW_REQUIRED" ? "Review required" : "Ready to confirm"}
                </span>
              </div>

              <div className="rounded-xl border border-line px-4 py-3 text-center">
                <p className="text-lg font-bold tabular-nums">
                  {homeTeamName} {analysis.score.homeScore ?? "?"} -{" "}
                  {analysis.score.awayScore ?? "?"} {awayTeamName}
                </p>
              </div>

              {analysis.events.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted">
                  No events could be extracted. Try rephrasing the report or add events manually.
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.events.map((ev, i) => {
                    const meta = EVENT_META[ev.type] || {
                      label: ev.type,
                      abbr: ev.type.slice(0, 2),
                      color: "bg-muted/20 text-muted",
                    };
                    const statusBadge =
                      ev.playerStatus === "RESOLVED" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand">
                          <CheckCircle2 size={11} /> resolved
                        </span>
                      ) : ev.playerStatus === "AMBIGUOUS" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warn-500">
                          <AlertTriangle size={11} /> ambiguous
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-danger">
                          <UserX size={11} /> unresolved
                        </span>
                      );

                    return (
                      <div key={i} className="rounded-xl border border-line p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${meta.color}`}
                          >
                            {meta.abbr}
                          </span>
                          <select
                            value={ev.type}
                            onChange={(e) => {
                              const type = e.target.value;
                              updateEvent(i, {
                                type,
                                assistPlayerId: null,
                                assistStatus: "NONE",
                              });
                            }}
                            className="input text-xs w-auto font-semibold uppercase"
                          >
                            {EVENT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {EVENT_META[t].label}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-muted">at</span>
                          <input
                            type="number"
                            min={0}
                            max={130}
                            value={ev.minute ?? ""}
                            onChange={(e) =>
                              updateEvent(i, {
                                minute: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="input text-xs w-16 text-center"
                            placeholder="?"
                          />
                          <span className="ml-auto">
                            {ev.minuteInference ? (
                              <span
                                className="text-[10px] text-muted"
                                title={`Inferred from: ${ev.minuteInference.text}`}
                              >
                                ⏱ inferred
                              </span>
                            ) : null}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                              Player {statusBadge}
                            </label>
                            <select
                              value={ev.playerId ?? ""}
                              onChange={(e) => {
                                const pid = e.target.value ? Number(e.target.value) : null;
                                const player = playerById(pid);
                                updateEvent(i, {
                                  playerId: pid,
                                  playerName: player?.name || null,
                                  playerStatus: pid ? "RESOLVED" : "NOT_FOUND",
                                  teamId: player?.teamId || null,
                                });
                              }}
                              className="input text-sm mt-1"
                            >
                              <option value="">— select player —</option>
                              <optgroup label={homeTeamName}>
                                {players
                                  .filter((p) => p.teamId === match.homeId)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.number ? `#${p.number} ` : ""}
                                      {p.name}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label={awayTeamName}>
                                {players
                                  .filter((p) => p.teamId === match.awayId)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.number ? `#${p.number} ` : ""}
                                      {p.name}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                          </div>

                          {(ev.type === "GOAL" || ev.type === "PENALTY_GOAL") && (
                            <div>
                              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                                Assist
                              </label>
                              <select
                                value={ev.assistPlayerId ?? ""}
                                onChange={(e) =>
                                  updateEvent(i, {
                                    assistPlayerId: e.target.value ? Number(e.target.value) : null,
                                    assistStatus: e.target.value ? "CLEAR" : "NONE",
                                  })
                                }
                                className="input text-sm mt-1"
                              >
                                <option value="">No assist</option>
                                {eligiblePlayers
                                  .filter((p) => p.id !== ev.playerId)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                              Confidence
                            </label>
                            <div className="mt-1 text-sm">
                              {Math.round((ev.confidence ?? 0) * 100)}%
                              <div className="h-1.5 w-full bg-surface-2 rounded-full mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-brand rounded-full"
                                  style={{
                                    width: `${Math.round((ev.confidence ?? 0) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {ev.evidence && (
                          <p className="text-xs text-muted italic border-l-2 border-line pl-3">
                            “{ev.evidence}”
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {analysis.warnings.length > 0 && (
                <div className="rounded-xl border border-warn-500/30 bg-warn-500/5 p-3 space-y-1.5">
                  {analysis.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-warn-600">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "done" && (
            <div className="text-center py-10">
              <CheckCircle2 size={44} className="mx-auto text-brand mb-3" />
              <h3 className="text-lg font-bold">Events Confirmed</h3>
              <p className="text-sm text-muted mt-1">
                The approved events, score, and player stats have been saved.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line flex items-center justify-between gap-3">
          {step === "input" && (
            <>
              <button onClick={onClose} className="btn-ghost text-sm">
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !report.trim()}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Analyze Report
                  </>
                )}
              </button>
            </>
          )}

          {step === "review" && analysis && (
            <>
              <button onClick={onClose} className="btn-ghost text-sm">
                Discard
              </button>
              <div className="flex items-center gap-2">
                {requiresAction && (
                  <span className="text-xs text-warn-500 flex items-center gap-1">
                    <AlertTriangle size={13} /> Resolve issues before confirming
                  </span>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={confirming || requiresAction}
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  {confirming ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> Confirm Events
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === "done" && (
            <button onClick={onClose} className="btn-primary text-sm ml-auto">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function eventTypeToStore(type: string): string {
  switch (type) {
    case "OWN_GOAL":
      return "own-goal";
    case "YELLOW_CARD":
      return "yellow";
    case "RED_CARD":
      return "red";
    case "PENALTY_GOAL":
    case "GOAL":
    default:
      return "goal";
  }
}
