import type { DesignAsset } from "../types";
import { modeLabel } from "./settings";

const MM_TO_PT = 72 / 25.4;

function asciiText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pathForRing(ring: [number, number][], cx: number, cy: number, scale: number): string {
  if (ring.length < 2) return "";
  const b = ring[0];
  const x0 = cx + b[0] * scale;
  const y0 = cy - b[1] * scale;
  let out = `${x0.toFixed(2)} ${y0.toFixed(2)} m\n`;
  for (let i = 1; i < ring.length; i += 1) {
    const x = cx + ring[i][0] * scale;
    const y = cy - ring[i][1] * scale;
    out += `${x.toFixed(2)} ${y.toFixed(2)} l\n`;
  }
  return `${out}h\n`;
}

function makePdf(pageWidth: number, pageHeight: number, content: string): Blob {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}

/** A printable A4/A4-landscape outline sheet for one design. */
export function outlinePdf(asset: DesignAsset): Blob {
  const shape = asset.shape;
  const widthMm = Math.max(1, shape.bounds.width);
  const heightMm = Math.max(1, shape.bounds.height);
  const landscape = widthMm > heightMm * 1.15;
  const pageWidth = landscape ? 841.89 : 595.28;
  const pageHeight = landscape ? 595.28 : 841.89;
  const margin = 24 * MM_TO_PT;
  const titleSpace = 28 * MM_TO_PT;
  const footerSpace = 20 * MM_TO_PT;
  const availableW = pageWidth - margin * 2;
  const availableH = pageHeight - margin * 2 - titleSpace - footerSpace;
  const fit = Math.min(availableW / (widthMm * MM_TO_PT), availableH / (heightMm * MM_TO_PT));
  const scale = Math.min(1, fit) * MM_TO_PT;
  const drawingW = widthMm * scale;
  const drawingH = heightMm * scale;
  const drawingCx = pageWidth / 2;
  const drawingCy = margin + footerSpace + availableH / 2;
  const shapeCx = shape.bounds.minX + widthMm / 2;
  const shapeCy = shape.bounds.minY + heightMm / 2;

  let content = "q\n";
  // Title
  content += "BT\n/F2 18 Tf\n0.75 0.22 0.34 rg\n";
  content += `1 0 0 1 ${margin.toFixed(2)} ${(pageHeight - margin - 4).toFixed(2)} Tm\n`;
  content += `(${asciiText(asset.name)}) Tj\nET\n`;
  content += "BT\n/F1 9 Tf\n0.38 0.34 0.40 rg\n";
  content += `1 0 0 1 ${margin.toFixed(2)} ${(pageHeight - margin - 18).toFixed(2)} Tm\n`;
  content += `(${asciiText(`${modeLabel(asset.settings.mode)} · ${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm · ${fit >= 1 ? "escala 1:1" : "ajustado a A4"}`)}) Tj\nET\n`;

  // Outline and holes.
  const transform = `1 0 0 1 ${(drawingCx - shapeCx * scale).toFixed(3)} ${(drawingCy + shapeCy * scale).toFixed(3)} cm\n`;
  content += "q\n";
  content += transform;
  content += "0.72 0.25 0.38 RG\n1.1 w\n2 J\n2 j\n";
  content += pathForRing(shape.outer, 0, 0, scale);
  for (const hole of shape.holes) content += pathForRing(hole, 0, 0, scale);
  content += "S\nQ\n";

  if (shape.details.length) {
    content += "q\n";
    content += transform;
    content += "0.72 0.52 0.78 RG\n0.65 w\n";
    for (const detail of shape.details.slice(0, 250)) content += pathForRing(detail, 0, 0, scale);
    content += "S\nQ\n";
  }

  // Simple measurement brackets.
  const left = drawingCx - drawingW / 2;
  const right = drawingCx + drawingW / 2;
  const bottom = drawingCy - drawingH / 2;
  const top = drawingCy + drawingH / 2;
  content += "0.62 0.56 0.63 RG\n0.5 w\n";
  content += `${left.toFixed(2)} ${(bottom - 10).toFixed(2)} m ${right.toFixed(2)} ${(bottom - 10).toFixed(2)} l S\n`;
  content += `${left.toFixed(2)} ${(bottom - 14).toFixed(2)} m ${left.toFixed(2)} ${(bottom - 6).toFixed(2)} l S\n`;
  content += `${right.toFixed(2)} ${(bottom - 14).toFixed(2)} m ${right.toFixed(2)} ${(bottom - 6).toFixed(2)} l S\n`;
  content += `BT\n/F1 8 Tf\n0.38 0.34 0.40 rg\n1 0 0 1 ${(drawingCx - 20).toFixed(2)} ${(bottom - 21).toFixed(2)} Tm\n(${asciiText(`${widthMm.toFixed(1)} mm`)}) Tj\nET\n`;
  content += `${(left - 10).toFixed(2)} ${bottom.toFixed(2)} m ${(left - 10).toFixed(2)} ${top.toFixed(2)} l S\n`;
  content += `BT\n/F1 8 Tf\n0.38 0.34 0.40 rg\n1 0 0 1 ${(left - 38).toFixed(2)} ${(drawingCy - 3).toFixed(2)} Tm\n(${asciiText(`${heightMm.toFixed(1)} mm`)}) Tj\nET\n`;

  content += `BT\n/F1 7 Tf\n0.58 0.52 0.58 rg\n1 0 0 1 ${margin.toFixed(2)} ${(margin - 6).toFixed(2)} Tm\n(CalicoCutters - contorno de referencia - comprueba la escala antes de cortar) Tj\nET\nQ\n`;
  return makePdf(pageWidth, pageHeight, content);
}
