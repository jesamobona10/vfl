"use client";

import { useState, useEffect } from "react";
import type { CupMatch } from "@/lib/types";
import { X, Clock } from "lucide-react";

interface CupMatchModalProps {
  match: CupMatch;
  getTeamName: (id: number) => string;
  onSave: (id: number, data: Partial<CupMatch>) => void;
  onComplete: (id: number) => void;
  onClose: () => void;
}

export function CupMatchModal({
  match,
  getTeamName,
  onSave,
  onComplete,
  onClose,
}: CupMatchModalProps) {
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? "");
  const [useET, setUseET] = useState(match.homeETScore != null || match.awayETScore != null);
  const [homeET, setHomeET] = useState(match.homeETScore?.toString() ?? "");
  const [awayET, setAwayET] = useState(match.awayETScore?.toString() ?? "");
  const [usePen, setUsePen] = useState(match.homePenScore != null || match.awayPenScore != null);
  const [homePen, setHomePen] = useState(match.homePenScore?.toString() ?? "");
  const [awayPen, setAwayPen] = useState(match.awayPenScore?.toString() ?? "");
  const [date, setDate] = useState(match.date);
  const [time, setTime] = useState(match.time);
  const [venue, setVenue] = useState(match.venue);

  const homeTeamId = match.homeId;
  const awayTeamId = match.awayId;
  const homeName = homeTeamId != null ? getTeamName(homeTeamId) : "TBD";
  const awayName = awayTeamId != null ? getTeamName(awayTeamId) : "TBD";

  const handleSave = () => {
    const data: Partial<CupMatch> = {
      homeScore: homeScore ? Number(homeScore) : null,
      awayScore: awayScore ? Number(awayScore) : null,
      homeETScore: useET && homeET ? Number(homeET) : null,
      awayETScore: useET && awayET ? Number(awayET) : null,
      homePenScore: usePen && homePen ? Number(homePen) : null,
      awayPenScore: usePen && awayPen ? Number(awayPen) : null,
      date,
      time,
      venue,
    };

    onSave(match.id, data);
    onComplete(match.id);
    onClose();
  };

  const canSave =
    homeScore !== "" &&
    awayScore !== "" &&
    Number(homeScore) !== Number(awayScore);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-line rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-text">Match Result</h3>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="text-center space-y-1">
          <p className="font-semibold text-text">
            {homeName} vs {awayName}
          </p>
          {match.round !== "playoff" && (
            <p className="text-xs text-muted capitalize">{match.round}-final</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted uppercase tracking-wider">Regular Time</label>
          <div className="flex items-center justify-center gap-4">
            <input
              type="number"
              min={0}
              max={99}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="input w-20 text-center text-xl font-bold"
              placeholder="0"
            />
            <span className="text-muted font-bold">:</span>
            <input
              type="number"
              min={0}
              max={99}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="input w-20 text-center text-xl font-bold"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={useET}
              onChange={(e) => setUseET(e.target.checked)}
              className="rounded border-line"
            />
            Extra Time
          </label>
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={usePen}
              onChange={(e) => setUsePen(e.target.checked)}
              className="rounded border-line"
              disabled={!useET}
            />
            Penalties
          </label>
        </div>

        {useET && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Extra Time Score</label>
            <div className="flex items-center justify-center gap-4">
              <input
                type="number"
                min={0}
                max={99}
                value={homeET}
                onChange={(e) => setHomeET(e.target.value)}
                className="input w-20 text-center font-bold"
                placeholder="0"
                disabled={usePen}
              />
              <span className="text-muted font-bold">:</span>
              <input
                type="number"
                min={0}
                max={99}
                value={awayET}
                onChange={(e) => setAwayET(e.target.value)}
                className="input w-20 text-center font-bold"
                placeholder="0"
                disabled={usePen}
              />
            </div>
          </div>
        )}

        {usePen && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted uppercase tracking-wider">Penalties Score</label>
            <div className="flex items-center justify-center gap-4">
              <input
                type="number"
                min={0}
                max={99}
                value={homePen}
                onChange={(e) => setHomePen(e.target.value)}
                className="input w-20 text-center font-bold"
                placeholder="0"
              />
              <span className="text-muted font-bold">:</span>
              <input
                type="number"
                min={0}
                max={99}
                value={awayPen}
                onChange={(e) => setAwayPen(e.target.value)}
                className="input w-20 text-center font-bold"
                placeholder="0"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted">Date</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input text-sm py-1.5"
              placeholder="DD/MM/YYYY"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Time</label>
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-muted shrink-0" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input text-sm py-1.5 flex-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Venue</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="input text-sm py-1.5"
              placeholder="Veritas Stadium"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="btn-primary w-full"
        >
          Save Result
        </button>

        <p className="text-xs text-muted text-center">
          Scores must be different to determine a winner.
        </p>
      </div>
    </div>
  );
}
