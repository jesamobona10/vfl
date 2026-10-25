"use client";

import { useState } from "react";
import { AlertTriangle, Clock, RefreshCw, Trophy } from "lucide-react";
import { useTeamOfRound } from "@/lib/hooks/use-team-of-round";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PlayerOfRoundCard } from "@/components/awards/player-of-round-card";
import { RoundPitch } from "@/components/awards/round-pitch";

/** Team of the Round screen: round selector, Player of the Round and the XI. */
export function TeamOfRound({
  competitionId,
  seasonId,
}: {
  competitionId: string;
  seasonId: string | null;
}) {
  const [selection, setSelection] = useState<{
    seasonId: string;
    round: number;
  } | null>(null);
  // Reset to the latest completed round whenever the season changes without
  // needing an effect (and without a stale round leaking across seasons).
  const round = selection && selection.seasonId === seasonId ? selection.round : null;

  const handleRoundChange = (value: string) => {
    if (!seasonId) return;
    setSelection({ seasonId, round: Number(value) });
  };

  const query = useTeamOfRound(competitionId, seasonId ?? undefined, round ?? undefined);

  if (!seasonId) {
    return (
      <EmptyState
        icon={Trophy}
        title="Select a season"
        description="Choose a season to view its round awards."
      />
    );
  }

  if (query.isLoading) {
    return <LoadingState label="Loading Team of the Round" />;
  }

  if (query.isError) {
    return (
      <div className="card p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 text-danger" size={32} aria-hidden="true" />
        <p className="font-semibold text-text">Could not load the Team of the Round</p>
        <p className="mt-1 text-sm text-muted">
          {query.error instanceof Error ? query.error.message : "Please try again."}
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => query.refetch()}
          leftIcon={<RefreshCw size={16} />}
        >
          Try again
        </Button>
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  const selectedRound = round ?? data.round;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Team of the Round</h2>
          <p className="text-sm text-muted">
            The best 4-3-3 from a completed round, scored by position-specific impact.
          </p>
        </div>
        {data.rounds.length > 0 && (
          <Select
            label="Round"
            containerClassName="w-full sm:w-52"
            value={selectedRound ?? ""}
            onChange={(event) => handleRoundChange(event.target.value)}
            disabled={query.isFetching}
          >
            {data.rounds.map((item) => (
              <option key={item.round} value={item.round}>
                Round {item.round}
                {item.complete ? "" : " (not complete)"}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!data.completed ? (
        <EmptyState
          icon={Clock}
          title={data.note ?? "This round is still in progress"}
          description={
            data.round != null
              ? `Round ${data.round} will be available once every fixture is completed.`
              : undefined
          }
        />
      ) : (
        <>
          {data.playerOfRound ? (
            <PlayerOfRoundCard award={data.playerOfRound} />
          ) : (
            <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-muted">
              No player met the Player of the Round criteria in this round.
            </div>
          )}

          {data.team.length > 0 ? (
            <RoundPitch team={data.team} />
          ) : (
            <EmptyState
              icon={Trophy}
              title="No XI available"
              description={data.note ?? "No players appeared in this round."}
            />
          )}

          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-medium text-text">
              How this is calculated
            </summary>
            <div className="mt-3 space-y-2 text-muted">
              <p>
                Players are scored with position-specific weights for goals, assists, saves, clean
                sheets, defensive actions, results, discipline and Player of the Match awards.
              </p>
              <p>
                The XI uses a 4-3-3. If a position group is short, the next-best player fills the
                slot and is marked <span className="font-medium text-warn">OOP</span> (out of
                position).
              </p>
              <p>Player of the Round must pass a position gate:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium text-text">GK:</span> penalty save, 5+ saves, or a
                  clean sheet with 3+ saves.
                </li>
                <li>
                  <span className="font-medium text-text">DEF:</span> 4+ defensive actions with a
                  clean sheet/contribution, or 2+ goal contributions.
                </li>
                <li>
                  <span className="font-medium text-text">MID:</span> a goal contribution plus 3
                  defensive actions, or 2+ goal contributions.
                </li>
                <li>
                  <span className="font-medium text-text">ATT:</span> a goal or 2+ assists.
                </li>
              </ul>
              <p>A red card disqualifies a player from Player of the Round.</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
