"use client";

import { createContext, useContext, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useOrgSeasons,
  useOrgSeasonTeams,
  useOrgSeasonPlayers,
  useOrgSeasonFixtures,
} from "@/lib/hooks/use-competitions";
import type { OrganizationSeason } from "@/lib/types";

interface OrgSeasonContextValue {
  seasons: OrganizationSeason[];
  selectedOrgSeasonId: string | null;
  selectedSeasonName: string | null;
  setSelectedOrgSeason: (seasonId: string) => void;
  loading: boolean;
  hasTeams: boolean;
  hasPlayers: boolean;
  hasFixtures: boolean;
  isOrgAdmin: boolean;
  isCompetitionPage: boolean;
}

const OrgSeasonContext = createContext<OrgSeasonContextValue | null>(null);

const NO_ORG_SEASON: OrgSeasonContextValue = {
  seasons: [],
  selectedOrgSeasonId: null,
  selectedSeasonName: null,
  setSelectedOrgSeason: () => {},
  loading: false,
  hasTeams: false,
  hasPlayers: false,
  hasFixtures: false,
  isOrgAdmin: false,
  isCompetitionPage: false,
};

/**
 * Safe to call outside OrgSeasonProvider.
 *
 * AppHeader is rendered by both the org layout (inside the provider) and the
 * root AppShell for non-org routes such as /admin, where no provider exists.
 * Returning an inert default keeps that second instance rendering instead of
 * throwing out of the root layout, which would take down the whole app.
 */
export function useOrgSeason(): OrgSeasonContextValue {
  return useContext(OrgSeasonContext) ?? NO_ORG_SEASON;
}

/**
 * Owns the org-level season selection across all org pages.
 *
 * The selection is persisted in the URL (`?season=<orgSeasonId>`) so it
 * survives refresh and back/forward navigation. When the selection changes,
 * season-scoped teams/players/fixtures are fetched and written into the shared
 * Zustand store, so every store-driven widget updates immediately without a
 * page refresh.
 *
 * The provider is a no-op for team/player accounts and on competition subpages
 * (`/org/[slug]/competitions/[cId]/…`), which manage their own data.
 */
