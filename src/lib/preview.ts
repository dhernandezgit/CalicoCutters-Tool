export type SurfaceStyle =
  | "ivory"
  | "blush"
  | "sage"
  | "sky"
  | "lemon"
  | "lilac"
  | "peach"
  | "mauve"
  | "midnight"
  | "forest"
  | "wine"
  | "slate"
  | "cocoa"
  | "rose"
  | "white-marble"
  | "dark-marble"
  | "wood"
  | "custom";

export interface SurfaceOption {
  id: SurfaceStyle;
  label: string;
  group: "Claro" | "Oscuro" | "Texturas" | "Personalizado";
  top: string;
  body: string;
  grid: string;
  gridStrong: string;
  border: string;
  texture?: "marble" | "dark-marble" | "wood";
  swatch?: string;
}

export const SURFACE_OPTIONS: SurfaceOption[] = [
  { id: "ivory", label: "Marfil", group: "Claro", top: "#f8f2e8", body: "#d8cdbf", grid: "#c7b9a5", gridStrong: "#fdfaf5", border: "#b6a68f", swatch: "#f8f2e8" },
  { id: "blush", label: "Rosa suave", group: "Claro", top: "#f6dce4", body: "#d7b2bf", grid: "#d2a2b2", gridStrong: "#fff8fb", border: "#c18a9e", swatch: "#f6dce4" },
  { id: "sage", label: "Salvia", group: "Claro", top: "#dde9da", body: "#b2c3ad", grid: "#9fb49a", gridStrong: "#f8fcf6", border: "#879d82", swatch: "#dde9da" },
  { id: "sky", label: "Cielo", group: "Claro", top: "#dce9f4", body: "#aec2d1", grid: "#9db3c2", gridStrong: "#f7fbff", border: "#819bab", swatch: "#dce9f4" },
  { id: "lemon", label: "Limón", group: "Claro", top: "#f6efcc", body: "#d0c49e", grid: "#c2b489", gridStrong: "#fffdf3", border: "#a99a70", swatch: "#f6efcc" },
  { id: "lilac", label: "Lila", group: "Claro", top: "#e7ddf3", body: "#b9a8ce", grid: "#a996c2", gridStrong: "#fbf8ff", border: "#917da9", swatch: "#e7ddf3" },
  { id: "peach", label: "Melocotón", group: "Claro", top: "#f7dfd0", body: "#d5b5a2", grid: "#c7a38d", gridStrong: "#fff8f3", border: "#ad8a73", swatch: "#f7dfd0" },
  { id: "mauve", label: "Malva oscuro", group: "Oscuro", top: "#594356", body: "#3f303f", grid: "#f7dfe8", gridStrong: "#fff0f6", border: "#f3c9d7", swatch: "#594356" },
  { id: "midnight", label: "Azul medianoche", group: "Oscuro", top: "#343b4b", body: "#252a35", grid: "#dbe7f7", gridStrong: "#f4f8ff", border: "#aebdd8", swatch: "#343b4b" },
  { id: "rose", label: "Rosa oscuro", group: "Oscuro", top: "#87596b", body: "#684252", grid: "#ffe9f0", gridStrong: "#fff7fa", border: "#ffc9dc", swatch: "#87596b" },
  { id: "forest", label: "Bosque", group: "Oscuro", top: "#355347", body: "#283d34", grid: "#d9f0e3", gridStrong: "#f3fff9", border: "#a8cdb8", swatch: "#355347" },
  { id: "wine", label: "Vino", group: "Oscuro", top: "#573344", body: "#3d2633", grid: "#f3dce6", gridStrong: "#fff5fa", border: "#d8aec1", swatch: "#573344" },
  { id: "slate", label: "Pizarra", group: "Oscuro", top: "#414b5b", body: "#2f3540", grid: "#e5edf7", gridStrong: "#f9fbff", border: "#b8c4d5", swatch: "#414b5b" },
  { id: "cocoa", label: "Cacao", group: "Oscuro", top: "#58463c", body: "#3d302a", grid: "#f2e3d6", gridStrong: "#fff9f4", border: "#d4b4a0", swatch: "#58463c" },
  { id: "white-marble", label: "Mármol claro", group: "Texturas", top: "#f2eee8", body: "#cfc5bb", grid: "#b9ada0", gridStrong: "#fffdfa", border: "#aa9c8f", texture: "marble", swatch: "linear-gradient(135deg,#fffdfa 0 26%,#c8bdb2 27% 30%,#f7f2ea 31% 58%,#b9ada0 59% 62%,#fffdfa 63%)" },
  { id: "dark-marble", label: "Mármol oscuro", group: "Texturas", top: "#35343a", body: "#242329", grid: "#e6e0eb", gridStrong: "#fbf8ff", border: "#bdb2c8", texture: "dark-marble", swatch: "linear-gradient(135deg,#343238 0 25%,#d8d1e0 26% 28%,#242329 29% 58%,#a89eaf 59% 61%,#3b3940 62%)" },
  { id: "wood", label: "Madera cálida", group: "Texturas", top: "#b98256", body: "#8b5b3a", grid: "#f4dfc5", gridStrong: "#fff7ec", border: "#dab48e", texture: "wood", swatch: "linear-gradient(100deg,#b98256 0 18%,#a56e45 19% 24%,#c89362 25% 46%,#9e673f 47% 52%,#b98256 53% 74%,#a8734a 75% 80%,#c0895a 81%)" },
];

