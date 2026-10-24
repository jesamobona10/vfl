import type { FixtureRound, Match, Team } from "@/lib/types";

/**
 * Export utilities for downloading standings/fixtures as JSON, PNG, or PDF.
 *
 * `jspdf` and `html2canvas` are loaded lazily inside each export function so
 * that pages importing this module (e.g. standings, fixtures) are not penalised
 * with their ~530 KB combined bundle cost up-front.
 */

export function exportAsJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Wait for all images and fonts to load within an element before capturing.
 */
async function waitForAssets(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll("img"));

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

/**
 * Create a canvas from an element using html2canvas with proper settings.
 */
async function createExportCanvas(element: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");

  await waitForAssets(element);

  const width = element.scrollWidth;
  const height = element.scrollHeight;

  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,

    backgroundColor: "#0b1020",

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
          box-shadow: none !important;
        }

        html, body {
          background: #0b1020 !important;
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
        .overflow-y-auto,
        .overflow-scroll {
          overflow: visible !important;
        }

        .rounded-xl,
        .rounded-lg,
        .rounded {
          border-radius: 12px !important;
        }
      `;

      clonedDocument.head.appendChild(style);
    },
  });
}

export async function exportAsPNG(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const canvas = await createExportCanvas(element);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );

  if (!blob) {
    throw new Error("Failed to generate PNG");
  }

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

export async function exportAsPDF(
  element: HTMLElement,
  filename: string,
  title?: string
): Promise<void> {
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

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 10;

  const usableWidth = pageWidth - margin * 2;

  const imageHeight = (canvas.height * usableWidth) / canvas.width;

  const imageData = canvas.toDataURL("image/png");

  if (title) {
    pdf.setFontSize(16);
    pdf.text(title, margin, margin);
  }

  let positionY = title ? 20 : margin;

  // Check if content fits on one page
  const remainingHeight = pageHeight - positionY;
  if (imageHeight > remainingHeight) {
    // Need multiple pages - split the image
    const scale = canvas.width / canvas.height;
    let sourceY = 0;
    let isFirstPage = true;

    while (sourceY < canvas.height) {
      if (!isFirstPage) {
        pdf.addPage();
        positionY = margin;
      }

      const pageRemainingHeight = pageHeight - positionY;
      const destHeight = Math.min(
        imageHeight - (sourceY / canvas.height) * imageHeight,
        pageRemainingHeight
      );
      const sourceHeight = (destHeight * canvas.height) / imageHeight;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = sourceHeight;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sourceHeight,
        0,
        0,
        canvas.width,
        sourceHeight
      );

      const pageImageData = tempCanvas.toDataURL("image/png");
      const pageUsableWidth = pdf.internal.pageSize.getWidth() - margin * 2;

      pdf.addImage(
        pageImageData,
        "PNG",
        margin,
        positionY,
        pageUsableWidth,
        destHeight
      );

      sourceY += sourceHeight;
      isFirstPage = false;
    }
  } else {
    pdf.addImage(
      imageData,
      "PNG",
      margin,
      positionY,
      usableWidth,
      imageHeight
    );
  }

  pdf.save(filename);
}

function displayFixtureDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date || "TBA";
}

function fixtureStatus(status: Match["status"]) {
  if (status === "completed") return "Full-time";
  if (status === "live" || status === "in-progress") return "Live";
  return "Scheduled";
}

/**
 * Export fixtures as a readable, selectable-text table instead of taking a
 * screenshot of the responsive card UI (which clips team names and scales poorly).
 */
export async function exportFixturesAsPDF(
  rounds: FixtureRound[],
  teams: Team[],
  filename: string,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;
  const columns = [18, 27, 19, 49, 20, 49, 56, 35];
  const headings = ["Round", "Date", "Kickoff", "Home team", "Score", "Away team", "Venue", "Status"];
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const matches = rounds.flatMap((round) => round.matches.map((match) => ({ round: round.round, match })));
  const headerHeight = 9;
  const tableTop = 38;
  const bottomLimit = pageHeight - 15;

  const drawPageHeading = (continuation = false) => {
    pdf.setFillColor(14, 91, 57);
    pdf.roundedRect(margin, 8, tableWidth, 24, 3, 3, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text(continuation ? "Fixtures (continued)" : "Fixtures", margin + 6, 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      `${matches.length} ${matches.length === 1 ? "match" : "matches"} | ${rounds.length} ${rounds.length === 1 ? "round" : "rounds"}`,
      margin + 6,
      26,
    );
    pdf.setTextColor(26, 44, 34);
  };

  const drawTableHeader = (top: number) => {
    pdf.setFillColor(29, 49, 39);
    pdf.roundedRect(margin, top, tableWidth, headerHeight, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    let x = margin;
    headings.forEach((heading, index) => {
      const textOptions = index === 4
        ? { align: "center" as const, maxWidth: columns[index] - 3 }
        : { maxWidth: columns[index] - 4 };
      pdf.text(heading, index === 4 ? x + columns[index] / 2 : x + 2, top + 5.8, textOptions);
      x += columns[index];
    });
    pdf.setTextColor(26, 44, 34);
    pdf.setFont("helvetica", "normal");
  };

  const drawCellLines = (value: string, width: number, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    return pdf.splitTextToSize(value || "TBA", width - 4) as string[];
  };

  drawPageHeading();
  let y = tableTop;
  drawTableHeader(y);
  y += headerHeight;

  matches.forEach(({ round, match }, rowIndex) => {
    const cells = [
      `Round ${round}`,
      displayFixtureDate(match.date),
      match.time || "TBA",
      teamNames.get(match.homeId) || `Team ${match.homeId}`,
      match.homeScore !== null && match.awayScore !== null ? `${match.homeScore} - ${match.awayScore}` : "vs",
      teamNames.get(match.awayId) || `Team ${match.awayId}`,
      match.venue || "Venue TBA",
      fixtureStatus(match.status),
    ];
    let colX = margin;
    const cellLines = cells.map((cell, index) => {
      const lines = drawCellLines(cell, columns[index], index === 4);
      colX += columns[index];
      return lines;
    });
    const lineCount = Math.max(...cellLines.map((lines) => lines.length));
    const rowHeight = Math.max(10, lineCount * 4 + 4);

    if (y + rowHeight > bottomLimit) {
      pdf.addPage();
      drawPageHeading(true);
      y = tableTop;
      drawTableHeader(y);
      y += headerHeight;
    }

    pdf.setFillColor(
      rowIndex % 2 === 0 ? 248 : 239,
      rowIndex % 2 === 0 ? 251 : 245,
      rowIndex % 2 === 0 ? 248 : 240,
    );
    pdf.rect(margin, y, tableWidth, rowHeight, "F");
    pdf.setDrawColor(220, 228, 221);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);

    colX = margin;
    cellLines.forEach((lines, index) => {
      const isScore = index === 4;
      const isStatus = index === 7;
      pdf.setFont("helvetica", isScore ? "bold" : "normal");
      pdf.setFontSize(isScore ? 9 : 8);
      if (isStatus) {
        const status = match.status;
        pdf.setTextColor(
          status === "completed" ? 77 : status === "scheduled" ? 14 : 182,
          status === "completed" ? 93 : status === "scheduled" ? 120 : 75,
          status === "completed" ? 81 : status === "scheduled" ? 57 : 39,
        );
      } else {
        pdf.setTextColor(26, 44, 34);
      }
      const textX = isScore ? colX + columns[index] / 2 : colX + 2;
      pdf.text(lines, textX, y + 4.8, {
        align: isScore ? "center" : "left",
        maxWidth: columns[index] - 4,
        lineHeightFactor: 1.05,
      });
      colX += columns[index];
    });
    y += rowHeight;
  });

  const pageCount = Math.max(1, pdf.internal.pages.length - 1);
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(105, 120, 109);
    pdf.text("LeagueForge - Fixture schedule", margin, pageHeight - 7);
    pdf.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }
  pdf.save(filename);
}
