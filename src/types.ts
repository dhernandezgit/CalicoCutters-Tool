export type Point = [number, number];
export type Ring = Point[];

export type CreateMode =
  | "cutter-stamp"
  | "cutter"
  | "stamp"
  | "imprint"
  | "multicutter"
  | "sandwich"
  | "roller"
  | "stencil"
  | "topper"
  | "practice"
  | "cakepop"
  | "cutter-set"
  | "bookmark";

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
  bedModel: string;
  bedWidth: number;
  bedDepth: number;

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
  pressHandlesBothEnds: boolean;

  addBar: boolean;
  barAngle: number;
  barPosition: number;
  barWidth: number;

  stampBack: number;
  stampRelief: number;
  stampClearance: number;
  stampRemoveOuterEdge: boolean;
  stampRecessed: boolean;
  stampEdgeMethod: "preserve" | "offset";
  stampBorder: boolean;
  stampBorderWidth: number;
  mirror: boolean;
  mirrorPair: boolean;

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

  stencilWidth: number;
  stencilHeight: number;
  stencilRows: number;
  stencilCols: number;
  stencilSpacing: number;
  stencilMargin: number;
  stencilShapeSize: number;
  stencilPattern: "grid" | "diagonal" | "random";
  stencilBridges: boolean;
  stencilBridgeWidth: number;
  stencilThickness: number;

  topperThickness: number;
  topperRelief: number;
  topperBacking: number;
  topperPinLength: number;
  topperPinWidth: number;
  topperPinPosition: number;
  topperInvert: boolean;

  practiceThickness: number;
  practiceWallHeight: number;
  practiceWallWidth: number;

  bookmarkWidth: number;
  bookmarkHeight: number;
  bookmarkThickness: number;
  bookmarkCorner: number;
  bookmarkMargin: number;
  bookmarkHole: boolean;
  bookmarkHoleDiameter: number;
  bookmarkHoleMargin: number;
  bookmarkRelief: number;
  bookmarkDesignStyle: "line" | "relief" | "none";

  cakePopMoldHeight: number;
  cakePopMoldWall: number;
  cakePopBase: number;
  cakePopStickHole: number;
  cakePopHoleClearance: number;
  cakePopPlungerClearance: number;
  cakePopPlungerBack: number;
  cakePopRelief: number;

  setCount: number;
  setStep: number;
  setSpacing: number;

  preprocessSmooth: boolean;
  preprocessAmount: number;
  preprocessSimplify: number;
  preprocessPreserveCorners: boolean;
  preprocessSmoothDetails: boolean;
  preprocessRemoveTiny: boolean;
  preprocessMinDetail: number;

  alignmentHole: boolean;
  alignmentHoleDiameter: number;

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
  /** Colour sampled from the artwork; neutral black becomes Calico pink. */
  sourceColor?: string;
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
  code?: string;
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
  bedModel: "bambu-p2s",
  bedWidth: 256,
  bedDepth: 256,

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
  pressHandlesBothEnds: false,

  addBar: false,
  barAngle: 0,
  barPosition: 50,
  barWidth: 1.2,

  stampBack: 5.5,
  stampRelief: 3,
  stampClearance: 0.8,
  stampRemoveOuterEdge: false,
  stampRecessed: false,
  stampEdgeMethod: "preserve",
  stampBorder: true,
  stampBorderWidth: 1.6,
  mirror: false,
  mirrorPair: false,

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

  stencilWidth: 100,
  stencilHeight: 100,
  stencilRows: 3,
  stencilCols: 3,
  stencilSpacing: 3,
  stencilMargin: 3,
  stencilShapeSize: 15,
  stencilPattern: "grid",
  stencilBridges: true,
  stencilBridgeWidth: 1.2,
  stencilThickness: 1.5,

  topperThickness: 5,
  topperRelief: 2,
  topperBacking: 2,
  topperPinLength: 40,
  topperPinWidth: 6,
  topperPinPosition: 0,
  topperInvert: false,

  practiceThickness: 3,
  practiceWallHeight: 8,
  practiceWallWidth: 1.4,

  bookmarkWidth: 50,
  bookmarkHeight: 150,
  bookmarkThickness: 2.4,
  bookmarkCorner: 6,
  bookmarkMargin: 6,
  bookmarkHole: true,
  bookmarkHoleDiameter: 6,
  bookmarkHoleMargin: 10,
  bookmarkRelief: 0.8,
  bookmarkDesignStyle: "line",

  cakePopMoldHeight: 18,
  cakePopMoldWall: 2.4,
  cakePopBase: 2,
  cakePopStickHole: 4.8,
  cakePopHoleClearance: 0.4,
  cakePopPlungerClearance: 0.6,
  cakePopPlungerBack: 2.5,
  cakePopRelief: 2,

  setCount: 3,
  setStep: 0.18,
  setSpacing: 10,

  preprocessSmooth: false,
  preprocessAmount: 0.25,
  preprocessSimplify: 0.12,
  preprocessPreserveCorners: false,
  preprocessSmoothDetails: false,
  preprocessRemoveTiny: false,
  preprocessMinDetail: 0.8,

  alignmentHole: true,
  alignmentHoleDiameter: 1.8,
};

