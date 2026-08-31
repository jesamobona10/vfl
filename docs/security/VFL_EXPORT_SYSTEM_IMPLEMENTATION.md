# VFL Export System Implementation Plan

## Objective

Fix broken and inconsistent PNG/PDF downloads across mobile, tablet, and
desktop.

The core principle is:

> **Do not export the responsive UI directly. Export a dedicated,
> fixed-dimension document layout built from the same data.**

This ensures that a user downloading standings from a 390px mobile
viewport gets the same professional output as a user downloading from a
1920px desktop screen.

------------------------------------------------------------------------

# Problem Summary

The current implementation captures the live standings table using
`html2canvas`.

Current flow:

``` text
Responsive Standings UI
        ↓
html2canvas
        ↓
PNG / PDF
```

This causes problems because the live UI contains:

-   Responsive breakpoints
-   Mobile layouts
-   Horizontal scrolling
-   Sticky columns
-   `overflow-x-auto`
-   Dynamic viewport widths
-   Theme-dependent backgrounds

Additionally, the current export utility uses a hardcoded viewport
width:

``` ts
windowWidth: 390
```

This causes wide desktop tables to be rendered inside a mobile-sized
capture environment.

------------------------------------------------------------------------

# Target Architecture

Implement the following architecture:

``` text
                         STANDINGS DATA
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
         Desktop UI        Mobile UI       Export Template
         Responsive        Responsive       Fixed Width
              │                │                │
              └────────────────┴────────────────┘
                               │
                               ▼
                         Export Engine
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
                   PNG                   PDF
```

The export template must be independent of the user's viewport.

------------------------------------------------------------------------

# Implementation Structure

Create the following structure:

``` text
components/
├── standings/
│   ├── standings-table.tsx
│   └── standings-export.tsx       ← NEW
│
components/
└── exports/
    └── export-document.tsx        ← Optional reusable wrapper

lib/
├── utils/
│   └── export.ts                  ← UPDATE
│
└── exports/
    └── export-config.ts           ← Optional
```

------------------------------------------------------------------------

# Step 1 --- Create a Dedicated Standings Export Component

Create:

``` text
components/standings/standings-export.tsx
```

The component should:

-   Use a fixed width.
-   Never use responsive breakpoints.
-   Never use sticky positioning.
-   Never use horizontal scrolling.
-   Have a controlled background.
-   Include branding and metadata.
-   Render the same standings data as the visible UI.

## Implementation

``` tsx
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
  leagueName?: string;
  seasonName?: string;
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
          fontFamily: "Arial, sans-serif",
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
```

------------------------------------------------------------------------

# Step 2 --- Replace the Export Utility

Update:

``` text
lib/utils/export.ts
```

The export utility should capture the actual dimensions of the export
component instead of forcing a mobile viewport.

## New Implementation

``` ts
async function waitForAssets(element: HTMLElement) {
  const images = Array.from(
    element.querySelectorAll("img")
  );

  await Promise.all(
    images.map((image) => {
      if (image.complete) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
    })
  );

  if ("fonts" in document) {
    await document.fonts.ready;
  }
}

async function createExportCanvas(element: HTMLElement) {
  const { default: html2canvas } = await import(
    "html2canvas"
  );

  await waitForAssets(element);

  const width = element.scrollWidth;
  const height = element.scrollHeight;

  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,

    backgroundColor: "#ffffff",

    width,
    height,

    windowWidth: width,
    windowHeight: height,

    scrollX: 0,
    scrollY: 0,

    onclone: (clonedDocument) => {
      const style = clonedDocument.createElement("style");

      style.textContent = `
        * {
          animation: none !important;
          transition: none !important;
        }

        .sticky {
          position: static !important;
          left: auto !important;
          right: auto !important;
          top: auto !important;
          bottom: auto !important;
        }

        .overflow-hidden,
        .overflow-auto,
        .overflow-x-auto,
        .overflow-y-auto {
          overflow: visible !important;
        }
      `;

      clonedDocument.head.appendChild(style);
    },
  });
}

export function exportAsJSON(
  data: unknown,
  filename: string
) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    {
      type: "application/json",
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export async function exportAsPNG(
  element: HTMLElement,
  filename: string
) {
  const canvas = await createExportCanvas(element);

  const blob = await new Promise<Blob | null>(
    (resolve) => canvas.toBlob(resolve, "image/png")
  );

  if (!blob) {
    throw new Error("Failed to generate PNG");
  }

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export async function exportAsPDF(
  element: HTMLElement,
  filename: string,
  title?: string
) {
  const [
    canvas,
    { default: jsPDF },
  ] = await Promise.all([
    createExportCanvas(element),
    import("jspdf"),
  ]);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth =
    pdf.internal.pageSize.getWidth();

  const pageHeight =
    pdf.internal.pageSize.getHeight();

  const margin = 10;

  const usableWidth =
    pageWidth - margin * 2;

  const imageHeight =
    (canvas.height * usableWidth) /
    canvas.width;

  const imageData =
    canvas.toDataURL("image/png");

  if (title) {
    pdf.setFontSize(16);
    pdf.text(title, margin, margin);
  }

  let positionY = title ? 20 : margin;

  pdf.addImage(
    imageData,
    "PNG",
    margin,
    positionY,
    usableWidth,
    imageHeight
  );

  pdf.save(filename);
}
```

