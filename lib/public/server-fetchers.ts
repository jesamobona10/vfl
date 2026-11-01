import { createClient } from "@/lib/supabase/server";
import { getCached } from "@/lib/cache";
import { getPublicOrganizationsCached } from "@/lib/cache/public-orgs";
import type { PublicMatchRow, PublicOrganizationRow, PublicPlayerStatisticsRow, PublicSeasonRow, PublicStandingRow } from "@/lib/types";

export type PublicDashboardData = {
  organizations: PublicOrganizationRow[];
  matches: PublicMatchRow[];
  seasons: PublicSeasonRow[];
  standings: PublicStandingRow[];
  playerStatistics: PublicPlayerStatisticsRow[];
};

export async function getPublicDashboardData(): Promise<PublicDashboardData> {
  const [organizations, matches, seasons, standings, playerStatistics] = await Promise.all([
    getPublicOrganizationsCached(),
    getCached<PublicMatchRow[]>(
      "public:dashboard:matches",
      async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("public_matches")
          .select("*")
          .order("match_date", { ascending: false })
          .order("time", { ascending: true })
          .limit(100);
        return (data as PublicMatchRow[]) ?? [];
      },
      { ttl: 60, tags: ["public:matches", "public:dashboard"] }
    ),
    getCached<PublicSeasonRow[]>(
      "public:dashboard:seasons",
      async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("public_seasons")
          .select("*")
          .order("start_date", { ascending: false });
        return (data as PublicSeasonRow[]) ?? [];
      },
      { ttl: 300, tags: ["public:seasons", "public:dashboard"] }
    ),
    getCached<PublicStandingRow[]>(
      "public:dashboard:standings",
      async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("public_standings")
          .select("*")
          .order("competition_id")
          .order("position");
        return (data as PublicStandingRow[]) ?? [];
      },
      { ttl: 120, tags: ["public:standings", "public:dashboard"] }
    ),
    getCached<PublicPlayerStatisticsRow[]>(
      "public:dashboard:player-stats",
      async () => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("public_player_statistics")
          .select("*")
          .order("goals", { ascending: false })
          .order("assists", { ascending: false })
          .limit(100);
        return (data as PublicPlayerStatisticsRow[]) ?? [];
      },
      { ttl: 120, tags: ["public:player-stats", "public:dashboard"] }
    ),
  ]);

  return {
    organizations,
    matches,
    seasons,
    standings,
    playerStatistics,
  };
}

export async function getPublicMatchDetail(matchId: string) {
  const supabase = await createClient();
  const [{ data: match }, { data: events }, { data: lineups }] = await Promise.all([
    supabase
      .from("public_matches")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase
      .from("public_live_events")
      .select("*")
      .eq("match_id", matchId)
      .order("event_minute", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("public_match_lineups")
      .select("*")
      .eq("match_id", matchId)
      .order("team_id")
      .order("is_starter", { ascending: false })
      .order("jersey_number"),
  ]);

  return {
    match: (match as PublicMatchRow) ?? null,
    events: events ?? [],
    lineups: lineups ?? [],
  };
}
