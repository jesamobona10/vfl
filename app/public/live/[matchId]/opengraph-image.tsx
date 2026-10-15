import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicMatchRow } from "@/lib/types";

export const alt = "Match scoreline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadMatch(matchId: string): Promise<PublicMatchRow | null> {
  const id = Number(matchId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const { data } = await createPublicClient()
    .from("public_matches")
    .select("*")
    .eq("match_id", id)
    .maybeSingle();
  return (data as PublicMatchRow | null) ?? null;
}

function statusLabel(match: PublicMatchRow) {
  if (match.status === "live" || match.status === "in-progress") return "LIVE";
  if (match.status === "completed") return "FULL-TIME";
  return "UPCOMING";
}

export default async function Image({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const match = await loadMatch(matchId);

  // The OG image intentionally shows only team names and the scoreline — never
  // player names — so link previews stay privacy-safe.
  const home = match?.home_team_name ?? "Home";
  const away = match?.away_team_name ?? "Away";
  const hasScore = Boolean(match && match.status !== "scheduled");
  const homeScore = match?.home_score ?? 0;
  const awayScore = match?.away_score ?? 0;
  const headline = hasScore ? `${homeScore} – ${awayScore}` : "VS";
  const subtitle = match?.competition_name || "Match Centre";
  const meta = match
    ? `${statusLabel(match)}${match.venue ? ` · ${match.venue}` : ""}`
    : "Match Centre";

  const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0f3d27 0%, #061f14 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
            League<span style={{ color: "#4ade80" }}>Forge</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#bbf7d0" }}>{subtitle}</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: 380 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 132,
                height: 132,
                borderRadius: 9999,
                background: "rgba(255,255,255,0.12)",
                fontSize: 60,
                fontWeight: 700,
              }}
            >
              {initial(home)}
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 600, textAlign: "center" }}>{home}</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 48px",
                borderRadius: 32,
                background: "rgba(255,255,255,0.10)",
                border: "2px solid rgba(74,222,128,0.4)",
                fontSize: 96,
                fontWeight: 800,
              }}
            >
              {headline}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: 380 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 132,
                height: 132,
                borderRadius: 9999,
                background: "rgba(255,255,255,0.12)",
                fontSize: 60,
                fontWeight: 700,
              }}
            >
              {initial(away)}
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 600, textAlign: "center" }}>{away}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", fontSize: 30, color: "#bbf7d0" }}>{meta}</div>
      </div>
    ),
    size
  );
}