------------------------------------------------------------------------

# Step 3 --- Update `standings-table.tsx`

Import the export component:

``` tsx
import { StandingsExport } from "./standings-export";
```

Create a dedicated export reference:

``` tsx
const exportRef = useRef<HTMLDivElement>(null);
```

Do not use:

``` tsx
const tableElementRef = useRef<HTMLTableElement>(null);
```

for document exports anymore.

The visible table can still use its own reference if required for other
functionality.

------------------------------------------------------------------------

# Step 4 --- Update Download Handlers

Replace the PNG handler.

## Old

``` tsx
const handleDownloadPNG = async () => {
  setMenuOpen(false);

  if (!tableElementRef.current) return;

  await exportAsPNG(
    tableElementRef.current,
    "leagueforge-standings.png"
  );
};
```

## New

``` tsx
const handleDownloadPNG = async () => {
  setMenuOpen(false);

  if (!exportRef.current) return;

  try {
    await exportAsPNG(
      exportRef.current,
      "leagueforge-standings.png"
    );
  } catch (error) {
    console.error(
      "Failed to export standings PNG:",
      error
    );
  }
};
```

Update PDF as well.

``` tsx
const handleDownloadPDF = async () => {
  setMenuOpen(false);

  if (!exportRef.current) return;

  try {
    await exportAsPDF(
      exportRef.current,
      "leagueforge-standings.pdf",
      "League Standings"
    );
  } catch (error) {
    console.error(
      "Failed to export standings PDF:",
      error
    );
  }
};
```

------------------------------------------------------------------------

# Step 5 --- Render the Export Component

Render the export component inside `StandingsTable`.

Place it near the end of the returned JSX:

``` tsx
<>
  <div className="panel">
    {/* Existing interactive standings UI */}
  </div>

  <StandingsExport
    ref={exportRef}
    standings={rows}
    teams={teams}
    leagueName="VUNA LEAGUE"
    seasonName="2026 Season"
  />
</>
```

Important:

The export component should NOT use:

``` tsx
display: none
```

Do not do:

``` tsx
<div className="hidden">
```

`html2canvas` cannot reliably capture elements with `display: none`.

Instead, the export component is positioned far outside the visible
viewport:

``` css
position: fixed;
left: -10000px;
top: 0;
```

This keeps the component rendered while remaining invisible to the user.

------------------------------------------------------------------------

# Step 6 --- Mobile Behaviour

After this implementation, mobile behaviour becomes:

``` text
User opens VFL on phone
        │
        ▼
Responsive Mobile Standings UI
        │
        ▼
User clicks Download PNG
        │
        ▼
Application uses Export Template
        │
        ▼
Export Template renders at fixed 1400px width
        │
        ▼
html2canvas captures full layout
        │
        ▼
PNG is generated
```

The user's screen width has no impact on the downloaded document.

## Expected Behaviour

  Device            Screen Width   Export Width
  --------------- -------------- --------------
  Small Android            360px         1400px
  iPhone                   390px         1400px
  Tablet                   768px         1400px
  Laptop                  1440px         1400px
  Desktop                 1920px         1400px

