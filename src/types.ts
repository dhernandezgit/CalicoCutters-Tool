export type Point = [number, number];
export type Ring = Point[];

export type CreateMode =
  | "cutter-stamp"
  | "cutter"
  | "stamp"
  | "imprint"
  | "multicutter"
  | "sandwich"
  | "roller";

export type PrinterProfile = "fdm04" | "fdm06" | "resin";

export interface DesignSettings {
  mode: CreateMode;
  sizeMode: "longest" | "wh";
  longest: number;
  width: number;
  height: number;
  lockAspect: boolean;

  printer: PrinterProfile;
  lineWidth: number;
  layerHeight: number;
  autoPrintable: boolean;

  bladeThickness: number;
  bladeDepth: number;
  tipWidth: number;
  chamferHeight: number;
  sharpEdge: boolean;
  extraBlade: boolean;
  extraBladeDepth: number;
  extraBladeThickness: number;

  baseHeight: number;
  baseWidth: number;
  baseShape: "rect" | "chamfer" | "round";

  addPressHandle: boolean;
  pressHandleLength: number;
  pressHandleWidth: number;
  pressHandlePosition: number;

  addBar: boolean;
  barAngle: number;
  barPosition: number;
  barWidth: number;

  stampBack: number;
  stampRelief: number;
  stampClearance: number;
  stampRemoveOuterEdge: boolean;
  stampEdgeMethod: "preserve" | "offset";

  imprintDepth: number;

  multiRows: number;
  multiCols: number;
  multiSpacing: number;

  sandwichSealWidth: number;
  sandwichGap: number;
  sandwichDentSize: number;
  sandwichDentSpacing: number;
  sandwichDentDepth: number;

  rollerDiameter: number;
  rollerLength: number;
  rollerRelief: number;
  rollerBore: number;
  rollerRepeatsAround: number;
  rollerRepeatsAlong: number;
  rollerRim: number;

  /** Colour of this design in preview / 3MF. */
  color?: string;
}

export interface ShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface DesignShape {
  id: string;
  name: string;
  sourceKind: "builtin" | "svg" | "raster";
  outer: Ring;
  holes: Ring[];
  details: Ring[];
  extras: Ring[];
  bounds: ShapeBounds;
  sourceSvg?: string;
  previewUrl?: string;
  warnings: string[];
  /** Original image dimensions, when the source is a raster. */
  imageSize?: { width: number; height: number };
}

export interface BuildPart {
  name: string;
  color: string;
  stl_b64: string;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  volume: number;
  triangles: number;
  preview_offset: [number, number, number];
  assetId?: string;
  assetName?: string;
}

export interface DesignAsset {
  id: string;
  name: string;
  shape: DesignShape;
  settings: DesignSettings;
  color: string;
}

export interface BuildResult {
  parts: BuildPart[];
  warnings: string[];
  checks: PrintCheck[];
  build_ms: number;
  material_grams: number;
  dimensions: { width: number; height: number; depth: number };
}

export interface PrintCheck {
  level: "ok" | "warn" | "error";
  title: string;
  detail: string;
}

export interface BambuSettings {
  printer: string;
  bedWidth: number;
  bedDepth: number;
  separateObjects: boolean;
  colors: boolean;
  includeStl: boolean;
}

export const DEFAULT_SETTINGS: DesignSettings = {
  mode: "cutter-stamp",
  sizeMode: "longest",
  longest: 80,
  width: 80,
  height: 80,
  lockAspect: true,

  printer: "fdm04",
  lineWidth: 0.4,
  layerHeight: 0.2,
  autoPrintable: true,

  bladeThickness: 0.8,
  bladeDepth: 12,
  tipWidth: 0.4,
  chamferHeight: 2,
  sharpEdge: true,
  extraBlade: false,
  extraBladeDepth: 6,
  extraBladeThickness: 0.4,

  baseHeight: 3.5,
  baseWidth: 4,
  baseShape: "chamfer",

  addPressHandle: false,
  pressHandleLength: 26,
  pressHandleWidth: 10,
  pressHandlePosition: 50,

  addBar: false,
  barAngle: 0,
  barPosition: 50,
  barWidth: 1.2,

  stampBack: 5.5,
  stampRelief: 3,
  stampClearance: 0.8,
  stampRemoveOuterEdge: false,
  stampEdgeMethod: "preserve",

  imprintDepth: 4.5,

  multiRows: 2,
  multiCols: 2,
  multiSpacing: 4,

  sandwichSealWidth: 4,
  sandwichGap: 0.5,
  sandwichDentSize: 3,
  sandwichDentSpacing: 8,
  sandwichDentDepth: 2,

  rollerDiameter: 35,
  rollerLength: 90,
  rollerRelief: 1,
  rollerBore: 8,
  rollerRepeatsAround: 2,
  rollerRepeatsAlong: 1,
  rollerRim: 2,
};

export const PRINTER_PROFILES: Record<
  PrinterProfile,
  { label: string; lineWidth: number; layerHeight: number; minWall: number; tip: number; hole: number }
> = {
  fdm04: { label: "FDM 0,4 mm", lineWidth: 0.4, layerHeight: 0.2, minWall: 0.8, tip: 0.4, hole: 2 },
  fdm06: { label: "FDM 0,6 mm", lineWidth: 0.6, layerHeight: 0.3, minWall: 1.2, tip: 0.6, hole: 2.4 },
  resin: { label: "Resina", lineWidth: 0.05, layerHeight: 0.05, minWall: 0.6, tip: 0.3, hole: 1.2 },
};

export const BAMBU_PRINTERS: Record<string, { label: string; width: number; depth: number }> = {
  a1mini: { label: "Bambu A1 mini", width: 180, depth: 180 },
  a1: { label: "Bambu A1", width: 256, depth: 256 },
  p1p: { label: "Bambu P1P", width: 256, depth: 256 },
  p1s: { label: "Bambu P1S", width: 256, depth: 256 },
  x1c: { label: "Bambu X1 Carbon", width: 256, depth: 256 },
  x1e: { label: "Bambu X1E", width: 256, depth: 256 },
  h2d: { label: "Bambu H2D", width: 325, depth: 320 },
  other: { label: "Otra cama", width: 220, depth: 220 },
};
