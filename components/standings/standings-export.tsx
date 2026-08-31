"use client";

import React, { forwardRef } from "react";
import type { StandingRow } from "@/lib/types";

interface Team {
  id: number;
  name: string;
  logo_url?: string | null;
}

interface StandingsExportProps {
  standings: StandingRow[];
  teams: Team[];
  leagueName: string;
  seasonName: string;
}

function FormGuide({ form }: { form?: string }) {
  if (!form) {
    return <span style={{ color: "#9ca3af" }}>—</span>;
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "6px",
      }}
    >
      {form.split("").map((result, index) => {
        const background =
          result === "W"
            ? "#166534"
            : result === "D"
            ? "#d1d5db"
            : "#b91c1c";

        const color = result === "D" ? "#374151" : "#ffffff";

        return (
          <span
            key={`${result}-${index}`}
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              background,
              color,
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {result}
          </span>
        );
      })}
    </div>
  );
}

export const StandingsExport = forwardRef<
  HTMLDivElement,
  StandingsExportProps
>(
  (
    {
      standings,
      teams,
      leagueName = "VUNA LEAGUE",
      seasonName = "League Season",
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        id="standings-export"
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: "1400px",
          background: "#ffffff",
          color: "#111827",
          padding: "48px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "40px",
            paddingBottom: "24px",
            borderBottom: "3px solid #111827",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "2px",
                color: "#6b7280",
              }}
            >
              OFFICIAL LEAGUE TABLE
            </p>

            <h1
              style={{
                margin: "8px 0",
                fontSize: "40px",
                fontWeight: 800,
              }}
            >
              {leagueName}
            </h1>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                fontSize: "18px",
              }}
            >
              {seasonName} • League Standings
            </p>
          </div>

          <div
            style={{
              textAlign: "right",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            <p style={{ margin: 0 }}>Generated</p>
            <strong style={{ color: "#111827" }}>
              {new Date().toLocaleDateString()}
            </strong>
          </div>
        </header>

        {/* Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "16px",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#111827",
                color: "#ffffff",
              }}
            >
              {[
                "#",
                "TEAM",
                "RTG",
                "P",
                "W",
                "D",
                "L",
                "GF",
                "GA",
                "GD",
                "PTS",
                "FORM",
              ].map((header) => (
                <th
                  key={header}
                  style={{
                    padding: "16px 12px",
                    textAlign:
                      header === "TEAM" ? "left" : "center",
                    fontSize: "13px",
                    letterSpacing: "1px",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {standings.map((team, index) => {
              const resolvedTeam = teams.find(
                (item) => item.id === team.id
              );

              return (
                <tr
                  key={team.id}
                  style={{
                    background:
                      index === 0
                        ? "#fffbeb"
                        : index % 2 === 0
                        ? "#f9fafb"
                        : "#ffffff",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {index === 0 ? "🏆" : index + 1}
                  </td>

                  <td
                    style={{
                      padding: "16px 12px",
                      fontWeight: 700,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      {resolvedTeam?.logo_url && (
                        <img
                          src={resolvedTeam.logo_url}
                          alt=""
                          crossOrigin="anonymous"
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      )}

                      <span>{team.name}</span>
                    </div>
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "center" }}>
                    {team.rating?.toFixed(1) ?? "6.0"}
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "center" }}>
                    {team.played}
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "center" }}>
                    {team.won}
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "center" }}>
                    {team.drawn}
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "center" }}>
                    {team.lost}
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "center" }}>
                    {team.gf}
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "center" }}>
                    {team.ga}
                  </td>

                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "center",
                      fontWeight: 600,
                    }}
                  >
                    {team.gd > 0 ? `+${team.gd}` : team.gd}
                  </td>

                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "center",
                      fontWeight: 800,
                    }}
                  >
                    {team.points}
                  </td>

                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "center",
                    }}
                  >
                    <FormGuide form={team.form} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <footer
          style={{
            marginTop: "36px",
            paddingTop: "20px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            color: "#9ca3af",
            fontSize: "12px",
          }}
        >
          <span>Official League Standings</span>
          <span>Generated by VFL</span>
        </footer>
      </div>
    );
  }
);

StandingsExport.displayName = "StandingsExport";