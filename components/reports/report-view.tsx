"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  calculateStandings,
  allMatches,
  roundByeId,
} from "@/lib/logic/standings";
import { verifyFixtures } from "@/lib/logic/validation";
import { titleCase } from "@/lib/utils/helpers";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

export function ReportView() {
  const [copied, setCopied] = useState(false);

  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const teamName = useAppStore((s) => s.teamName);

  const report = useMemo(() => {
    const verification = verifyFixtures(fixtures, teams);
    const lines: string[] = [];
    lines.push("VUNA FOOTBALL LEAGUE REPORT");
    lines.push("");
    lines.push(`Teams: ${teams.length}`);
    lines.push(`Rounds: ${fixtures.length}`);
    lines.push(`Matches: ${allMatches(fixtures).length}`);
    lines.push(
      `Validation: ${
        fixtures.length
          ? verification.valid
            ? "Valid"
            : verification.errors.join("; ") || "Pending"
          : "Pending"
      }`
    );
    lines.push("");
    lines.push("FIXTURES");

    fixtures.forEach((round) => {
      lines.push("");
      const byeId = roundByeId(round, teams);
      lines.push(
        `Round ${round.round} | Bye: ${teamName(byeId || 0)}`
      );
      round.matches.forEach((match) => {
        const score =
          match.status === "completed" &&
          Number.isInteger(match.homeScore)
            ? ` ${match.homeScore}-${match.awayScore}`
            : "";
        const edited = match.manualEdited
          ? " | Edited"
          : match.autoAdjusted
          ? " | Auto adjusted"
          : "";
        lines.push(
          `  ${teamName(match.homeId)} vs ${teamName(
            match.awayId
          )}${score} | ${titleCase(match.status)}${
            match.date ? ` | ${match.date}` : ""
          }${match.venue ? ` | ${match.venue}` : ""}${edited}`
        );
      });
    });

    lines.push("");
    lines.push("STANDINGS");
    calculateStandings(teams, fixtures).forEach((team, index) => {
      lines.push(
        `${String(index + 1).padStart(2, " ")}. ${team.name} - ${
          team.points
        } pts, GD ${team.gd}, P ${team.played}, Rating: ${
          team.rating?.toFixed(1) || "6.0"
        }`
      );
    });

    return lines.join("\n");
  }, [teams, fixtures, teamName]);

  const handleCopy = () => {
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted">Printable reports</p>
        </div>
        <button onClick={handleCopy} className="btn-primary">
          {copied ? (
            <>
              <Check size={16} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={16} />
              Copy Report
            </>
          )}
        </button>
      </div>

      <pre className="card p-6 text-sm font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
        {report}
      </pre>
    </div>
  );
}
