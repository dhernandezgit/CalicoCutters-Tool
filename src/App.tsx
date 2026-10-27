import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Cookie,
  Crosshair,
  Expand,
  Focus,
  HelpCircle,
  Layers,
  Maximize2,
  Moon,
  MousePointer2,
  Move3D,
  Palette,
  Rotate3D,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  FolderOpen,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Sun,
  Upload,
} from "lucide-react";
import { usePythonEngine } from "./hooks/usePythonEngine";
import { BUILTIN_SHAPES } from "./data/shapes";
import type { BuildPart, BuildResult, DesignAsset, DesignSettings, PrintCheck } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { applyCheckFix, applyPrintableSettings, mergeSettings, modeLabel } from "./lib/settings";
import { projectFromJson, saveProjectFile } from "./lib/project";
import {
  DEFAULT_PREVIEW_PREFERENCES,
  PRINT_MATERIAL_OPTIONS,
  SURFACE_OPTIONS,
  type PreviewPreferences,
  type PrintFinish,
  type PrintMaterialStyle,
  type SurfaceStyle,
} from "./lib/preview";
import AssetsPanel, { type AssetRow } from "./components/AssetsPanel";
import SettingsPanel from "./components/SettingsPanel";
import Viewport3D, { type Viewport3DHandle } from "./components/Viewport3D";
import Preview2D from "./components/Preview2D";
import ExportDialog from "./components/ExportDialog";
import HelpDialog from "./components/HelpDialog";
import ChecksDialog from "./components/ChecksDialog";
import DonateDialog from "./components/DonateDialog";
import TextDialog from "./components/TextDialog";
import Toggle from "./components/Toggle";
import ProcessingBar, { type ProgressState } from "./components/ProcessingBar";
import StatusBar from "./components/StatusBar";
import Logo from "./components/Logo";

const ASSET_COLORS = ["#f39ab1", "#b7a4e8", "#f6c177", "#8ed1c3", "#f08a8a", "#8bb8f0", "#e7b98a"];
const PREVIEW_KEY = "calicocutters-preview-v1";
const THEME_KEY = "calicocutters-theme";
const DOUGH_SCENE_MODES = new Set(["cutter", "cutter-stamp", "stamp", "imprint", "multicutter", "sandwich", "cutter-set"]);

function initialTheme(): "light" | "dark" {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  return "light";
}

function loadPreviewPreferences(): PreviewPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "null") as Partial<PreviewPreferences> | null;
    if (!saved || typeof saved !== "object") return { ...DEFAULT_PREVIEW_PREFERENCES };
    return {
      ...DEFAULT_PREVIEW_PREFERENCES,
      ...saved,
      surface: SURFACE_OPTIONS.some((option) => option.id === saved.surface) || saved.surface === "custom"
        ? String(saved.surface) as SurfaceStyle
        : DEFAULT_PREVIEW_PREFERENCES.surface,
      finish: ["matte", "satin", "gloss"].includes(String(saved.finish))
        ? String(saved.finish) as PrintFinish
        : DEFAULT_PREVIEW_PREFERENCES.finish,
      material: PRINT_MATERIAL_OPTIONS.some((option) => option.id === saved.material)
        ? String(saved.material) as PrintMaterialStyle
        : DEFAULT_PREVIEW_PREFERENCES.material,
      customSurface: /^#[0-9a-f]{6}$/i.test(String(saved.customSurface))
        ? String(saved.customSurface)
        : DEFAULT_PREVIEW_PREFERENCES.customSurface,
      secondaryColor: /^#[0-9a-f]{6}$/i.test(String(saved.secondaryColor))
        ? String(saved.secondaryColor)
        : DEFAULT_PREVIEW_PREFERENCES.secondaryColor,
    };
  } catch {
    return { ...DEFAULT_PREVIEW_PREFERENCES };
  }
}

