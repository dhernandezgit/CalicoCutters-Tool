import type { BuildResult, DesignAsset, DesignShape } from "../types";
import { modeLabel } from "./settings";

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawRing(ctx: CanvasRenderingContext2D, ring: [number, number][], map: (p: [number, number]) => [number, number]) {
  if (ring.length < 2) return;
  const first = map(ring[0]);
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < ring.length; i += 1) {
    const point = map(ring[i]);
    ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();
}

function silhouettePath(
  ctx: CanvasRenderingContext2D,
  shape: DesignShape,
  centerX: number,
  centerY: number,
  maxSize: number,
) {
  const b = shape.bounds;
  const scale = maxSize / Math.max(1, b.width, b.height);
  const map = (p: [number, number]): [number, number] => [
    centerX + (p[0] - (b.minX + b.maxX) / 2) * scale,
    centerY - (p[1] - (b.minY + b.maxY) / 2) * scale,
  ];
  ctx.beginPath();
  drawRing(ctx, shape.outer, map);
  for (const hole of shape.holes) drawRing(ctx, hole, map);
  return { map, scale };
}

function drawDetails(ctx: CanvasRenderingContext2D, shape: DesignShape, map: (p: [number, number]) => [number, number]) {
  ctx.beginPath();
  for (const detail of shape.details) drawRing(ctx, detail, map);
}

function safeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "diseno";
}

/** Listing mockup, generated locally as a 1200 × 1200 PNG. */
export async function createMockup(asset: DesignAsset, build: BuildResult | null): Promise<{ blob: Blob; name: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el lienzo del mockup.");

  const background = ctx.createLinearGradient(0, 0, 1200, 1200);
  background.addColorStop(0, "#fff8fb");
  background.addColorStop(0.55, "#fdebf2");
  background.addColorStop(1, "#f6e6f1");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  for (let i = 0; i < 36; i += 1) {
    ctx.beginPath();
    ctx.arc(80 + (i * 193) % 1120, 90 + (i * 307) % 1020, 2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#d94f6a";
  ctx.font = "800 34px Georgia, serif";
  ctx.textBaseline = "top";
  ctx.fillText("CALICO", 78, 62);
  ctx.fillStyle = "#7e5064";
  ctx.font = "700 34px Georgia, serif";
  const calicoWidth = ctx.measureText("CALICO").width;
  ctx.fillText("CUTTERS", 78 + calicoWidth + 12, 62);
  ctx.fillStyle = "#a4889b";
  ctx.font = "700 17px system-ui, sans-serif";
  ctx.fillText("DISEÑO PARA IMPRIMIR · MOCKUP DE CATÁLOGO", 80, 112);

  ctx.save();
  ctx.shadowColor = "rgba(120, 60, 85, 0.18)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 26;
  rounded(ctx, 104, 190, 992, 760, 44);
  ctx.fillStyle = "rgba(255, 253, 253, 0.92)";
  ctx.fill();
  ctx.restore();

  const artCenterX = 600;
  const artCenterY = 520;
  const path = silhouettePath(ctx, asset.shape, artCenterX, artCenterY, 500);
  ctx.save();
  ctx.shadowColor = "rgba(120, 60, 85, 0.22)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = asset.color || "#f39ab1";
  ctx.fill("evenodd");
  ctx.restore();
  ctx.strokeStyle = "rgba(95, 55, 75, 0.38)";
  ctx.lineWidth = 3;
  ctx.stroke();

  if (asset.shape.details.length) {
    drawDetails(ctx, asset.shape, path.map);
    ctx.strokeStyle = "rgba(108, 65, 87, 0.65)";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  ctx.fillStyle = "#5e4a64";
  ctx.font = "800 58px Georgia, serif";
  const title = asset.name.length > 28 ? `${asset.name.slice(0, 27)}…` : asset.name;
  ctx.fillText(title, 80, 1002);
  ctx.fillStyle = "#a4889b";
  ctx.font = "700 21px system-ui, sans-serif";
  const width = build?.dimensions.width ?? asset.shape.bounds.width;
  const height = build?.dimensions.height ?? asset.shape.bounds.height;
  ctx.fillText(`${modeLabel(asset.settings.mode)}  ·  ${width.toFixed(1)} × ${height.toFixed(1)} mm  ·  ${asset.settings.printer === "resin" ? "Resina" : `FDM ${asset.settings.lineWidth.toFixed(2)} mm`}`, 82, 1077);
  ctx.fillStyle = "#fffdfd";
  rounded(ctx, 80, 1116, 250, 42, 21);
  ctx.fill();
  ctx.strokeStyle = "rgba(217, 79, 106, 0.34)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#d94f6a";
  ctx.font = "800 16px system-ui, sans-serif";
  ctx.fillText("PRINT READY", 104, 1128);

  ctx.fillStyle = "#a4889b";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText("Generado localmente con CalicoCutters", 80, 1172);
  ctx.textAlign = "right";
  ctx.fillText("calicocutters.studio", 1120, 1172);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo generar el mockup PNG.");
  return { blob, name: `${safeName(asset.name)}-mockup.png` };
}
