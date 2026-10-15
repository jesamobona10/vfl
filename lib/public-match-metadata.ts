import type { Metadata } from "next";
import type { PublicMatchRow } from "@/lib/types";

/**
 * Build link-preview metadata for a public match. Only team-level information
 * (names and scoreline) is used — player names are never included — so previews
 * stay safe regardless of the organization's `public_player_names_enabled` flag.
 */
export function buildPublicMatchMetadata(match: PublicMatchRow | null): Metadata {
  if (!match) return { title: "Live Match" };

  const home = match.home_team_name;
  const away = match.away_team_name;
  const hasScore =
    match.status === "completed" || match.status === "live" || match.status === "in-progress";
  const scoreline = hasScore
    ? `${home} ${match.home_score ?? 0}\u2013${match.away_score ?? 0} ${away}`
    : `${home} vs ${away}`;

  const title = hasScore
    ? `${match.home_score ?? 0}\u2013${match.away_score ?? 0}: ${home} vs ${away}`
    : `${home} vs ${away}`;

  const description =
    match.status === "live" || match.status === "in-progress"
      ? `Live score: ${scoreline}. Follow live updates on LeagueForge.`
      : match.status === "completed"
        ? `Full-time: ${scoreline}. See the match timeline on LeagueForge.`
        : `Upcoming fixture: ${scoreline}${match.venue ? ` at ${match.venue}` : ""}. Match centre on LeagueForge.`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title: scoreline,
      description,
      siteName: "LeagueForge",
    },
    twitter: {
      card: "summary_large_image",
      title: scoreline,
      description,
    },
  };
}