This guarantees consistent exports.

------------------------------------------------------------------------

# Step 7 --- Fix Team Logo Export Reliability

External team logos may fail to appear in `html2canvas` due to CORS
restrictions.

For images, use:

``` tsx
<img
  src={team.logo_url}
  crossOrigin="anonymous"
  alt=""
/>
```

The image host must also return an appropriate CORS header.

If Cloudinary is being used, ensure the image URL is publicly
accessible.

------------------------------------------------------------------------

# Step 8 --- Recommended Export Sizes

Use these fixed dimensions as a starting point.

## Standings

``` text
Width: 1400px
Padding: 48px
Scale: 2
```

## Fixtures

``` text
Width: 1400px
Padding: 48px
Scale: 2
```

## Player Statistics

``` text
Width: 1200px
Padding: 48px
Scale: 2
```

## Team Profile

``` text
Width: 1200px
Padding: 48px
Scale: 2
```

------------------------------------------------------------------------

# Step 9 --- Recommended Future Export System

As VFL grows, standardize exports.

``` text
components/
└── exports/
    ├── export-layout.tsx
    ├── standings-export.tsx
    ├── fixtures-export.tsx
    ├── player-stats-export.tsx
    ├── team-profile-export.tsx
    └── match-report-export.tsx

lib/
├── exports/
│   ├── capture.ts
│   ├── pdf.ts
│   ├── png.ts
│   ├── csv.ts
│   └── json.ts
│
└── utils/
    └── export.ts
```

All export templates should share:

-   League branding
-   Typography
-   Background
-   Header structure
-   Footer structure
-   Generated timestamp
-   Fixed document dimensions

------------------------------------------------------------------------

# Optional Improvement --- Add Export Loading State

Downloads involving `html2canvas` and `jsPDF` may take a few seconds.

Add state:

``` tsx
const [isExporting, setIsExporting] = useState(false);
```

Then:

``` tsx
const handleDownloadPNG = async () => {
  if (!exportRef.current) return;

  setIsExporting(true);

  try {
    await exportAsPNG(
      exportRef.current,
      "leagueforge-standings.png"
    );
  } catch (error) {
    console.error(error);
  } finally {
    setIsExporting(false);
  }
};
```

Disable the download button during export:

``` tsx
<button
  disabled={isExporting}
  onClick={handleDownloadPNG}
>
  {isExporting
    ? "Preparing Download..."
    : "Download PNG"}
</button>
```

------------------------------------------------------------------------

# Acceptance Criteria

The implementation is complete when all the following are true.

## Visual Consistency

-   [ ] PNG export looks identical regardless of device viewport.
-   [ ] Mobile users receive the full desktop-quality standings
    document.
-   [ ] No columns overlap.
-   [ ] No sticky columns appear incorrectly.
-   [ ] No horizontal content is clipped.
-   [ ] Team logos appear correctly.
-   [ ] Form indicators remain aligned.
-   [ ] Background colors are consistent.

## Functional

-   [ ] PNG export works on mobile.
-   [ ] PNG export works on desktop.
-   [ ] PDF export works on mobile.
-   [ ] PDF export works on desktop.
-   [ ] JSON export remains unchanged.
-   [ ] Export works with 2 teams.
-   [ ] Export works with 12 teams.
-   [ ] Export works with 20+ teams.

## Performance

-   [ ] `html2canvas` remains lazy-loaded.
-   [ ] `jspdf` remains lazy-loaded.
-   [ ] Fonts are loaded before capture.
-   [ ] Images are loaded before capture.
-   [ ] Export UI does not affect the visible page layout.

------------------------------------------------------------------------

# Final Architecture Decision

## Do Not

``` text
Responsive UI
      ↓
Screenshot
      ↓
Export
```

## Do

``` text
League Data
    │
    ├── Responsive Screen UI
    │
    └── Fixed Export UI
             │
             ├── PNG
             └── PDF
```

The export layer should be treated as a **document-generation system**,
not a screenshot of the user's current viewport.

This architecture solves the current broken standings download issue and
creates a scalable foundation for exporting fixtures, player statistics,
match reports, and team profiles throughout VFL.
