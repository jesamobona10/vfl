const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Try using Windows built-in PDF printer via msedge in a simpler way
const htmlPath = path.resolve(__dirname, "PROJECT-DOCUMENTATION.html");
const pdfPath = path.resolve(__dirname, "PROJECT-DOCUMENTATION.pdf");

// Create a URL file to open in Edge
const urlContent = `[InternetShortcut]\nURL=file:///${htmlPath.replace(/\\/g, "/")}`;
fs.writeFileSync(path.join(__dirname, "__open.url"), urlContent);

console.log("=== PDF Generation Instructions ===");
console.log("");
console.log("The documentation has been saved to:");
console.log("  " + htmlPath);
console.log("");
console.log("To convert to PDF, open the HTML file in a browser and press Ctrl+P:");
console.log("  1. Open the HTML file above in Edge or Chrome");
console.log("  2. Press Ctrl+P (Print)");
console.log("  3. Select 'Save as PDF' as the printer");
console.log("  4. Click Save");
console.log("");
console.log("Alternatively, a markdown file is available at:");
console.log("  " + path.resolve(__dirname, "PROJECT-DOCUMENTATION.md"));

// Also generate a simple text-based PDF using jspdf as a fallback
try {
  const { jsPDF } = require("jspdf");
  const md = fs.readFileSync(path.join(__dirname, "PROJECT-DOCUMENTATION.md"), "utf-8");
  
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageH = 297;
  const margin = 20;
  const maxW = 170;
  let y = margin;
  let pageNum = 1;
  
  function checkPage(size) {
    if (y + size > pageH - margin) {
      doc.setFontSize(8);
      doc.setTextColor("#999");
      doc.text(`Page ${pageNum}`, 105, pageH - 8, { align: "center" });
      doc.addPage();
      pageNum++;
      y = margin;
    }
  }
  
  function addLine(text, size = 9, style = "normal", color = "#333") {
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      checkPage(size * 0.4);
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      doc.setTextColor(color);
      doc.text(line, margin, y);
      y += size * 0.4 + 0.5;
    }
  }
  
  // Title page
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#1a1a2e");
  doc.text("VUNA Football League", 105, 90, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#555");
  doc.text("Management System - Project Documentation", 105, 102, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor("#999");
  doc.text("Next.js 14 / Zustand / Supabase / Tailwind CSS", 105, 114, { align: "center" });
  doc.addPage();
  
  const lines = md.split("\n");
  let inCode = false;
  let codeBuf = "";
  
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    
    if (t.startsWith("```")) {
      if (inCode) {
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        doc.setTextColor("#333");
        const codeLines = doc.splitTextToSize(codeBuf, maxW - 4);
        for (const cl of codeLines) {
          checkPage(8 * 0.35);
          doc.text(cl, margin + 2, y);
          y += 8 * 0.35 + 0.3;
        }
        codeBuf = "";
        inCode = false;
        y += 2;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf += (codeBuf ? "\n" : "") + raw;
      continue;
    }
    
    if (!t) { y += 2; continue; }
    if (t === "---") { y += 3; continue; }
    
    const hMatch = t.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = { 1: 18, 2: 14, 3: 12, 4: 11, 5: 10, 6: 9 };
      const colors = { 1: "#1a1a2e", 2: "#1a1a2e", 3: "#333", 4: "#333", 5: "#444", 6: "#555" };
      const weights = { 1: "bold", 2: "bold", 3: "bold", 4: "bold", 5: "bold", 6: "normal" };
      y += level === 1 ? 6 : level === 2 ? 5 : 3;
      addLine(hMatch[2], sizes[level], weights[level], colors[level]);
      if (level <= 2) y += 1;
      continue;
    }
    
    if (t.startsWith("- ")) {
      addLine("  \u2022 " + t.slice(2), 8, "normal", "#444");
      continue;
    }
    
    if (/^\d+\.\s/.test(t)) {
      addLine("  " + t, 8, "normal", "#444");
      continue;
    }
    
    if (t.startsWith("|") && t.endsWith("|") && !t.includes("---")) {
      const cells = t.split("|").filter(c => c.trim()).map(c => c.trim()).join(" | ");
      const isHeader = /[A-Z]/.test(t[1] || "");
      addLine(cells, 7, isHeader ? "bold" : "normal", isHeader ? "#1a1a2e" : "#444");
      continue;
    }
    
    if (t.startsWith("[Table of Contents]") || t.startsWith("## Table")) {
      continue;
    }
    
    addLine(t.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, ""), 8, "normal", "#333");
  }
  
  doc.setFontSize(8);
  doc.setTextColor("#999");
  doc.text(`Page ${pageNum}`, 105, pageH - 8, { align: "center" });
  
  const pdfPathSimple = path.join(__dirname, "PROJECT-DOCUMENTATION.pdf");
  doc.save(pdfPathSimple);
  const stats = fs.statSync(pdfPathSimple);
  console.log("");
  console.log("A basic text PDF has also been generated:");
  console.log("  " + pdfPathSimple + " (" + (stats.size / 1024).toFixed(0) + " KB, " + pageNum + " pages)");
  console.log("");
  console.log("For best results, use the HTML + Print to PDF method above.");
  
} catch (e) {
  console.log("");
  console.log("Note: jspdf-based PDF generation skipped:", e.message);
}