function combineBuilds(assets: DesignAsset[], builds: Record<string, BuildResult>): BuildResult | null {
  const rows = assets.map((a) => ({ a, b: builds[a.id] })).filter((x) => x.b);
  if (!rows.length) return null;
  const parts: BuildPart[] = [];
  const warnings: string[] = [];
  const checks: PrintCheck[] = [];
  let grams = 0;
  let ms = 0;
  let cursorX = 0;
  let cursorY = 0;
  let rowDepth = 0;
  const maxRow = 320;
  const gap = 12;
  for (const { a, b } of rows) {
    if (!b || !b.parts.length) continue;
    const minX = Math.min(...b.parts.map((p) => p.bounds.min[0] + p.preview_offset[0]));
    const maxX = Math.max(...b.parts.map((p) => p.bounds.max[0] + p.preview_offset[0]));
    const minY = Math.min(...b.parts.map((p) => p.bounds.min[1] + p.preview_offset[1]));
    const maxY = Math.max(...b.parts.map((p) => p.bounds.max[1] + p.preview_offset[1]));
    const groupWidth = maxX - minX;
    const groupDepth = maxY - minY;
    if (cursorX > 0 && cursorX + groupWidth > maxRow) {
      cursorX = 0;
      cursorY += rowDepth + gap + 4;
      rowDepth = 0;
    }
    const shiftX = cursorX - minX;
    const shiftY = cursorY - minY;
    for (const p of b.parts) {
      parts.push({
        ...p,
        assetId: a.id,
        assetName: a.name,
        color: a.color || p.color,
        preview_offset: [
          p.preview_offset[0] + shiftX,
          p.preview_offset[1] + shiftY,
          p.preview_offset[2],
        ],
      });
    }
    warnings.push(...b.warnings.map((w) => `${a.name}: ${w}`));
    checks.push(...b.checks);
    grams += b.material_grams;
    ms = Math.max(ms, b.build_ms);
    cursorX += groupWidth + gap;
    rowDepth = Math.max(rowDepth, groupDepth);
  }
  if (!parts.length) return null;
  const minX = Math.min(...parts.map((p) => p.bounds.min[0] + p.preview_offset[0]));
  const maxX = Math.max(...parts.map((p) => p.bounds.max[0] + p.preview_offset[0]));
  const minY = Math.min(...parts.map((p) => p.bounds.min[1] + p.preview_offset[1]));
  const maxY = Math.max(...parts.map((p) => p.bounds.max[1] + p.preview_offset[1]));
  const minZ = Math.min(...parts.map((p) => p.bounds.min[2] + p.preview_offset[2]));
  const maxZ = Math.max(...parts.map((p) => p.bounds.max[2] + p.preview_offset[2]));
  const dimensions = rows.length === 1 && rows[0].b
    ? rows[0].b.dimensions
    : {
        width: maxX - minX,
        height: maxY - minY,
        depth: maxZ - minZ,
      };
  return {
    parts,
    warnings: Array.from(new Set(warnings)),
    checks,
    build_ms: ms,
    material_grams: grams,
    dimensions,
  };
}

