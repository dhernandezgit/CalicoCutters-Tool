export const TEXT_FONTS = [
  "Arial",
  "Verdana",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
  "Comic Sans MS",
  "Brush Script MT",
] as const;

export interface TextShapeOptions {
  text: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
  connect: boolean;
  uppercase: boolean;
}

function safeStem(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "texto";
}

export async function textToPngFile(options: TextShapeOptions): Promise<File> {
  const text = (options.uppercase ? options.text.toUpperCase() : options.text).trim();
  if (!text) throw new Error("Escribe algo de texto primero.");
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }
  const fontSize = 520;
  const canvas = document.createElement("canvas");
  canvas.width = 3000;
  canvas.height = 1400;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el lienzo para el texto.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const family = options.fontFamily || "Arial";
  let size = fontSize;
  const fontFor = (px: number) => `${options.italic ? "italic " : ""}${options.bold ? "700 " : "400 "}${px}px "${family}"`;
  ctx.font = fontFor(size);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const chars = Array.from(text);
  const spacing = Number.isFinite(options.letterSpacing) ? options.letterSpacing : 0;
  let widths = chars.map((ch) => ctx.measureText(ch).width);
  let totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, chars.length - 1) * spacing;
  if (totalWidth > canvas.width - 160) {
    size = Math.max(90, Math.floor(size * (canvas.width - 160) / totalWidth));
    ctx.font = fontFor(size);
    widths = chars.map((ch) => ctx.measureText(ch).width);
    totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, chars.length - 1) * spacing;
  }
  const metrics = ctx.measureText("Hg");
  const ascent = metrics.actualBoundingBoxAscent || size * 0.75;
  const descent = metrics.actualBoundingBoxDescent || size * 0.2;
  const originX = Math.max(30, (canvas.width - totalWidth) / 2);
  const baseline = Math.max(ascent + 80, canvas.height / 2 + (ascent - descent) / 2);
  let cursor = originX;
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], cursor, baseline);
    cursor += widths[i] + spacing;
  }
  if (options.connect) {
    const barHeight = Math.max(8, size * 0.045);
    const barY = baseline + Math.max(6, descent * 0.45);
    ctx.fillRect(
      Math.max(0, originX - size * 0.035),
      Math.min(canvas.height - barHeight, barY),
      Math.min(canvas.width, totalWidth + size * 0.07),
      barHeight,
    );
  }

  // Trim transparent borders so the tracer gets a tight, high-resolution shape.
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data.data[(y * canvas.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("El texto no ha generado una silueta visible.");
  const pad = 12;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(canvas.width - 1, maxX + pad);
  maxY = Math.min(canvas.height - 1, maxY + pad);
  const trimmed = document.createElement("canvas");
  trimmed.width = maxX - minX + 1;
  trimmed.height = maxY - minY + 1;
  const tctx = trimmed.getContext("2d");
  if (!tctx) throw new Error("No se pudo recortar el texto.");
  tctx.drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  const blob = await new Promise<Blob | null>((resolve) => trimmed.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen del texto.");
  return new File([blob], `${safeStem(text)}.png`, { type: "image/png" });
}
