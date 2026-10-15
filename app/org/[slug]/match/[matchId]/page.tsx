"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCan } from "@/lib/hooks/use-can";
import { useCompetition } from "@/lib/hooks/use-competitions";
import { MatchMode } from "@/components/match/match-mode";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import { liveSettings } from "@/lib/logic/live";
import type { Match, Team } from "@/lib/types";

interface FixtureResponse {
  match: Match;
  organizationId: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
}

export default function MatchModePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const matchId = Number(params.matchId);

  const { allowed: canEdit } = useCan("match.edit");
  const setPlayers = useAppStore((s) => s.setPlayers);
  const setTeams = useAppStore((s) => s.setTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setCurrentSeasonId = useAppStore((s) => s.setCurrentSeasonId);

  const [homeTeam, setHomeTeamLocal] = useState<Team | undefined>();
  const [awayTeam, setAwayTeamLocal] = useState<Team | undefined>();
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The live match is read from the store so every write through the
  // match-events seam (score, events, status) re-renders this screen.
  const match = useAppStore((s) =>
    s.fixtures.flatMap((r) => r.matches).find((m) => m.id === matchId)
  );

  const { data: competition } = useCompetition(competitionId ?? undefined);
  const settings = useMemo(
    () => (competition ? liveSettings(competition.settings) : undefined),
    [competition]
  );

  useEffect(() => {
    if (!Number.isFinite(matchId)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fixtures/${matchId}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) {
          if (!cancelled) setError(body?.error || "Unable to load the match.");
          return;
        }
        const data = body as FixtureResponse;
        if (cancelled) return;

        setHomeTeamLocal(data.homeTeam ?? undefined);
        setAwayTeamLocal(data.awayTeam ?? undefined);
        setCompetitionId(data.match.competition_id ?? null);

        // Bridge into the shared store so the seam can mutate the match and
        // the add-event modal can read the two teams' players.
        setTeams([data.homeTeam, data.awayTeam].filter(Boolean) as Team[]);
        setFixtures([{ round: data.match.round, byeId: null, matches: [data.match] }]);
        setCurrentSeasonId(data.match.season_id ?? null);

        if (data.organizationId) {
          const playersRes = await fetch(`/api/players?org_id=${data.organizationId}`);
          const playersBody = await playersRes.json().catch(() => null);
          if (!cancelled && playersRes.ok && Array.isArray(playersBody?.players)) {
            setPlayers(playersBody.players);
          }
        }
      } catch {
        if (!cancelled) setError("Unable to load the match.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, setTeams, setFixtures, setPlayers, setCurrentSeasonId]);

  if (!Number.isFinite(matchId)) {
    return <EmptyState title="Match unavailable" description="Invalid match." />;
  }

  if (!canEdit) {
    return (
      <EmptyState
        title="Match mode is for coaches"
        description="You do not have permission to log events for this match."
      />
    );
  }

  if (loading && !match) {
    return <LoadingState label="Loading match" />;
  }

  if (error || !match) {
    return (
      <EmptyState
        title="Match unavailable"
        description={error || "This match could not be found."}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.push(`/org/${slug}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <MatchMode
        match={match}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        settings={settings}
        onUpdated={() => {
          // Store-driven: writes already updated the store; nothing else needed.
        }}
      />
    </div>
  );
}
