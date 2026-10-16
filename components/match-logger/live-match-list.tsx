"use client";

import type { LiveFixture } from "@/lib/types";
import { LiveMatchCard } from "./live-match-card";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
      {children}
    </h2>
  );
}

/**
 * The live/soon match list for the Match Logger landing screen (guide §4.2).
 * Splits cards into "Live now" and "Starting soon" sections.
 */
export function LiveMatchList({
  fixtures,
  slug,
}: {
  fixtures: LiveFixture[];
  slug: string;
}) {
  const live = fixtures.filter((f) => f.isLive);
  const soon = fixtures.filter((f) => !f.isLive);

  return (
    <div className="space-y-5">
      {live.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Live now</SectionLabel>
          <div className="space-y-3">
            {live.map((fixture) => (
              <LiveMatchCard key={fixture.id} fixture={fixture} slug={slug} />
            ))}
          </div>
        </section>
      )}

      {soon.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Starting soon</SectionLabel>
          <div className="space-y-3">
            {soon.map((fixture) => (
              <LiveMatchCard key={fixture.id} fixture={fixture} slug={slug} />
            ))}
          </div>
        </section>
      )}

      <p className="pt-1 text-center text-xs text-ink-3">
        You only see matches you&rsquo;re authorised to log.
      </p>
    </div>
  );
}
