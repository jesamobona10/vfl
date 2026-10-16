"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Goal } from "lucide-react";
import { useLiveFixtures } from "@/lib/hooks/use-live-fixtures";
import { useCan } from "@/lib/hooks/use-can";
import { useAppStore } from "@/lib/store";
import { useOrgSeason } from "@/components/competitions/org-season-provider";
import { RouteLoading } from "@/components/shared/route-loading";
import { ErrorBanner } from "@/components/shared/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { LiveMatchList } from "@/components/match-logger/live-match-list";
import { SyncChip, type SyncState } from "@/components/match-logger/sync-chip";
import { cn } from "@/lib/utils";

type Filter = "live" | "soon" | "mine";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
        active
          ? "bg-gold-500 text-[#1A1405]"
          : "bg-surface-2 text-ink-2 hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

export default function MatchLoggerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { allowed } = useCan("match.edit");
  const currentOrg = useAppStore((s) => s.currentOrg);
  const { selectedSeasonName } = useOrgSeason();
  const [filter, setFilter] = useState<Filter | null>(null);

  const query = useLiveFixtures(slug, { enabled: allowed });
  const fixtures = useMemo(() => query.data?.fixtures ?? [], [query.data]);
  const liveCount = query.data?.liveCount ?? 0;
  const soonCount = fixtures.length - liveCount;
  const mineCount = fixtures.filter((f) => f.isMine).length;

  useEffect(() => {
    if (!allowed) router.replace(`/org/${slug}/dashboard`);
  }, [allowed, router, slug]);

  const effectiveFilter: Filter = useMemo(() => {
    if (filter) return filter;
    if (liveCount > 0) return "live";
    if (soonCount > 0) return "soon";
    return "live";
  }, [filter, liveCount, soonCount]);

  const visible = useMemo(() => {
    if (effectiveFilter === "live") return fixtures.filter((f) => f.isLive);
    if (effectiveFilter === "soon") return fixtures.filter((f) => !f.isLive);
    return fixtures.filter((f) => f.isMine);
  }, [fixtures, effectiveFilter]);

  if (!allowed) return null;

  const syncState: SyncState = query.isError
    ? "offline"
    : query.isFetching
      ? "stale"
      : "synced";

  const seasonLabel = selectedSeasonName ?? "Current season";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-text">Match Logger</h1>
          <p className="mt-0.5 truncate text-xs text-ink-3">
            {currentOrg?.name ?? "Organization"} · {seasonLabel}
          </p>
        </div>
        <SyncChip state={syncState} className="mt-0.5" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={effectiveFilter === "live"} onClick={() => setFilter("live")}>
          Live · {liveCount}
        </FilterChip>
        <FilterChip active={effectiveFilter === "soon"} onClick={() => setFilter("soon")}>
          Soon · {soonCount}
        </FilterChip>
        <FilterChip active={effectiveFilter === "mine"} onClick={() => setFilter("mine")}>
          My team{mineCount > 0 ? ` · ${mineCount}` : ""}
        </FilterChip>
      </div>

      {query.isLoading ? (
        <RouteLoading variant="cards" />
      ) : query.isError ? (
        <div className="space-y-3">
          <ErrorBanner message="Couldn't load live matches." />
          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Goal}
          title={fixtures.length === 0 ? "No live matches right now" : "Nothing in this filter"}
          description={
            fixtures.length === 0
              ? "Matches appear here from ten minutes before kickoff. Start one from Fixtures when you're ready."
              : "Try another filter above."
          }
          action={
            fixtures.length === 0 ? (
              <Link href={`/org/${slug}/fixtures`} className="btn-secondary inline-flex items-center">
                Go to Fixtures
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => setFilter("live")}>
                Show live
              </Button>
            )
          }
        />
      ) : (
        <LiveMatchList fixtures={visible} slug={slug} />
      )}
    </div>
  );
}