export default function App() {
  const engine = usePythonEngine();
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [builds, setBuilds] = useState<Record<string, BuildResult>>({});
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [projectName, setProjectName] = useState("mi-coleccion");
  const [advanced, setAdvanced] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const [tab, setTab] = useState<"3d" | "2d">("3d");
  const [isolate, setIsolate] = useState<"all" | "cutter" | "stamp" | "imprint">("all");
  const [showEdges, setShowEdges] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [technical, setTechnical] = useState(false);
  const [projection, setProjection] = useState<"perspective" | "orthographic">("perspective");
  const [autoRotate, setAutoRotate] = useState(false);
  const [showBed, setShowBed] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [shadows, setShadows] = useState(true);
  const [xray, setXray] = useState(false);
  const [explode, setExplode] = useState(0);
  const [preview, setPreview] = useState<PreviewPreferences>(loadPreviewPreferences);
  const [viewSection, setViewSection] = useState<"scene" | "material" | "guides">("scene");
  const [centerPick, setCenterPick] = useState(false);
  const [fitKey, setFitKey] = useState("start");
  const [viewScope, setViewScope] = useState<"all" | "selected">("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [plaPricePerKg, setPlaPricePerKg] = useState(14);
  const [toast, setToast] = useState("");
  const viewportRef = useRef<Viewport3DHandle>(null);
  const viewerBoxRef = useRef<HTMLDivElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const initialLoaded = useRef(false);
  const fileHandler = useRef<(files: File[]) => void>(() => undefined);
  const buildsRef = useRef<Record<string, BuildResult>>({});
  const signatures = useRef<Map<string, string>>(new Map());
  const [buildProgress, setBuildProgress] = useState("");
  const [buildPercent, setBuildPercent] = useState(0);
  const [buildStepLabel, setBuildStepLabel] = useState("");
  const [fileProgress, setFileProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    buildsRef.current = builds;
  }, [builds]);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("calicocutters-pla-price"));
      if (Number.isFinite(saved) && saved > 0) setPlaPricePerKg(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("calicocutters-pla-price", String(plaPricePerKg)); } catch { /* ignore */ }
  }, [plaPricePerKg]);

  useEffect(() => {
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(preview)); } catch { /* ignore */ }
  }, [preview]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const updatePreview = useCallback((patch: Partial<PreviewPreferences>) => {
    setPreview((current) => ({ ...current, ...patch }));
  }, []);

  const selectedAssets = useMemo(
    () => assets.filter((a) => selectedIds.includes(a.id)),
    [assets, selectedIds],
  );
  const primary = assets.find((a) => a.id === activeId) ?? selectedAssets[0] ?? assets[0] ?? null;
  const primaryBuild = primary ? builds[primary.id] ?? null : null;
  const doughSceneAllowed = !!primary && DOUGH_SCENE_MODES.has(primary.settings.mode);

  useEffect(() => {
    setCenterPick(false);
    setFitKey(`mode-${primary?.id ?? "none"}-${primary?.settings.mode ?? "none"}-${Date.now()}`);
  }, [primary?.id, primary?.settings.mode]);
  const checks = useMemo(() => {
    const fromSelected = selectedAssets.flatMap((a) => builds[a.id]?.checks ?? []);
    const source = fromSelected.length ? fromSelected : primaryBuild?.checks ?? [];
    const seen = new Set<string>();
    return source.filter((c) => {
      const key = `${c.level}|${c.title}|${c.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedAssets, builds, primaryBuild]);
  const viewAssets = useMemo(
    () => viewScope === "selected"
      ? (selectedAssets.length ? selectedAssets : assets.slice(0, 1))
      : assets,
    [viewScope, selectedAssets, assets],
  );
  const displayBuild = useMemo(() => combineBuilds(viewAssets, builds), [viewAssets, builds]);
  const rows: AssetRow[] = useMemo(() => assets.map((a) => ({ ...a, build: builds[a.id] ?? null })), [assets, builds]);
  const busy = fileBusy || building || engine.status === "loading";
  const progress: ProgressState | null = useMemo(() => {
    if (engine.status === "loading") {
      const step = engine.progressStep || 1;
      return {
        percent: Math.max(4, step * 20),
        label: `Paso ${step} de 5`,
        text: engine.progressText,
      };
    }
    if (fileBusy) {
      return {
        percent: fileProgress.total ? (fileProgress.done / fileProgress.total) * 100 : 28,
        label: fileProgress.total ? `Archivos ${Math.min(fileProgress.done + 1, fileProgress.total)} de ${fileProgress.total}` : "Analizando archivos",
        text: "Vectorizando y preparando la silueta…",
        indeterminate: !fileProgress.total,
      };
    }
    if (building) {
      return {
        percent: buildPercent || 8,
        label: buildStepLabel || "Generando geometría",
        text: buildProgress || "Calculando cortador y sello…",
      };
    }
    return null;
  }, [engine.status, engine.progressStep, engine.progressText, fileBusy, fileProgress, building, buildPercent, buildStepLabel, buildProgress]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addAsset = useCallback((shape: DesignAsset["shape"], name: string, settings?: DesignSettings, color?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseSettings = settings ?? primary?.settings ?? DEFAULT_SETTINGS;
    const chosenColor = color ?? shape.sourceColor ?? ASSET_COLORS[assets.length % ASSET_COLORS.length];
    const asset: DesignAsset = {
      id,
      name,
      shape,
      settings: { ...baseSettings, color: chosenColor },
      color: chosenColor,
    };
    setAssets((prev) => [...prev, asset]);
    setSelectedIds([id]);
    setActiveId(id);
    setFitKey(`asset-${id}`);
    setProjectName((current) => current === "mi-coleccion" ? name : current);
    return asset;
  }, [primary, assets.length]);

  const addFiles = useCallback(async (files: File[], settingsOverride?: DesignSettings, forceFilled = false) => {
    if (!files.length || fileBusy) return;
    if (!engine.ready) {
      setToast("El motor Python todavía está cargando. Espera un momento.");
      return;
    }
    setFileBusy(true);
    setBuildError("");
    setFileProgress({ done: 0, total: files.length });
    let added = 0;
    let processed = 0;
    for (const file of files.slice(0, 40)) {
      const ok = /\.(svg|png|jpe?g|webp)$/i.test(file.name) ||
        ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type);
      if (!ok) {
        setToast("Formato no soportado: " + file.name);
        processed += 1;
        setFileProgress({ done: processed, total: files.length });
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        setToast("Archivo demasiado grande (máximo 25 MB): " + file.name);
        processed += 1;
        setFileProgress({ done: processed, total: files.length });
        continue;
      }
      const previewUrl = file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")
        ? URL.createObjectURL(file)
        : undefined;
      try {
        const shape = await engine.analyzeFile(file, previewUrl, forceFilled);
        addAsset(shape, file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "diseño", settingsOverride);
        added += 1;
        // Let React paint each card before starting the next file.  This keeps
        // multi-file imports genuinely sequential on screen.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      } catch (error) {
        setBuildError(`${file.name}: ${String((error as Error)?.message || error)}`);
      }
      processed += 1;
      setFileProgress({ done: processed, total: files.length });
    }
    setFileBusy(false);
    setFileProgress({ done: 0, total: 0 });
    if (added) setToast(`${added} archivo${added === 1 ? "" : "s"} añadido${added === 1 ? "" : "s"}.`);
  }, [engine, addAsset, fileBusy]);

  const addSample = useCallback(async (sampleId: string) => {
    const sample = BUILTIN_SHAPES.find((s) => s.id === sampleId);
    if (!sample) return;
    if (fileBusy || !engine.ready) {
      setToast("El motor Python todavía está cargando. Espera un momento.");
      return;
    }
    setFileBusy(true);
    setBuildError("");
    try {
      const shape = await engine.analyzeText(sample.svg, `${sample.id}.svg`);
      shape.name = sample.name;
      shape.sourceKind = "builtin";
      addAsset(shape, sample.name);
      setProjectName(sample.name.toLowerCase().replace(/\s+/g, "-"));
      setToast(`Ejemplo añadido: ${sample.name}`);
    } catch (error) {
      setBuildError(String((error as Error)?.message || error));
    } finally {
      setFileBusy(false);
    }
  }, [engine, addAsset, fileBusy]);

  fileHandler.current = addFiles;

  useEffect(() => {
    if (!engine.ready || initialLoaded.current) return;
    initialLoaded.current = true;
    void addSample("heart");
  }, [engine.ready, addSample]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length) {
        event.preventDefault();
        fileHandler.current(files);
      }
    };
    const drop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) {
        event.preventDefault();
        fileHandler.current(files);
      }
    };
    window.addEventListener("paste", paste);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("paste", paste);
      window.removeEventListener("drop", drop);
    };
  }, []);

  useEffect(() => {
    if (!engine.ready || !assets.length) return;
    let cancelled = false;
    setBuilding(true);
    setBuildError("");
    const timer = window.setTimeout(async () => {
      for (let i = 0; i < assets.length; i += 1) {
        if (cancelled) break;
        const asset = assets[i];
        const signature = `${asset.shape.id}|${JSON.stringify(asset.settings)}|${asset.color}`;
        if (signatures.current.get(asset.id) === signature && buildsRef.current[asset.id]) {
          setBuildPercent(((i + 1) / assets.length) * 100);
          setBuildStepLabel(`Paso ${i + 1} de ${assets.length}`);
          continue;
        }
        setBuildProgress(`Generando ${asset.name}…`);
        setBuildStepLabel(`Paso ${i + 1} de ${assets.length}`);
        setBuildPercent((i / assets.length) * 100);
        try {
          const result = await engine.build(asset.shape, { ...asset.settings, color: asset.color });
          if (cancelled) break;
          signatures.current.set(asset.id, signature);
          setBuilds((prev) => ({ ...prev, [asset.id]: result }));
          setBuildPercent(((i + 1) / assets.length) * 100);
        } catch (error) {
          if (!cancelled) {
            setBuildError(`${asset.name}: ${String((error as Error)?.message || error)}`);
            setBuilds((prev) => {
              const next = { ...prev };
              delete next[asset.id];
              return next;
            });
            signatures.current.delete(asset.id);
          }
        }
      }
      if (!cancelled) {
        setBuilding(false);
        setBuildProgress("");
        setBuildStepLabel("");
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assets, engine.ready, engine.build]);

  const targetIds = () => {
    if (selectedIds.length) return selectedIds;
    if (activeId) return [activeId];
    return assets.length ? [assets[0].id] : [];
  };

  const updateSettings = (patch: Partial<DesignSettings>) => {
    const ids = targetIds();
    if (!ids.length) return;
    setAssets((prev) => prev.map((asset) =>
      ids.includes(asset.id)
        ? { ...asset, settings: mergeSettings(asset.settings, patch, asset.shape) }
        : asset,
    ));
  };

  const applyPrintable = () => {
    const ids = targetIds();
    if (!ids.length) return;
    setAssets((prev) => prev.map((asset) =>
      ids.includes(asset.id)
        ? { ...asset, settings: applyPrintableSettings(asset.settings) }
        : asset,
    ));
    setToast("Medidas ajustadas a líneas de impresión.");
  };

  const applyCheck = (code: string) => {
    const ids = targetIds();
    if (!ids.length) return;
    setAssets((prev) => prev.map((asset) =>
      ids.includes(asset.id)
        ? { ...asset, settings: applyCheckFix(asset.settings, code) }
        : asset,
    ));
    setToast("Ajuste recomendado aplicado. Revisa el nuevo resultado.");
  };

  const setColor = (id: string, color: string) => {
    setAssets((prev) => prev.map((a) =>
      selectedIds.includes(a.id) || a.id === id
        ? { ...a, color, settings: { ...a.settings, color } }
        : a,
    ));
  };

  const renameAsset = (id: string, name: string) => {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, name } : a));
  };

  const renameAll = (base: string) => {
    const clean = base.trim();
    if (!clean) return;
    setAssets((prev) => prev.map((a, i) => ({ ...a, name: `${clean} ${i + 1}` })));
    setProjectName(clean);
  };

  const removeAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setActiveId((prev) => (prev === id ? null : prev));
    setBuilds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    signatures.current.delete(id);
  };

  const removeAll = () => {
    setAssets([]);
    setSelectedIds([]);
    setActiveId(null);
    setBuilds({});
    signatures.current.clear();
    setProjectName("mi-coleccion");
  };

  const viewOnly = (id: string) => {
    setSelectedIds([id]);
    setActiveId(id);
    setViewScope("selected");
    setFitKey(`view-${id}`);
  };

  const duplicateAsset = (id: string) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    const copy = addAsset(asset.shape, `${asset.name} copia`, asset.settings, asset.color);
    setToast(`Duplicado: ${copy.name}`);
  };

  const saveProject = async () => {
    if (!assets.length) {
      setToast("No hay diseños que guardar.");
      return;
    }
    try {
      const result = await saveProjectFile(projectName, assets);
      if (result === "cancelled") setToast("Guardado cancelado.");
      else setToast("Proyecto guardado como archivo .calicocutters.");
    } catch (error) {
      setToast(`No se pudo guardar el proyecto: ${String((error as Error)?.message || error)}`);
    }
  };

  const openProject = async (file: File) => {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("El proyecto supera 20 MB.");
      const text = await file.text();
      const parsed = projectFromJson(text);
      if (parsed.assets.length > 100) throw new Error("El proyecto contiene más de 100 diseños.");
      setAssets(parsed.assets);
      setSelectedIds(parsed.assets.slice(0, 1).map((a) => a.id));
      setActiveId(parsed.assets[0]?.id ?? null);
      setProjectName(parsed.name);
      setBuilds({});
      signatures.current.clear();
      setFitKey(`project-${Date.now()}`);
      setToast(`Proyecto cargado: ${parsed.assets.length} diseño${parsed.assets.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setToast(String((error as Error)?.message || error));
    }
  };

  const selectAsset = (id: string, mode: "single" | "toggle" | "range") => {
    setActiveId(id);
    if (mode === "single") {
      setSelectedIds([id]);
      return;
    }
    if (mode === "toggle") {
      setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
      return;
    }
    if (mode === "range" && activeId) {
      const from = assets.findIndex((a) => a.id === activeId);
      const to = assets.findIndex((a) => a.id === id);
      if (from >= 0 && to >= 0) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        setSelectedIds(assets.slice(lo, hi + 1).map((a) => a.id));
      } else setSelectedIds([id]);
    }
  };

  const onExport3mf = useCallback(
    (asset: DesignAsset, _settings: DesignSettings, parts: string[], name: string) =>
      engine.export3mf(asset.shape, { ...asset.settings, color: asset.color }, parts, name),
    [engine],
  );
  const onExport3mfMulti = useCallback(
    (items: DesignAsset[], name: string) =>
      engine.export3mfMulti(items.map((a) => ({
        name: a.name,
        shape: a.shape,
        settings: { ...a.settings, color: a.color },
      })), name),
    [engine],
  );

  const downloadViewScreenshot = () => {
    const data = viewportRef.current?.screenshot();
    if (!data) {
      setToast("La captura no está disponible en este navegador.");
      return;
    }
    const a = document.createElement("a");
    a.href = data;
    a.download = `calicocutters-vista-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToast("Captura de la vista guardada.");
  };

  const toggleFullscreen = async () => {
    const element = viewerBoxRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      setToast("El navegador no ha permitido la pantalla completa.");
    }
  };

  const partNames = new Set(displayBuild?.parts.map((p) => p.name) ?? []);
  const hasCutterPart = ["Cortador", "Cortador espejo", "Impronta", "Multicortador", "Puzzle", "Cortador sándwich", "Set de cortadores"].some((name) => partNames.has(name));
  const hasStampPart = ["Sello", "Sello espejo", "Sello sándwich"].some((name) => partNames.has(name));

  useEffect(() => {
    if (isolate === "stamp" && !hasStampPart) setIsolate("all");
    if (isolate === "cutter" && !hasCutterPart) setIsolate("all");
  }, [hasCutterPart, hasStampPart, isolate]);

  return (
    <div className={`app${busy ? " is-busy" : ""}`}>
      <header className="topbar">
        <Logo />
        <div className="project-title">
          <span className="eyebrow">Proyecto</span>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} aria-label="Nombre del proyecto" maxLength={60} />
        </div>
        <div className="topbar-badges">
          <span className="mode-pill"><Layers size={13} /> {selectedAssets.length > 1 ? `${selectedAssets.length} seleccionados` : modeLabel(primary?.settings.mode ?? "cutter-stamp")}</span>
          <span className="printer-pill">{assets.length} archivo{assets.length === 1 ? "" : "s"}</span>
        </div>
        <div className="topbar-actions">
          <input
            ref={projectInputRef}
            type="file"
            accept=".calicocutters,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void openProject(file);
              e.currentTarget.value = "";
            }}
          />
          <button type="button" className="icon-text" onClick={saveProject} title="Guardar proyecto"><Save size={16} /> Guardar</button>
          <button type="button" className="icon-text" onClick={() => projectInputRef.current?.click()} title="Abrir proyecto"><FolderOpen size={16} /> Importar</button>
          <button type="button" className="icon-text theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Claro" : "Oscuro"}
          </button>
          <button type="button" className="icon-text" onClick={() => setHelpOpen(true)}><HelpCircle size={16} /> Ayuda</button>
          <button type="button" className="primary" onClick={() => assets.length ? setExportOpen(true) : setToast("Añade un diseño primero.")}><Upload size={16} /> Exportar</button>
        </div>
      </header>

      <main className="main">
        <aside className="panel left">
          <AssetsPanel
            assets={rows}
            selectedIds={selectedIds}
            activeId={activeId}
            busy={fileBusy}
            onFiles={addFiles}
            onSample={addSample}
            onSelect={selectAsset}
            onRemove={removeAsset}
            onDuplicate={duplicateAsset}
            onViewOnly={viewOnly}
            onRemoveAll={removeAll}
            onText={() => setTextOpen(true)}
          />
        </aside>

        <section className="viewer-wrap">
          <div className="viewer-toolbar">
            <div className="viewer-toolbar-left">
            <div className="segmented view-tabs">
              <button type="button" className={tab === "3d" ? "on" : ""} onClick={() => setTab("3d")}><Rotate3D size={14} /> 3D</button>
              <button type="button" className={tab === "2d" ? "on" : ""} onClick={() => setTab("2d")}><MousePointer2 size={14} /> 2D</button>
            </div>
            <div className="toolbar-group">
              <button type="button" title="Vista isométrica" onClick={() => { setTab("3d"); viewportRef.current?.view("iso"); }}><Focus size={16} /></button>
              <button type="button" title="Vista superior" onClick={() => { setTab("3d"); viewportRef.current?.view("top"); }}>Top</button>
              <button type="button" title="Vista frontal" onClick={() => { setTab("3d"); viewportRef.current?.view("front"); }}>Front</button>
              <button type="button" title="Ajustar vista" onClick={() => { setTab("3d"); viewportRef.current?.fit(); }}><Maximize2 size={16} /></button>
            </div>
            <div className="segmented projection-tabs">
              <button type="button" className={projection === "perspective" ? "on" : ""} onClick={() => { setTab("3d"); setProjection("perspective"); }}>Perspectiva</button>
              <button type="button" className={projection === "orthographic" ? "on" : ""} onClick={() => { setTab("3d"); setProjection("orthographic"); viewportRef.current?.view("iso"); }}>Isométrica</button>
            </div>
            </div>
            <div className="viewer-toolbar-center">
            <div className="view-options-wrap">
              <button
                type="button"
                className={`view-options-button view-main${viewOptionsOpen ? " on" : ""}`}
                title="Abrir escena, materiales, medidas y cámara"
                aria-haspopup="dialog"
                aria-expanded={viewOptionsOpen}
                onClick={() => setViewOptionsOpen((v) => !v)}
              >
                <SlidersHorizontal size={16} /> Vista
              </button>
              {viewOptionsOpen && (
                <div className="view-options-popover">
                  <div className="view-options-head">
                    <strong>Vista 3D</strong>
                    <div className="view-options-head-actions">
                      <button
                        type="button"
                        className="mini-link"
                        title="Restablecer apariencia"
                        onClick={() => {
                          setPreview({ ...DEFAULT_PREVIEW_PREFERENCES });
                          setCenterPick(false);
                        }}
                      >
                        <RotateCcw size={12} /> Restablecer
                      </button>
                      <button type="button" className="mini-link" onClick={() => setViewOptionsOpen(false)}>Cerrar</button>
                    </div>
                  </div>
                  <div className="segmented view-section-tabs">
                    <button type="button" className={viewSection === "scene" ? "on" : ""} onClick={() => setViewSection("scene")}><Cookie size={13} /> Escena</button>
                    <button type="button" className={viewSection === "material" ? "on" : ""} onClick={() => setViewSection("material")}><Sparkles size={13} /> Material</button>
                    <button type="button" className={viewSection === "guides" ? "on" : ""} onClick={() => setViewSection("guides")}><Ruler size={13} /> Guías</button>
                  </div>

                  {viewSection === "scene" && (
                    <>
                      <div className="view-section">
                        <span className="view-section-title"><Palette size={12} /> Superficie</span>
                        {(["Claro", "Oscuro", "Texturas"] as const).map((group) => (
                          <div className="surface-row" key={group}>
                            <span>{group}</span>
                            <div className="surface-swatches">
                              {SURFACE_OPTIONS.filter((option) => option.group === group).map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={`surface-swatch${preview.surface === option.id ? " on" : ""}`}
                                  style={{ background: option.swatch || option.top }}
                                  title={option.label}
                                  aria-label={option.label}
                                  onClick={() => updatePreview({ surface: option.id })}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                        <label className={`surface-custom${preview.surface === "custom" ? " on" : ""}`}>
                          <input
                            type="color"
                            value={preview.customSurface}
                            onChange={(e) => updatePreview({ customSurface: e.target.value, surface: "custom" })}
                          />
                          <span>Color propio</span>
                        </label>
                      </div>
                      <div className="view-options-grid">
                        <Toggle label="Cama" checked={showBed} onChange={setShowBed} />
                        <Toggle label="Cuadrícula" checked={showGrid} onChange={setShowGrid} />
                        <Toggle label="Sombras" checked={shadows} onChange={setShadows} />
                        {doughSceneAllowed ? (
                          <>
                            <Toggle label="Galleta y masa" hint="Masa y pieza suelta bajo el cortador" checked={preview.showDough} onChange={(v) => updatePreview({ showDough: v })} />
                            {preview.showDough && (
                              <>
                                <Toggle label="Galleta suelta" checked={preview.showCookie} onChange={(v) => updatePreview({ showCookie: v })} />
                                <Toggle label="Regla y moneda" checked={preview.showScale} onChange={(v) => updatePreview({ showScale: v })} />
                                <div className="view-two-colors" style={{ gridColumn: "1 / -1" }}>
                                  <label>
                                    <span>Color de la masa</span>
                                    <input type="color" value={preview.doughColor} onChange={(e) => updatePreview({ doughColor: e.target.value })} />
                                  </label>
                                  <label>
                                    <span>Color de la galleta</span>
                                    <input type="color" value={preview.cookieColor} onChange={(e) => updatePreview({ cookieColor: e.target.value })} />
                                  </label>
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="inline-hint scene-unavailable"><Cookie size={13} /><span>La escena de masa está disponible para cortadores, sellos e improntas.</span></div>
                        )}
                      </div>
                    </>
                  )}

                  {viewSection === "material" && (
                    <>
                      <div className="view-section">
                        <span className="view-section-title"><Sparkles size={12} /> Material de impresión</span>
                        <div className="material-picker">
                          {PRINT_MATERIAL_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`material-card${preview.material === option.id ? " on" : ""}`}
                              title={option.hint}
                              onClick={() => updatePreview({ material: option.id })}
                            >
                              <i style={{ background: option.swatch }} />
                              <span>{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="view-two-colors">
                        <label>
                          <span>Color secundario</span>
                          <input
                            type="color"
                            value={preview.secondaryColor}
                            onChange={(e) => updatePreview({ secondaryColor: e.target.value })}
                          />
                        </label>
                        <label>
                          <span>Acabado</span>
                          <select value={preview.finish} onChange={(e) => updatePreview({ finish: e.target.value as PrintFinish })}>
                            <option value="matte">Mate</option>
                            <option value="satin">Satinado</option>
                            <option value="gloss">Brillante</option>
                          </select>
                        </label>
                      </div>
                      <div className="view-options-grid">
                        <Toggle label="Aristas" checked={showEdges} onChange={setShowEdges} />
                        <Toggle label="Malla" checked={wireframe} onChange={setWireframe} />
                        <Toggle label="Rayos X" checked={xray} onChange={setXray} />
                        <Toggle label="Giro automático" checked={autoRotate} onChange={setAutoRotate} />
                      </div>
                      <div className="inline-hint"><Sparkles size={13} /><span>El material es solo una previsualización: no cambia la geometría exportada.</span></div>
                    </>
                  )}

                  {viewSection === "guides" && (
                    <>
                      <div className="view-options-grid">
                        <Toggle label="Medidas" hint="Cotas de ancho, fondo y alto" checked={preview.showMeasurements} onChange={(v) => updatePreview({ showMeasurements: v })} />
                        <Toggle label="Vista técnica" hint="Perspectiva baja, casi ortográfica" checked={technical} onChange={setTechnical} />
                        <Toggle label="Cama" checked={showBed} onChange={setShowBed} />
                        <Toggle label="Cuadrícula" checked={showGrid} onChange={setShowGrid} />
                      </div>
                      <button
                        type="button"
                        className={`soft-button center-pick-button${centerPick ? " on" : ""}`}
                        onClick={() => { setTab("3d"); setCenterPick((v) => !v); }}
                      >
                        <Move3D size={14} /> {centerPick ? "Haz clic en la pieza…" : "Mover centro de giro"}
                      </button>
                      <div className="inline-hint"><Crosshair size={13} /><span>Actívalo y haz clic en cualquier punto del modelo para orbitar alrededor de ese punto. También puedes desplazar con el botón derecho del ratón.</span></div>
                      <label className="view-slider">
                        <span>Separar piezas <b>{explode.toFixed(0)} mm</b></span>
                        <input type="range" min={0} max={30} step={1} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
                      </label>
                    </>
                  )}

                  <div className="view-options-actions">
                    <button type="button" className="soft-button" onClick={() => { setCenterPick(false); viewportRef.current?.fitModel(); }}><Focus size={13} /> Centrar pieza</button>
                    <button type="button" className="soft-button" onClick={() => { setCenterPick(false); viewportRef.current?.fit(); }}><Maximize2 size={13} /> Centrar todo</button>
                    <button type="button" className="soft-button" onClick={downloadViewScreenshot}><Camera size={13} /> Captura PNG</button>
                    <button type="button" className="soft-button" onClick={toggleFullscreen}><Expand size={13} /> Pantalla completa</button>
                  </div>
                </div>
              )}
            </div>
            </div>
            <div className="viewer-toolbar-right">
            <div className="segmented view-scope">
              <button type="button" className={viewScope === "all" ? "on" : ""} onClick={() => { setViewScope("all"); setFitKey(`all-${Date.now()}`); }}>Todos</button>
              <button type="button" className={viewScope === "selected" ? "on" : ""} onClick={() => { setViewScope("selected"); setFitKey(`sel-${Date.now()}`); }}>Selección</button>
            </div>
            {(hasCutterPart || hasStampPart) && (
              <div className="part-isolate">
                <button type="button" className={isolate === "all" ? "on" : ""} onClick={() => setIsolate("all")}><Layers size={14} /> Conjunto</button>
                {hasCutterPart && <button type="button" className={isolate === "cutter" ? "on" : ""} onClick={() => setIsolate("cutter")}><Scissors size={14} /> Cortador</button>}
                {hasStampPart && <button type="button" className={isolate === "stamp" ? "on" : ""} onClick={() => setIsolate("stamp")}><Stamp size={14} /> Sello</button>}
              </div>
            )}
            </div>
          </div>

          <div className="viewer" ref={viewerBoxRef}>
            {tab === "3d" ? (
              <Viewport3D
                ref={viewportRef}
                build={displayBuild}
                showEdges={showEdges}
                wireframe={wireframe}
                isolate={isolate}
                fitKey={fitKey}
                selectedIds={selectedIds}
                onSelectAsset={(id, additive) => selectAsset(id, additive ? "toggle" : "single")}
                bedWidth={primary?.settings.bedWidth ?? 256}
                bedDepth={primary?.settings.bedDepth ?? 256}
                technical={technical}
                projection={projection}
                autoRotate={autoRotate}
                showBed={showBed}
                showGrid={showGrid}
                shadows={shadows}
                xray={xray}
                explode={explode}
                bedStyle={preview.surface}
                customSurface={preview.customSurface}
                finish={preview.finish}
                materialStyle={preview.material}
                secondaryColor={preview.secondaryColor}
                primaryShape={primary?.shape ?? null}
                showDough={doughSceneAllowed && preview.showDough}
                doughColor={preview.doughColor}
                cookieColor={preview.cookieColor}
                showCookie={preview.showCookie}
                showScale={preview.showScale}
                measurements={preview.showMeasurements}
                centerPick={centerPick}
                onCenterPicked={() => setCenterPick(false)}
              />
            ) : primary ? (
              <Preview2D shape={primary.shape} lineWidth={primary.settings.lineWidth} />
            ) : (
              <div className="empty-viewer"><Scissors size={40} /><strong>Tu próxima colección empieza con una imagen</strong><span>Sube uno o varios SVG o imágenes desde el panel izquierdo.</span></div>
            )}

            {tab === "3d" && displayBuild && (
              <div className="viewport-legend">
                {assets.slice(0, 5).map((a) => <span key={a.id} className="legend-item"><i style={{ background: a.color }} />{a.name}</span>)}
                {assets.length > 5 && <span className="legend-item">+{assets.length - 5}</span>}
                <span className="legend-dim">{displayBuild.dimensions.width.toFixed(1)} × {displayBuild.dimensions.height.toFixed(1)} mm</span>
                <span className="legend-dim bed-dim">Cama {primary?.settings.bedWidth?.toFixed(0) ?? 256} × {primary?.settings.bedDepth?.toFixed(0) ?? 256} mm</span>
              </div>
            )}

            {tab === "3d" && centerPick && (
              <div className="center-pick-hint">
                <Crosshair size={15} />
                <span>Haz clic en la pieza para mover el centro de giro</span>
                <button type="button" onClick={() => setCenterPick(false)}>Cancelar</button>
              </div>
            )}

            {(busy) && (
              <div className="viewport-loading">
                <span className="spinner" />
                <strong>{fileBusy ? "Analizando archivos…" : building ? buildProgress || "Generando geometría…" : engine.progressText}</strong>
                <span>{building ? "Python + Shapely + earcut" : engine.progressText}</span>
                {engine.status === "loading" && <div className="progress-track"><div style={{ width: `${Math.max(6, engine.progressStep * 20)}%` }} /></div>}
              </div>
            )}

            {(buildError || engine.engineError) && (
              <div className="viewer-error">
                <strong>{engine.engineError ? "No se pudo cargar el motor Python" : "No se pudo generar el modelo"}</strong>
                <span>{engine.engineError || buildError}</span>
                {engine.engineError && (
                  <button type="button" className="soft-button" onClick={() => engine.restart()}>
                    Reintentar motor
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="viewer-bottom">
            <div className="viewer-status"><span className={`dot-state ${engine.ready ? "ok" : ""}`} />{engine.ready ? "Motor Python local" : "Cargando motor Python"}{displayBuild && <><span className="viewer-status-sep">·</span>{assets.length} diseño{assets.length === 1 ? "" : "s"} · {displayBuild.parts.length} pieza{displayBuild.parts.length === 1 ? "" : "s"}</>}</div>
            <div className="viewer-hint">Clic en una pieza para seleccionar su diseño · arrastra para girar</div>
          </div>
        </section>

        <aside className="panel right">
          <SettingsPanel
            settings={primary?.settings ?? DEFAULT_SETTINGS}
            shape={primary?.shape ?? null}
            build={primaryBuild}
            checks={checks}
            selectionCount={selectedAssets.length}
            selectionNames={selectedAssets.map((a) => a.name)}
            assetColor={primary?.color ?? "#f39ab1"}
            assetName={primary?.name ?? ""}
            onColorChange={(color) => primary && setColor(primary.id, color)}
            onRename={(name) => primary && renameAsset(primary.id, name)}
            onRenameAll={renameAll}
            plaPricePerKg={plaPricePerKg}
            onPlaPriceChange={setPlaPricePerKg}
            onChange={updateSettings}
            onApplyPrintable={applyPrintable}
            onOpenChecks={() => setChecksOpen(true)}
            onExport={() => assets.length ? setExportOpen(true) : setToast("Añade un diseño primero.")}
            preview={preview}
            onPreviewChange={updatePreview}
            advanced={advanced}
            setAdvanced={setAdvanced}
          />
        </aside>
      </main>

      <StatusBar
        shape={primary?.shape ?? null}
        build={displayBuild}
        checks={checks}
        engineReady={engine.ready}
        assetCount={assets.length}
        building={busy}
        progressText={building ? buildProgress : engine.progressText}
        plaPricePerKg={plaPricePerKg}
        onHelp={() => setHelpOpen(true)}
        onChecks={() => setChecksOpen(true)}
        onDonate={() => setDonateOpen(true)}
      />
      <ProcessingBar progress={progress} />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        assets={rows}
        settings={primary?.settings ?? DEFAULT_SETTINGS}
        projectName={projectName}
        engineBusy={busy}
        onExport3mf={onExport3mf}
        onExport3mfMulti={onExport3mfMulti}
        onToast={setToast}
        plaPricePerKg={plaPricePerKg}
      />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ChecksDialog
        open={checksOpen}
        onClose={() => setChecksOpen(false)}
        checks={checks}
        onApplyFix={applyCheck}
        onView={(kind) => {
          setChecksOpen(false);
          setTab("3d");
          window.setTimeout(() => viewportRef.current?.view(kind), 60);
        }}
        onExport={() => {
          setChecksOpen(false);
          if (assets.length) setExportOpen(true);
        }}
      />
      <DonateDialog open={donateOpen} onClose={() => setDonateOpen(false)} />
      <TextDialog
        open={textOpen}
        onClose={() => setTextOpen(false)}
        onCreate={(file) => addFiles([file], { ...(primary?.settings ?? DEFAULT_SETTINGS), mode: "cutter" }, true)}
      />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