export function OrgSeasonProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = (params.slug as string) || "";
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: currentOrg } = useOrg(slug);
  const { data: seasons = [] } = useOrgSeasons(slug);

  const isAdmin = useAppStore((s) => s.isAdmin);
  const userProfile = useAppStore((s) => s.userProfile);
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const setCurrentOrgSeasonId = useAppStore((s) => s.setCurrentOrgSeasonId);
  const setCurrentSeasonId = useAppStore((s) => s.setCurrentSeasonId);
  const setTeams = useAppStore((s) => s.setTeams);
  const setPlayers = useAppStore((s) => s.setPlayers);
  const setFixtures = useAppStore((s) => s.setFixtures);

  const isOrgAdmin =
    isAdmin || (userProfile?.role === "org_admin" && !currentTeamAccount);

  /**
   * Whether this role may *read* the organization's season-scoped data.
   *
   * Kept separate from isOrgAdmin on purpose: that flag gates admin-only UI and
   * mutations (fixture generation, resets, bulk entry), so widening it for
   * coaches would hand them admin controls. This one only decides whether to
   * load the data, which team accounts already have nav links for.
   */
  const canReadOrgData = isOrgAdmin || currentTeamAccount !== null;

  // Competition subpages (>=4 segments: /org/[slug]/competitions/[cId]/…) manage
  // their own season-scoped data, so the org-level provider must not interfere.
  const isCompetitionPage = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length >= 4;
  }, [pathname]);

  // Prefer the URL season; fall back to the current/first org season.
  const urlSeasonId = searchParams.get("season");
  const defaultSeason = seasons.find((s) => s.is_current) || seasons[0];
  const selectedOrgSeasonId =
    seasons.find((s) => s.id === urlSeasonId)?.id ?? defaultSeason?.id ?? null;
  const selectedSeasonName =
    seasons.find((s) => s.id === selectedOrgSeasonId)?.name ?? null;

  const previousSelectionRef = useRef({ orgSeasonId: selectedOrgSeasonId, isCompetitionPage });
  useEffect(() => {
    const previous = previousSelectionRef.current;
    previousSelectionRef.current = { orgSeasonId: selectedOrgSeasonId, isCompetitionPage };
    const seasonChanged = previous.orgSeasonId !== selectedOrgSeasonId;
    const enteredOrgSeasonView = previous.isCompetitionPage && !isCompetitionPage;
    if (isCompetitionPage || (!seasonChanged && !enteredOrgSeasonView)) return;
    // Org seasons and competition seasons are different IDs. Clear the old
    // competition-season standings key so widgets immediately use the newly
    // selected org-season data written into the store below.
    setCurrentSeasonId(null);
    setTeams([]);
    setPlayers([]);
    setFixtures([]);
  }, [selectedOrgSeasonId, isCompetitionPage, setCurrentSeasonId, setTeams, setPlayers, setFixtures]);

  // Backfill the default season into the URL so it persists across navigation.
  useEffect(() => {
    if (!isOrgAdmin) return;
    if (!selectedOrgSeasonId || urlSeasonId !== null) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("season", selectedOrgSeasonId);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [isOrgAdmin, selectedOrgSeasonId, urlSeasonId, searchParams, pathname, router]);

  // Keep the store's org-season id in sync.
  useEffect(() => {
    setCurrentOrgSeasonId(selectedOrgSeasonId);
  }, [selectedOrgSeasonId, setCurrentOrgSeasonId]);

  const shouldFetch =
    canReadOrgData && !isCompetitionPage && !!currentOrg?.id && !!selectedOrgSeasonId;

  const teamsQuery = useOrgSeasonTeams(
    shouldFetch ? currentOrg!.id : undefined,
    shouldFetch ? selectedOrgSeasonId! : undefined
  );
  const playersQuery = useOrgSeasonPlayers(
    shouldFetch ? currentOrg!.id : undefined,
    shouldFetch ? selectedOrgSeasonId! : undefined
  );
  const fixturesQuery = useOrgSeasonFixtures(
    shouldFetch ? slug : undefined,
    shouldFetch ? selectedOrgSeasonId! : undefined
  );

  const loading =
    shouldFetch &&
    (teamsQuery.isPending || playersQuery.isPending || fixturesQuery.isPending);

  // Bridge season-scoped data into the shared store so store-driven widgets
  // update immediately on season switch (no page refresh).
  useEffect(() => {
    if (!shouldFetch) return;
    if (teamsQuery.data) setTeams(teamsQuery.data);
    if (playersQuery.data) setPlayers(playersQuery.data);
    if (fixturesQuery.data) setFixtures(fixturesQuery.data);
  }, [
    shouldFetch,
    teamsQuery.data,
    playersQuery.data,
    fixturesQuery.data,
    setTeams,
    setPlayers,
    setFixtures,
  ]);

  // Clear the previous season's data the instant a user switches seasons so no
  // stale/mixed data renders while the new season's queries are in flight.
  const setSelectedOrgSeason = useCallback(
    (seasonId: string) => {
      if (seasonId === selectedOrgSeasonId) return;
      const q = new URLSearchParams(searchParams.toString());
      q.set("season", seasonId);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
      setCurrentSeasonId(null);
      setTeams([]);
      setPlayers([]);
      setFixtures([]);
    },
    [selectedOrgSeasonId, searchParams, pathname, router, setCurrentSeasonId, setTeams, setPlayers, setFixtures]
  );

  const value = useMemo(
    () => ({
      seasons,
      selectedOrgSeasonId,
      selectedSeasonName,
      setSelectedOrgSeason,
      loading,
      hasTeams: !!teamsQuery.data?.length,
      hasPlayers: !!playersQuery.data?.length,
      hasFixtures: !!fixturesQuery.data?.length,
      isOrgAdmin,
      isCompetitionPage,
    }),
    [
      seasons,
      selectedOrgSeasonId,
      selectedSeasonName,
      setSelectedOrgSeason,
      loading,
      teamsQuery.data,
      playersQuery.data,
      fixturesQuery.data,
      isOrgAdmin,
      isCompetitionPage,
    ]
  );

  return <OrgSeasonContext.Provider value={value}>{children}</OrgSeasonContext.Provider>;
}
