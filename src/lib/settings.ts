import { PRINTER_PROFILES, type DesignSettings } from "../types";

export function snapToLine(value: number, line: number, minLines = 2): number {
  const step = Math.max(0.01, line);
  return Math.max(minLines * step, Math.round(value / step) * step);
}

export function applyPrintableSettings(settings: DesignSettings): DesignSettings {
  const line = settings.lineWidth;
  const bladeThickness = Math.max(line * 2, snapToLine(settings.bladeThickness, line, 2));
  return {
    ...settings,
    bladeThickness,
    tipWidth: Math.max(line, Math.min(bladeThickness - 0.05, snapToLine(settings.tipWidth, line, 1))),
    barWidth: Math.max(line * 3, snapToLine(settings.barWidth, line, 3)),
    stampClearance: Math.max(line * 2, snapToLine(settings.stampClearance, line, 2)),
    baseWidth: Math.max(bladeThickness + line, snapToLine(settings.baseWidth, line, 2)),
  };
}

export function settingsForPrinter(settings: DesignSettings, printer: DesignSettings["printer"]): DesignSettings {
  const p = PRINTER_PROFILES[printer];
  return {
    ...settings,
    printer,
    lineWidth: p.lineWidth,
    layerHeight: p.layerHeight,
    bladeThickness: Math.max(p.minWall, p.lineWidth * 2),
    tipWidth: p.tip,
    stampClearance: Math.max(p.lineWidth * 2, 0.8),
    barWidth: Math.max(p.lineWidth * 3, 1.2),
  };
}

export function mergeSettings(
  current: DesignSettings,
  patch: Partial<DesignSettings>,
  shape?: { bounds: { width: number; height: number } } | null,
): DesignSettings {
  let next = { ...current, ...patch };
  if (patch.printer && patch.printer !== current.printer && current.autoPrintable) {
    next = settingsForPrinter(next, patch.printer);
  }
  if (patch.sizeMode === "wh" && patch.width === undefined && patch.height === undefined) {
    const ratio = shape ? shape.bounds.height / Math.max(shape.bounds.width, 1e-6) : 1;
    next.width = Number(current.longest.toFixed(1));
    next.height = Number((current.longest * ratio).toFixed(1));
  }
  return next;
}

export function modeLabel(mode: DesignSettings["mode"]): string {
  if (mode === "cutter-stamp") return "Stamper + cortador";
  if (mode === "cutter") return "Solo cortador";
  if (mode === "stamp") return "Solo sello";
  if (mode === "multicutter") return "Puzzle";
  if (mode === "sandwich") return "Sándwich";
  if (mode === "roller") return "Rodillo";
  return "Impronta";
}
