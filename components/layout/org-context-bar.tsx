"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight, Layers } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useCompetition } from "@/lib/hooks/use-competitions";
import { useOrgSeason } from "@/components/competitions/org-season-provider";
import { OrgSeasonSelector } from "@/components/competitions/org-season-selector";

const SECTION_LABELS: Record<string, string> = {
  standings: "Standings",
  fixtures: "Schedule",
  teams: "Teams",
  players: "Players",
  results: "Final Match Results",
  settings: "Settings",
};

/**
 * Persistent context bar for organization pages.
 *
 * Tells the viewer whether they are looking at organization-wide season data or
 * a single competition's data, and hosts the organization-season switcher (the
 * competition screens own their own competition-season switcher).
 */
export function OrgContextBar() {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;

  const { data: currentOrg } = useOrg(slug);
  const {
    seasons,
    selectedOrgSeasonId,
    selectedSeasonName,
    setSelectedOrgSeason,
    isOrgAdmin,
    isCompetitionPage,
  } = useOrgSeason();

  const segments = pathname.split("/").filter(Boolean);
  const isCompetition = segments[2] === "competitions" && Boolean(segments[3]);
  const cId = isCompetition ? segments[3] : null;
  const section = isCompetition ? segments[4] : null;
  const { data: competition } = useCompetition(cId ?? undefined);

  const orgName = currentOrg?.name ?? "Organization";
  const showSeasonSwitcher = !isCompetitionPage && isOrgAdmin && seasons.length > 0;

  return (
    <div className="border-b border-line bg-surface/60">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <nav aria-label="Page context" className="flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
          <Layers size={13} className="shrink-0 text-muted" aria-hidden="true" />
          <Link
            href={`/org/${slug}/dashboard`}
            className="max-w-[12rem] truncate font-medium text-ink-2 transition-colors hover:text-brand"
          >
            {orgName}
          </Link>
          {isCompetition ? (
            <>
              <ChevronRight size={13} className="shrink-0 text-muted" aria-hidden="true" />
              <Link
                href={`/org/${slug}/competitions/${cId}`}
                className="max-w-[12rem] truncate font-medium text-ink-2 transition-colors hover:text-brand"
              >
                {competition?.name ?? "Competition"}
              </Link>
              {section && (
                <>
                  <ChevronRight size={13} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="font-semibold text-ink" aria-current="page">
                    {SECTION_LABELS[section] ?? section}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <ChevronRight size={13} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="font-semibold text-ink">
                Organization-wide{selectedSeasonName ? ` · ${selectedSeasonName}` : ""}
              </span>
            </>
          )}
        </nav>

        {showSeasonSwitcher && (
          <OrgSeasonSelector
            seasons={seasons}
            selectedSeasonId={selectedOrgSeasonId}
            onSeasonChange={setSelectedOrgSeason}
          />
        )}
      </div>
    </div>
  );
}
