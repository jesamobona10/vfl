import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

export async function exportAsPNG(
  element: HTMLElement,
  filename: string,
  width = 390
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: width,
    onclone: (doc) => {
      const style = doc.createElement("style");
      style.textContent = `[class*="max-w-"] { max-width: 100% !important; width: 100% !important; }`;
      doc.head.appendChild(style);
    },
  });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAsPDF(
  element: HTMLElement,
  filename: string,
  title?: string
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("l", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (title) {
    pdf.setFontSize(14);
    pdf.text(title, 10, 10);
    const remaining = pageHeight - 20;
    if (imgHeight > remaining) {
      const adjustedHeight = remaining;
      const adjustedWidth = (canvas.width * adjustedHeight) / canvas.height;
      const xOffset = (pageWidth - adjustedWidth) / 2;
      pdf.addImage(imgData, "PNG", xOffset, 15, adjustedWidth, adjustedHeight);
    } else {
      pdf.addImage(imgData, "PNG", 10, 15, imgWidth, imgHeight);
    }
  } else {
    if (imgHeight > pageHeight - 20) {
      const adjustedHeight = pageHeight - 20;
      const adjustedWidth = (canvas.width * adjustedHeight) / canvas.height;
      const xOffset = (pageWidth - adjustedWidth) / 2;
      pdf.addImage(imgData, "PNG", xOffset, 10, adjustedWidth, adjustedHeight);
    } else {
      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
    }
  }

  pdf.save(filename);
}
