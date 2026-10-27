import { DEFAULT_SETTINGS, type DesignAsset, type DesignShape, type DesignSettings } from "../types";
import { saveBlobWithPicker } from "./download";

const VERSION = 2;
const MODES = new Set([
  "cutter-stamp", "cutter", "stamp", "imprint", "multicutter", "sandwich",
  "roller", "stencil", "topper", "practice", "cakepop", "cutter-set", "bookmark",
]);

function finitePoint(p: unknown): p is [number, number] {
  return Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
}

function cleanRings(value: unknown): [number, number][][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(finitePoint))
    .slice(0, 2000)
    .map((ring) => (ring as unknown[]).slice(0, 30000).map((p) => [Number((p as unknown[])[0]), Number((p as unknown[])[1])] as [number, number]));
}

function normalizeSettings(raw: Partial<DesignSettings> | null | undefined): DesignSettings {
  const input = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const value = input[key];
    if (typeof fallback === "number") {
      const number = Number(value);
      out[key] = Number.isFinite(number) ? number : fallback;
    } else if (typeof fallback === "boolean") {
      out[key] = typeof value === "boolean" ? value : fallback;
    } else if (typeof fallback === "string") {
      out[key] = typeof value === "string" ? value : fallback;
    }
  }
  const mode = String(out.mode);
  out.mode = MODES.has(mode) ? mode : "cutter-stamp";
  out.sizeMode = out.sizeMode === "wh" ? "wh" : "longest";
  out.printer = ["fdm04", "fdm06", "resin"].includes(String(out.printer)) ? out.printer : "fdm04";
  out.baseShape = ["rect", "chamfer", "round"].includes(String(out.baseShape)) ? out.baseShape : "chamfer";
  out.pressHandleShape = ["rect", "round", "rounded"].includes(String(out.pressHandleShape)) ? out.pressHandleShape : "rounded";
  out.stampEdgeMethod = out.stampEdgeMethod === "offset" ? "offset" : "preserve";
  out.stampDetailCurve = ["chamfer", "round"].includes(String(out.stampDetailCurve)) ? out.stampDetailCurve : "none";
  out.rollerPattern = ["brick", "mirror"].includes(String(out.rollerPattern)) ? out.rollerPattern : "grid";
  out.rollerPatternMode = ["drawing", "silhouette"].includes(String(out.rollerPatternMode)) ? out.rollerPatternMode : "drawing";
  out.rollerDepthCurve = ["none", "chamfer", "round"].includes(String(out.rollerDepthCurve)) ? out.rollerDepthCurve : "round";
  out.stencilPattern = ["diagonal", "random"].includes(String(out.stencilPattern)) ? out.stencilPattern : "grid";
  out.sandwichPart = ["cutter", "seal"].includes(String(out.sandwichPart)) ? out.sandwichPart : "both";
  out.bookmarkDesignStyle = ["line", "relief", "none"].includes(String(out.bookmarkDesignStyle)) ? out.bookmarkDesignStyle : "relief";
  out.topperDepthCurve = ["chamfer", "round"].includes(String(out.topperDepthCurve)) ? out.topperDepthCurve : "none";
  out.cakePopPlungerFace = ["outline", "none"].includes(String(out.cakePopPlungerFace)) ? out.cakePopPlungerFace : "imprint";
  if (typeof input.color === "string" && /^#[0-9a-f]{6}$/i.test(input.color)) out.color = input.color;
  return out as unknown as DesignSettings;
}

