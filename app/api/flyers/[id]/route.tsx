import { createServiceRoleClient } from "@/lib/supabase/service-role";
import satori from "satori";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;

async function loadFont(weight: 400 | 700) {
  const filePath = path.join(
    process.cwd(),
    "public",
    "fonts",
    `Inter-${weight === 700 ? "Bold" : "Regular"}.ttf`
  );
  return {
    name: "Inter",
    data: await fs.readFile(filePath),
    weight,
    style: "normal" as const,
  };
}

async function logoAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const ext = url.split(".").pop()?.split("?")[0] || "png";
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "TBD";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sb = createServiceRoleClient();

    const { data: match, error } = await sb
      .from("fixtures")
      .select("*, home_team:home_team_id(*), away_team:away_team_id(*)")
      .eq("id", Number(params.id))
      .single();

    if (error || !match) {
      return new Response("Match not found", { status: 404 });
    }

    const homeTeam = match.home_team as { name: string; logo_url?: string } | undefined;
    const awayTeam = match.away_team as { name: string; logo_url?: string } | undefined;

    const [homeLogo, awayLogo, fontRegular, fontBold] = await Promise.all([
      logoAsDataUrl(homeTeam?.logo_url || null),
      logoAsDataUrl(awayTeam?.logo_url || null),
      loadFont(400),
      loadFont(700),
    ]);

    const svg = await satori(
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a5d34 0%, #0f7c45 50%, #0a5d34 100%)",
          color: "white",
          fontFamily: "Inter",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 24,
            opacity: 0.8,
            marginBottom: 20,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          Match Day
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              width: 300,
            }}
          >
            {homeLogo ? (
              <img
                src={homeLogo}
                width={96}
                height={96}
                style={{ borderRadius: 12, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {homeTeam?.name?.charAt(0) || "?"}
              </div>
            )}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {homeTeam?.name || "Home"}
            </div>
          </div>

          <div style={{ fontSize: 36, fontWeight: 800, opacity: 0.3 }}>
            VS
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              width: 300,
            }}
          >
            {awayLogo ? (
              <img
                src={awayLogo}
                width={96}
                height={96}
                style={{ borderRadius: 12, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {awayTeam?.name?.charAt(0) || "?"}
              </div>
            )}
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {awayTeam?.name || "Away"}
            </div>
          </div>
        </div>

        <div
          style={{
            width: 200,
            height: 2,
            background: "rgba(255,255,255,0.2)",
            marginBottom: 24,
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 40,
            fontSize: 20,
            opacity: 0.85,
          }}
        >
          <span>{formatDate(match.date)}</span>
          <span>{match.time || "TBD"}</span>
        </div>

        <div
          style={{
            fontSize: 18,
            opacity: 0.65,
            marginTop: 12,
          }}
        >
          {match.venue || "Venue TBD"}
        </div>
      </div>,
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [fontRegular, fontBold],
      }
    );

    const png = await sharp(Buffer.from(svg)).png().toBuffer();

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="flyer-${params.id}.png"`,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Flyer generation error:", error);
    return new Response("Failed to generate flyer", { status: 500 });
  }
}
