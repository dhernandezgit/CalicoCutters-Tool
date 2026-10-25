import { DEFAULT_SETTINGS, type DesignAsset, type DesignShape, type DesignSettings } from "../types";
import { saveBlobWithPicker } from "./download";

const VERSION = 1;

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
  const assets: DesignAsset[] = data.assets.map((a) => {
    if (!a.shape?.outer?.length) throw new Error(`El diseño "${a.name}" no tiene contorno.`);
    return {
      id: a.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: String(a.name || "Diseño"),
      color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "#f39ab1",
      settings: { ...DEFAULT_SETTINGS, ...a.settings },
      shape: {
        ...a.shape,
        bounds: a.shape.bounds ?? {
          minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1,
        },
      },
    };
  });
  return { name: data.name || "mi-coleccion", assets };
}

export function projectBlob(projectName: string, assets: DesignAsset[]): Blob {
  return new Blob([projectToJson(projectName, assets)], { type: "application/json" });
}

export function projectFileName(projectName: string): string {
  return `${projectName.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase() || "calicocutters"}.calicocutters`;
}

export async function saveProjectFile(projectName: string, assets: DesignAsset[]) {
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
}
