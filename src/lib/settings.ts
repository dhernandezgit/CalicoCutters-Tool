import { PRINTER_PROFILES, type DesignSettings } from "../types";

export function snapToLine(value: number, line: number, minLines = 2): number {
  const step = Math.max(0.01, line);
  return Math.max(minLines * step, Math.round(value / step) * step);
}

export function applyPrintableSettings(settings: DesignSettings): DesignSettings {
  const line = settings.lineWidth;
  const profile = PRINTER_PROFILES[settings.printer];
  const minWall = Math.max(profile.minWall, line * 2);
  const bladeThickness = Math.max(minWall, snapToLine(settings.bladeThickness, line, 2));
  return {
    ...settings,
    bladeThickness,
    tipWidth: Math.max(Math.min(line, bladeThickness - 0.05), Math.min(bladeThickness - 0.05, snapToLine(settings.tipWidth, line, 1))),
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
    case "stamp_relief":
      return { ...settings, stampRelief: Math.min(settings.stampRelief, 3) };
    case "stamp_recess":
      return { ...settings, stampRelief: Math.min(settings.stampRelief, Math.max(1, settings.stampBack - 1.2)) };
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
    case "stencil_thin":
      return { ...settings, stencilThickness: Math.max(1.5, settings.stencilThickness) };
    case "stencil_margin":
      return { ...settings, stencilMargin: Math.max(3, settings.stencilMargin) };
    case "stencil_small":
      return { ...settings, stencilShapeSize: Math.max(10, settings.stencilShapeSize) };
    case "stencil_repeats":
      return {
        ...settings,
        stencilRows: Math.max(1, Math.floor(settings.stencilRows / 2)),
        stencilCols: Math.max(1, Math.floor(settings.stencilCols / 2)),
      };
    case "stencil_line":
      return { ...settings, stencilLineWidth: Math.max(1.2, settings.stencilLineWidth) };
    case "stencil_islands":
      return { ...settings, stencilBridges: true };
    case "topper_thin":
      return { ...settings, topperThickness: Math.max(4, settings.topperThickness) };
    case "topper_backing":
      return { ...settings, topperBacking: Math.max(2, settings.topperBacking) };
    case "topper_pin":
      return { ...settings, topperPinWidth: Math.max(6, settings.topperPinWidth) };
    case "topper_pin_length":
      return { ...settings, topperPinLength: Math.max(35, settings.topperPinLength) };
    case "multi_spacing":
      return { ...settings, multiSpacing: Math.max(4, settings.multiSpacing) };
    case "set_spacing":
      return { ...settings, setSpacing: Math.max(8, settings.setSpacing) };
    case "practice_wall":
      return { ...settings, practiceWallWidth: Math.max(1.2, settings.practiceWallWidth) };
    case "practice_base":
      return { ...settings, practiceThickness: Math.max(3, settings.practiceThickness) };
    case "cakepop_wall":
      return { ...settings, cakePopMoldWall: Math.max(2.4, settings.cakePopMoldWall) };
    case "cakepop_hole":
      return { ...settings, cakePopStickHole: Math.max(4.8, settings.cakePopStickHole) };
    case "cakepop_clearance":
      return { ...settings, cakePopPlungerClearance: Math.max(settings.lineWidth * 2, 0.6) };
    case "cakepop_depth":
      return { ...settings, cakePopMoldHeight: Math.max(16, settings.cakePopMoldHeight) };
    case "small_set":
      return { ...settings, setCount: Math.max(2, settings.setCount - 1) };
    case "alignment_hole":
      return { ...settings, alignmentHoleDiameter: Math.max(settings.lineWidth * 2, 1.6) };
    case "alignment_space":
      return { ...settings, baseWidth: Math.max(settings.baseWidth, settings.alignmentHoleDiameter + 1.2) };
    case "sandwich_seal":
      return { ...settings, sandwichSealWidth: Math.max(settings.lineWidth * 2, 4) };
    case "sandwich_dent":
      return { ...settings, sandwichDentDepth: Math.min(settings.sandwichDentDepth, settings.sandwichSealWidth * 0.6) };
    case "extra_blade":
      return { ...settings, extraBladeThickness: Math.max(settings.lineWidth, settings.extraBladeThickness), extraBladeDepth: Math.max(3, settings.extraBladeDepth) };
    case "roller_relief":
      return { ...settings, rollerRelief: Math.min(settings.rollerRelief, settings.rollerDiameter * 0.2) };
    case "roller_bore":
      return { ...settings, rollerBore: Math.max(0, Math.min(settings.rollerBore, settings.rollerDiameter * 0.5)) };
    case "roller_repeats":
      return {
        ...settings,
        rollerRepeatsAround: Math.max(1, Math.floor(settings.rollerRepeatsAround / 2)),
        rollerRepeatsAlong: Math.max(1, Math.floor(settings.rollerRepeatsAlong / 2)),
      };
    case "topper_relief":
      return { ...settings, topperRelief: Math.min(settings.topperRelief, Math.max(1, settings.topperThickness)) };
    case "bookmark_thin":
      return { ...settings, bookmarkThickness: Math.max(2.4, settings.bookmarkThickness) };
    case "bookmark_short":
      return { ...settings, bookmarkHeight: Math.max(100, settings.bookmarkHeight) };
    case "bookmark_relief":
      return { ...settings, bookmarkRelief: Math.min(settings.bookmarkRelief, Math.max(0.2, settings.bookmarkThickness * 0.5)) };
    case "bookmark_pivot":
      return { ...settings, pageClipLip: Math.max(0.4, Math.min(settings.pageClipLip, settings.bookmarkThickness - 0.5)) };
    case "bookmark_pivot_size":
      return { ...settings, pageClipBridge: Math.max(2, Math.min(settings.pageClipBridge, settings.bookmarkWidth * 0.3)) };
    default:
      return applyPrintableSettings(settings);
  }
}

export function modeLabel(mode: DesignSettings["mode"]): string {
  if (mode === "cutter-stamp") return "Cortador + sello";
  if (mode === "cutter") return "Cortador";
  if (mode === "stamp") return "Sello";
  if (mode === "multicutter") return "Multicortador";
  if (mode === "sandwich") return "Cortador sándwich";
  if (mode === "roller") return "Rodillo de textura";
  if (mode === "stencil") return "Plantilla stencil";
  if (mode === "topper") return "Topper para tarta";
  if (mode === "practice") return "Galleta de práctica";
  if (mode === "cakepop") return "Molde cake pop";
  if (mode === "cutter-set") return "Set de cortadores";
  if (mode === "bookmark") return "Pinza de página";
  return "Cortador con relieve";
}