function shapeBounds(outer: [number, number][]): DesignShape["bounds"] {
  const xs = outer.map((p) => p[0]);
  const ys = outer.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  if ([minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
  return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
}

export interface ProjectFile {
  format: "calicocutters-project";
  version: number;
  name: string;
  createdAt: string;
  assets: Array<{
    id: string;
    name: string;
    color: string;
    settings: DesignSettings;
    shape: DesignShape;
  }>;
}

export function projectToJson(projectName: string, assets: DesignAsset[]): string {
  const data: ProjectFile = {
    format: "calicocutters-project",
    version: VERSION,
    name: projectName,
    createdAt: new Date().toISOString(),
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      settings: a.settings,
      shape: {
        id: a.shape.id,
        name: a.shape.name,
        sourceKind: a.shape.sourceKind,
        outer: a.shape.outer,
        holes: a.shape.holes,
        details: a.shape.details,
        extras: a.shape.extras,
        bounds: a.shape.bounds,
        warnings: a.shape.warnings,
        imageSize: a.shape.imageSize,
        sourceColor: a.shape.sourceColor,
      },
    })),
  };
  return JSON.stringify(data);
}

export function projectFromJson(text: string): { name: string; assets: DesignAsset[] } {
  const data = JSON.parse(text) as ProjectFile;
  if (data.format !== "calicocutters-project" || !Array.isArray(data.assets)) {
    throw new Error("El archivo no es un proyecto de CalicoCutters.");
  }
  if (data.version > VERSION) {
    throw new Error("El proyecto se ha creado con una versión más nueva de CalicoCutters.");
  }
  if (data.assets.length > 100) {
    throw new Error("El proyecto contiene más de 100 diseños.");
  }
  const usedIds = new Set<string>();
  const assets: DesignAsset[] = data.assets.map((a) => {
    if (!a?.shape || !Array.isArray(a.shape.outer) || a.shape.outer.length < 3) {
      throw new Error(`El diseño "${a?.name ?? "sin nombre"}" no tiene contorno.`);
    }
    const outer = cleanRings([a.shape.outer])[0];
    if (!outer) throw new Error(`El diseño "${a.name}" tiene coordenadas no válidas.`);
    const bounds = shapeBounds(outer);
    const warnings = Array.isArray(a.shape.warnings) ? a.shape.warnings.map(String).slice(0, 20) : [];
    let id = String(a.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    while (usedIds.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
    usedIds.add(id);
    const migratedSettings = normalizeSettings(a.settings);
    if ((Number(data.version) || 1) < 2) {
      // Older projects saved the aggressive preprocessing defaults.  Preserve
      // thin line-art details unless the user explicitly re-enables them.
      migratedSettings.preprocessSmooth = false;
      migratedSettings.preprocessRemoveTiny = false;
      migratedSettings.preprocessSmoothDetails = false;
      migratedSettings.stampRemoveOuterEdge = false;
    }
    return {
      id,
      name: String(a.name || "Diseño").slice(0, 120),
      color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "#f39ab1",
      settings: migratedSettings,
      shape: {
        ...a.shape,
        id: String(a.shape.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        name: String(a.shape.name || a.name || "Diseño"),
        sourceKind: a.shape.sourceKind === "raster" ? "raster" : a.shape.sourceKind === "builtin" ? "builtin" : "svg",
        outer,
        holes: cleanRings(a.shape.holes),
        details: cleanRings(a.shape.details),
        extras: cleanRings(a.shape.extras),
        bounds,
        warnings,
        previewUrl: undefined,
      },
    };
  });
  return { name: String(data.name || "mi-coleccion").slice(0, 60), assets };
}

export function projectBlob(projectName: string, assets: DesignAsset[]): Blob {
  return new Blob([projectToJson(projectName, assets)], { type: "application/json" });
}

export function projectFileName(projectName: string): string {
  return `${projectName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "calicocutters"}.calicocutters`;
}

export async function saveProjectFile(projectName: string, assets: DesignAsset[]): Promise<"saved" | "cancelled" | "unsupported"> {
  const blob = projectBlob(projectName, assets);
  const result = await saveBlobWithPicker(blob, projectFileName(projectName), "Proyecto CalicoCutters");
  if (result === "unsupported") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = projectFileName(projectName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
  return result;
}
