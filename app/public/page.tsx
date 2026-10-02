"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicScheduledFixtureRow } from "@/lib/types";

type Row = PublicScheduledFixtureRow;

function fmtDateTime(d: string | null, t: string | null) {
  const parts = [d, t].filter(Boolean);
  return parts.join(" · ");
}

export default function PublicIndexPage() {
  const [fixtures, setFixtures] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = createPublicClient();
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error } = await sb
        .from("public_scheduled_fixtures")
        .select("*")
        .order("date", { ascending: true, nullsFirst: false })
        .order("time", { ascending: true, nullsFirst: false })
        .order("round", { ascending: true })
        .order("match_id", { ascending: true });

      if (!mounted) return;
      if (error) {
        setError(error.message);
        setFixtures([]);
      } else {
        setFixtures((data as Row[]) || []);
      }
      setLoading(false);
    }

    load();

    const channel = sb
      .channel("public-scheduled-fixtures")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fixtures",
        },
        () => {
          if (mounted) load();
        }
      )
      .subscribe((status) => {
        if (mounted && status !== "SUBSCRIBED") {
          // ignore; polling fallback covers
        }
      });

    const poll = setInterval(() => {
      if (mounted) load();
    }, 20000);

    return () => {
      mounted = false;
      clearInterval(poll);
      try {
        sb.removeChannel(channel);
      } catch {}
    };
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Matches</h1>
        <p className="text-sm text-ink-3">
          Scheduled fixtures with date and time
        </p>
      </div>

      {loading && <div className="text-sm text-muted">Loading...</div>}
      {error && <div className="text-sm text-danger">{error}</div>}

      {fixtures.length > 0 && (
        <div className="space-y-3">
          {fixtures.map((m) => (
            <Link
              key={m.match_id}
              href={`/public/live/${m.match_id}`}
              className="card p-4 block hover:bg-surface-2/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm sm:text-base font-medium truncate">
                    {m.home_team_name} vs {m.away_team_name}
                  </div>
                  <div className="text-xs text-ink-3 mt-0.5">
                    Round {m.round} · {m.status}
                    {fmtDateTime(m.date, m.time)
                      ? ` · ${fmtDateTime(m.date, m.time)}`
                      : ""}
                    {m.venue ? ` · ${m.venue}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold text-ink-3 shrink-0">
                  &rarr;
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && fixtures.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          No scheduled matches available right now.
        </div>
      )}
    </div>
  );
}