export const PRINTER_PROFILES: Record<
  PrinterProfile,
  { label: string; lineWidth: number; layerHeight: number; minWall: number; tip: number; hole: number }
> = {
  fdm04: { label: "FDM 0,4 mm", lineWidth: 0.4, layerHeight: 0.2, minWall: 0.8, tip: 0.4, hole: 2 },
  fdm06: { label: "FDM 0,6 mm", lineWidth: 0.6, layerHeight: 0.3, minWall: 1.2, tip: 0.6, hole: 2.4 },
  resin: { label: "Resina", lineWidth: 0.05, layerHeight: 0.05, minWall: 0.6, tip: 0.3, hole: 1.2 },
};

export const PRINTER_BEDS: Record<string, { label: string; width: number; depth: number }> = {
  "bambu-p2s": { label: "Bambu Lab P2S", width: 256, depth: 256 },
  "bambu-a1mini": { label: "Bambu Lab A1 mini", width: 180, depth: 180 },
  "bambu-a1": { label: "Bambu Lab A1", width: 256, depth: 256 },
  "bambu-p1p": { label: "Bambu Lab P1P", width: 256, depth: 256 },
  "bambu-p1s": { label: "Bambu Lab P1S", width: 256, depth: 256 },
  "bambu-x1c": { label: "Bambu Lab X1 Carbon", width: 256, depth: 256 },
  "bambu-x1e": { label: "Bambu Lab X1E", width: 256, depth: 256 },
  "bambu-h2d": { label: "Bambu Lab H2D", width: 325, depth: 320 },
  "bambu-h2s": { label: "Bambu Lab H2S", width: 350, depth: 320 },
  "prusa-mk4": { label: "Prusa MK4 / MK3S+", width: 250, depth: 210 },
  "prusa-mini": { label: "Prusa MINI+", width: 180, depth: 180 },
  "prusa-xl": { label: "Prusa XL", width: 360, depth: 360 },
  "creality-ender3": { label: "Creality Ender-3", width: 220, depth: 220 },
  "creality-k1": { label: "Creality K1", width: 220, depth: 220 },
  "creality-k1max": { label: "Creality K1 Max", width: 300, depth: 300 },
  "creality-k2plus": { label: "Creality K2 Plus", width: 350, depth: 350 },
  "elegoo-neptune4": { label: "Elegoo Neptune 4", width: 235, depth: 235 },
  "elegoo-neptune4max": { label: "Elegoo Neptune 4 Max", width: 300, depth: 300 },
  "anycubic-kobra2": { label: "Anycubic Kobra 2", width: 220, depth: 220 },
  "anycubic-kobra2max": { label: "Anycubic Kobra 2 Max", width: 300, depth: 300 },
  "sovol-sv06": { label: "Sovol SV06", width: 220, depth: 220 },
  "sovol-sv07": { label: "Sovol SV07", width: 300, depth: 300 },
  "qidi-xplus3": { label: "QIDI X-Plus 3", width: 280, depth: 280 },
  "qidi-xmax3": { label: "QIDI X-Max 3", width: 325, depth: 325 },
  "voron24": { label: "Voron 2.4 (350)", width: 350, depth: 350 },
  "artillery-x2": { label: "Artillery Sidewinder X2", width: 300, depth: 300 },
  custom: { label: "Cama personalizada", width: 256, depth: 256 },
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
