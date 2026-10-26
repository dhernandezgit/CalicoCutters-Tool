import type { DesignAsset } from "../types";
import { modeLabel } from "./settings";

function ringPath(ring: [number, number][]): string {
  if (ring.length < 2) return "";
  return ring.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`).join(" ") + " Z";
}

/** Vector outline for listings, cutting sheets or further editing. */
export function outlineSvg(asset: DesignAsset): Blob {
  const b = asset.shape.bounds;
  const pad = 2;
  const viewBox = `${(b.minX - pad).toFixed(3)} ${(b.minY - pad).toFixed(3)} ${(b.width + pad * 2).toFixed(3)} ${(b.height + pad * 2).toFixed(3)}`;
  const title = asset.name.replace(/[<>&"]/g, "");
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${(b.width + pad * 2).toFixed(2)}mm" height="${(b.height + pad * 2).toFixed(2)}mm" viewBox="${viewBox}">`,
    `<title>${title} — ${modeLabel(asset.settings.mode)}</title>`,
    `<desc>Contorno vectorial generado localmente con CalicoCutters</desc>`,
    `<g fill="none" stroke="#d94f6a" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">`,
    `<path d="${[asset.shape.outer, ...asset.shape.holes].map(ringPath).join(" ")}" fill="none"/>`,
    `</g>`,
  ];
  if (asset.shape.details.length) {
    lines.push(`<g fill="none" stroke="#9b7fb6" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round">`);
    for (const detail of asset.shape.details) lines.push(`<path d="${ringPath(detail)}"/>`);
    lines.push(`</g>`);
  }
  lines.push(`</svg>`);
  return new Blob([lines.join("\n")], { type: "image/svg+xml" });
}
