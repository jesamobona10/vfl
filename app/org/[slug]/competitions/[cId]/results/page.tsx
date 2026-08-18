"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { teamName } from "@/lib/utils/helpers";
import { completedMatches } from "@/lib/logic/standings";
import { Trophy } from "lucide-react";

export default function CompResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");
  const fixtures = useAppStore((s) => s.fixtures);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ competition_id: cId });
    if (seasonId) query.set("season_id", seasonId);

    fetch(`/api/organizations/${slug}/fixtures?${query.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.fixtures?.length) {
          setFixtures(data.fixtures);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, cId, seasonId]);

  const teams = useAppStore((s) => s.teams);
  const results = useMemo(() => completedMatches(fixtures), [fixtures]);

  if (loading) return <div className="card p-8 text-center text-muted">Loading results…</div>;

  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <Trophy size={48} className="mx-auto text-muted/30 mb-4" />
        <p className="text-muted">
          No completed matches yet. Finish a fixture to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Results</h2>
        <p className="text-sm text-muted">
          {results.length} completed match{results.length !== 1 ? "es" : ""}
        </p>
      </div>

      <div className="space-y-2">
        {results.map((match) => (
          <div key={match.id} className="card p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 justify-end text-right">
              {(() => {
                const t = teams.find((tt) => tt.id === match.homeId);
                return t?.logo_url ? (
                  <img src={t.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : null;
              })()}
              <span className="font-medium">{teamName(match.homeId, teams)}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-lg font-bold tabular-nums">{match.homeScore}</span>
              <span className="text-muted text-sm">-</span>
              <span className="text-lg font-bold tabular-nums">{match.awayScore}</span>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <span className="font-medium">{teamName(match.awayId, teams)}</span>
              {(() => {
                const t = teams.find((tt) => tt.id === match.awayId);
                return t?.logo_url ? (
                  <img src={t.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : null;
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
