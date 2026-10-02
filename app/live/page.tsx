"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";

type LiveRow = {
  match_id: number;
  round: number;
  home_team_name: string;
  away_team_name: string;
  home_team_logo?: string | null;
  away_team_logo?: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  date: string | null;
  time: string | null;
  venue: string | null;
};

export default function LiveIndexPage() {
  const [live, setLive] = useState<LiveRow[]>([]);
  const [upcoming, setUpcoming] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = createPublicClient();
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await sb
        .from("public_live")
        .select("*")
        .order("round")
        .order("match_id");

      if (!mounted) return;
      if (error) {
        setError(error.message);
        return;
      }
      const l: LiveRow[] = [];
      const u: LiveRow[] = [];
      for (const r of (data || []) as LiveRow[]) {
        if (r.status === "live" || r.status === "in-progress") l.push(r);
        else u.push(r);
      }
      setLive(l);
      setUpcoming(u);
      setLoading(false);
    }

    load();
    const id = setInterval(load, 20000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Live Matches</h1>
        <p className="text-sm text-ink-3">
          Live and today&apos;s scheduled fixtures
        </p>
      </div>

      {loading && <div className="text-sm text-muted">Loading...</div>}
      {error && <div className="text-sm text-danger">{error}</div>}

      {live.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            Live & In Progress
          </h2>
          {live.map((m) => (
            <Link
              key={m.match_id}
              href={`/live/${m.match_id}`}
              className="card p-4 flex items-center justify-between gap-4 hover:bg-surface-2/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-danger/15 text-danger border border-danger/30 animate-pulse">
                  LIVE
                </span>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-medium truncate">
                    {m.home_team_name} vs {m.away_team_name}
                  </div>
                  <div className="text-xs text-ink-3">
                    Round {m.round}
                    {[m.date, m.time, m.venue].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums shrink-0">
                {(m.home_score ?? 0)} — {(m.away_score ?? 0)}
              </div>
            </Link>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            Today
          </h2>
          {upcoming.map((m) => (
            <div key={m.match_id} className="card p-4">
              <div className="text-sm sm:text-base font-medium">
                {m.home_team_name} vs {m.away_team_name}
              </div>
              <div className="text-xs text-ink-3 mt-0.5">
                Round {m.round} · {m.status}
                {[m.date, m.time, m.venue].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && live.length === 0 && upcoming.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          No live or today&apos;s matches right now.
        </div>
      )}
    </div>
  );
}