export const SURFACE_MAP: Record<SurfaceStyle, SurfaceOption> = Object.fromEntries(
  SURFACE_OPTIONS.map((option) => [option.id, option]),
) as Record<SurfaceStyle, SurfaceOption>;

export const CUSTOM_SURFACE: SurfaceOption = {
  id: "custom",
  label: "Personalizado",
  group: "Personalizado",
  top: "#e9d7c8",
  body: "#b9a18e",
  grid: "#fff5ed",
  gridStrong: "#fffdfb",
  border: "#fff1e6",
  swatch: "#e9d7c8",
};

export function surfaceOption(style: SurfaceStyle, customColor = "#e9d7c8"): SurfaceOption {
  if (style === "custom") {
    return {
      ...CUSTOM_SURFACE,
      top: customColor,
      swatch: customColor,
    };
  }
  return SURFACE_MAP[style] ?? SURFACE_MAP.mauve;
}

export type PrintMaterialStyle = "solid" | "two-tone" | "gradient" | "glitter" | "silk";

export interface PrintMaterialOption {
  id: PrintMaterialStyle;
  label: string;
  hint: string;
  swatch: string;
}

export const PRINT_MATERIAL_OPTIONS: PrintMaterialOption[] = [
  { id: "solid", label: "Sólido", hint: "El color de cada pieza", swatch: "linear-gradient(135deg,#f39ab1,#d97490)" },
  { id: "two-tone", label: "Bicolor", hint: "Cortador y sello en dos colores", swatch: "linear-gradient(90deg,#f39ab1 0 50%,#b7a4e8 50%)" },
  { id: "gradient", label: "Degradado", hint: "Transición de color en altura", swatch: "linear-gradient(180deg,#f39ab1,#b7a4e8)" },
  { id: "glitter", label: "Glitter", hint: "Brillo con iridiscencia", swatch: "radial-gradient(circle at 22% 28%,#fff 0 1px,transparent 2px),radial-gradient(circle at 68% 62%,#fff 0 1px,transparent 2px),radial-gradient(circle at 42% 82%,#ffe9f2 0 1px,transparent 2px),linear-gradient(135deg,#e98fae,#9d8ada)" },
  { id: "silk", label: "Seda", hint: "Brillo suave tipo satén", swatch: "linear-gradient(135deg,#f7c4d3,#c3b1ec 48%,#f7c4d3 100%)" },
];

export type PrintFinish = "matte" | "satin" | "gloss";

export interface PreviewPreferences {
  surface: SurfaceStyle;
  customSurface: string;
  material: PrintMaterialStyle;
  secondaryColor: string;
  finish: PrintFinish;
  showDough: boolean;
  showCookie: boolean;
  showScale: boolean;
  showMeasurements: boolean;
}

export const DEFAULT_PREVIEW_PREFERENCES: PreviewPreferences = {
  surface: "mauve",
  customSurface: "#e9d7c8",
  material: "solid",
  secondaryColor: "#b7a4e8",
  finish: "satin",
  showDough: false,
  showCookie: true,
  showScale: false,
  showMeasurements: false,
};
