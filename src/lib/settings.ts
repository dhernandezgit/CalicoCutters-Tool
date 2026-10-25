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

export function applyCheckFix(settings: DesignSettings, code: string): DesignSettings {
  const line = settings.lineWidth;
  switch (code) {
    case "thin_blade":
      return applyPrintableSettings(settings);
    case "thin_tip":
      return { ...settings, tipWidth: Math.max(settings.tipWidth, line) };
    case "clearance":
      return { ...settings, stampClearance: Math.max(settings.stampClearance, line * 2) };
    case "stamp_back":
      return { ...settings, stampBack: Math.max(settings.stampBack, 5.5) };
    case "bar_width":
      return { ...settings, barWidth: Math.max(settings.barWidth, line * 3) };
    case "layer":
      return { ...settings, layerHeight: Math.min(settings.layerHeight, 0.2) };
    case "blade_depth":
      return { ...settings, bladeDepth: 12 };
    case "base_height":
      return { ...settings, baseHeight: Math.max(settings.baseHeight, 3.5) };
    case "small_details":
      return { ...settings, stampRelief: Math.min(settings.stampRelief, 2), stampBorder: true };
    case "tall_blade":
      return {
        ...settings,
        bladeThickness: Math.max(settings.bladeThickness, line * 3),
        bladeDepth: Math.min(settings.bladeDepth, 12),
      };
    case "thin_shape":
      return settings.sizeMode === "longest"
        ? { ...settings, longest: Math.min(240, settings.longest * 1.15) }
        : { ...settings, width: Math.min(240, settings.width * 1.15), height: Math.min(240, settings.height * 1.15) };
    case "bed":
      return settings.sizeMode === "longest"
        ? { ...settings, longest: Math.max(20, settings.longest * 0.85) }
        : { ...settings, width: Math.max(20, settings.width * 0.85), height: Math.max(20, settings.height * 0.85) };
    default:
      return applyPrintableSettings(settings);
  }
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
