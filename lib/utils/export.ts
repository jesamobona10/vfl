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