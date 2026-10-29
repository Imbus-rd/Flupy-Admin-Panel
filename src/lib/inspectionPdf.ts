import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type InspectionPdfReport = {
  title: string;
  subtitle: string;
  fileName: string;
  generatedAtLabel: string;
  generatedAt: string;
  generalTitle: string;
  scoreTitle: string;
  findingsTitle: string;
  noFindingsText: string;
  signatureTitle: string;
  inspectorLabel: string;
  cardLabel: string;
  signatureLabel: string;
  general: { label: string; value: string }[];
  groups: { name: string; rating: number; comment: string; answers: { label: string; value: string }[] }[];
  findings: { title: string; comment: string }[];
  inspectorName: string;
  inspectorCard: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function safeText(value: string) {
  return String(value || "").replace(/[\u2013\u2014]/g, "-").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = safeText(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function downloadInspectionPdf(report: InspectionPdfReport) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = rgb(0.02, 0.58, 0.53);
  const ink = rgb(0.08, 0.12, 0.17);
  const muted = rgb(0.35, 0.42, 0.5);
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 14, width: PAGE_WIDTH, height: 14, color: accent });
  };
  const ensureSpace = (height: number) => {
    if (y - height < MARGIN + 34) newPage();
  };
  const text = (value: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const indent = options.indent ?? 0;
    const gap = options.gap ?? 4;
    const lines = wrapText(value, font, size, CONTENT_WIDTH - indent);
    ensureSpace(lines.length * (size + 3) + gap);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: options.color ?? ink });
      y -= size + 3;
    }
    y -= gap;
  };
  const section = (value: string) => {
    ensureSpace(34);
    y -= 7;
    page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 22, color: rgb(0.91, 0.96, 0.95) });
    page.drawText(safeText(value), { x: MARGIN + 8, y: y + 2, size: 11, font: bold, color: accent });
    y -= 28;
  };

  newPage();
  text(report.title, { size: 20, font: bold, color: accent, gap: 2 });
  text(report.subtitle, { size: 11, color: muted, gap: 1 });
  text(`${report.generatedAtLabel}: ${report.generatedAt}`, { size: 8, color: muted, gap: 10 });

  section(report.generalTitle);
  for (const item of report.general) {
    text(`${item.label}: ${item.value || "-"}`, { size: 10, gap: 2 });
  }

  section(report.scoreTitle);
  for (const group of report.groups) {
    text(`${group.name}: ${group.rating}/5`, { size: 11, font: bold, color: group.rating < 5 ? rgb(0.72, 0.12, 0.18) : ink, gap: 1 });
    if (group.comment) text(group.comment, { size: 9, color: muted, indent: 12, gap: 2 });
    for (const answer of group.answers) {
      text(`${answer.label}: ${answer.value}`, { size: 8.5, color: muted, indent: 18, gap: 0 });
    }
    y -= 4;
  }

  section(report.findingsTitle);
  if (!report.findings.length) {
    text(report.noFindingsText, { size: 10 });
  } else {
    report.findings.forEach((finding, index) => {
      text(`${index + 1}. ${finding.title}`, { size: 10, font: bold, gap: 1 });
      if (finding.comment) text(finding.comment, { size: 9, color: muted, indent: 14, gap: 4 });
    });
  }

  ensureSpace(125);
  section(report.signatureTitle);
  text(`${report.inspectorLabel}: ${report.inspectorName}`, { size: 10, gap: 2 });
  text(`${report.cardLabel}: ${report.inspectorCard}`, { size: 10, gap: 24 });
  page.drawLine({ start: { x: MARGIN + 55, y }, end: { x: MARGIN + 295, y }, thickness: 0.8, color: ink });
  page.drawText(safeText(report.signatureLabel), { x: MARGIN + 130, y: y - 15, size: 9, font: regular, color: muted });

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    item.drawLine({ start: { x: MARGIN, y: 31 }, end: { x: PAGE_WIDTH - MARGIN, y: 31 }, thickness: 0.4, color: rgb(0.75, 0.78, 0.82) });
    item.drawText(`${index + 1} / ${pages.length}`, { x: PAGE_WIDTH - MARGIN - 28, y: 17, size: 8, font: regular, color: muted });
  });

  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = report.fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
