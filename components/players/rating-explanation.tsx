"use client";

import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

const RATING_FACTORS: Record<string, { positive: string[]; negative: string[] }> = {
  GK: {
    positive: [
      "Clean sheets (+2.0 each)",
      "Penalty saves (+3.0 each)",
      "Saves (+0.2 each)",
      "5+ saves in a match (+1.5)",
      "Match wins (+1.0 each)",
      "Man of the Match awards (+2.0 each)",
    ],
    negative: [
      "Goals conceded (−0.3 each)",
      "Errors leading to goal (−2.0 each)",
      "Red cards (−3.0 each)",
      "Yellow cards (−1.0 each)",
      "Own goals (−2.0 each)",
    ],
  },
  DEF: {
    positive: [
      "Clean sheets (+2.0 each)",
      "Tackles (+0.3 each)",
      "Interceptions (+0.2 each)",
      "Blocks (+0.3 each)",
      "Aerial duels won (+0.2 each)",
      "Goals (+3.0 each)",
      "Assists (+2.0 each)",
      "Match wins (+1.0 each)",
      "Man of the Match awards (+2.0 each)",
    ],
    negative: [
      "Errors leading to goal (−2.0 each)",
      "Goals conceded (−0.2 each)",
      "Yellow cards (−1.0 each)",
      "Red cards (−3.0 each)",
      "Own goals (−2.5 each)",
      "Penalties conceded (−2.0 each)",
    ],
  },
  MID: {
    positive: [
      "Goals (+2.0 each)",
      "Assists (+2.0 each)",
      "Tackles (+0.2 each)",
      "Interceptions (+0.15 each)",
      "Match wins (+1.0 each)",
      "Man of the Match awards (+2.0 each)",
    ],
    negative: [
      "Yellow cards (−0.5 each)",
      "Red cards (−2.0 each)",
      "Own goals (−1.5 each)",
      "Errors leading to goal (−1.5 each)",
    ],
  },
  ATT: {
    positive: [
      "Goals (+3.0 each)",
      "Assists (+2.0 each)",
      "Match wins (+1.0 each)",
      "Man of the Match awards (+2.0 each)",
    ],
    negative: [
      "Yellow cards (−0.5 each)",
      "Red cards (−2.0 each)",
      "Own goals (−2.0 each)",
      "Errors leading to goal (−1.5 each)",
    ],
  },
};

interface RatingExplanationProps {
  position: "GK" | "DEF" | "MID" | "ATT";
  className?: string;
}

export function RatingExplanation({ position, className = "" }: RatingExplanationProps) {
  const [open, setOpen] = useState(false);
  const factors = RATING_FACTORS[position];

  const positionLabels: Record<string, string> = {
    GK: "Goalkeeper",
    DEF: "Defender",
    MID: "Midfielder",
    ATT: "Attacker",
  };

  return (
    <div className={`inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-muted hover:text-text transition-colors p-1 rounded"
        aria-label={`Rating explanation for ${positionLabels[position]}`}
        aria-expanded={open}
      >
        <Info size={14} />
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 p-3 bg-popover border border-line rounded-lg shadow-lg text-xs text-text">
          <p className="font-semibold mb-2">
            {positionLabels[position]} Rating Factors
          </p>
          <p className="text-muted mb-2">
            Base rating: 6.0. Clamped 1.0–10.0.
          </p>
          <div className="space-y-2">
            <div>
              <p className="font-medium text-brand mb-1">Positive Factors</p>
              <ul className="list-disc list-inside space-y-0.5">
                {factors.positive.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-danger mb-1">Negative Factors</p>
              <ul className="list-disc list-inside space-y-0.5">
                {factors.negative.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-2 text-muted">
            Ratings update automatically from match statistics.
          </p>
        </div>
      )}
    </div>
  );
}