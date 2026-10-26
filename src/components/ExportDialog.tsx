import { useMemo, useState } from "react";
import { Info, Save, X } from "lucide-react";
import type { DesignAsset, DesignSettings } from "../types";
import type { AssetRow } from "./AssetsPanel";
import { base64ToBytes, bytesToBlob } from "../hooks/usePythonEngine";
import {
  saveBlobChoosingLocation,
  saveFilesChoosingSameLocation,
  safeFileName,
  type DownloadFile,
} from "../lib/download";
import { combineBinaryStls } from "../lib/stl";
import { binaryStlsToObj } from "../lib/obj";
import { outlinePdf } from "../lib/pdf";
import { createMockup } from "../lib/mockup";
import { outlineSvg } from "../lib/svg";
import { projectBlob, projectFileName } from "../lib/project";
import Toggle from "./Toggle";

type Format = "stl" | "obj" | "svg" | "pdf" | "3mf" | "3mf-set";
type Scope = "selected" | "all";

export default function ExportDialog({
  open,
  onClose,
  assets,
  settings,
  projectName,
  onExport3mf,
  onExport3mfMulti,
  onToast,
  engineBusy = false,
  plaPricePerKg = 14,
}: {
  open: boolean;
  onClose: () => void;
  assets: AssetRow[];
  settings: DesignSettings;
  projectName: string;
  onExport3mf: (asset: DesignAsset, settings: DesignSettings, parts: string[], name: string) => Promise<Blob>;
  onExport3mfMulti: (items: DesignAsset[], name: string) => Promise<Blob>;
  onToast: (message: string) => void;
  engineBusy?: boolean;
  plaPricePerKg?: number;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<Format>("stl");
  const [scope, setScope] = useState<Scope>("selected");
  const [includeProject, setIncludeProject] = useState(true);
  const [status, setStatus] = useState("");
  const formatLabel =
    format === "stl" ? "STL"
      : format === "obj" ? "OBJ"
        : format === "svg" ? "SVG de contorno"
          : format === "pdf" ? "PDF de contorno"
            : format === "3mf" ? "3MF por diseño"
              : "3MF conjunto";

  const buildable = useMemo(() => assets.filter((a) => a.build), [assets]);
  const chosen = useMemo(
    () => assets.filter((a) => a.build && selected[a.id] !== false),
    [assets, selected],
  );
  const scopeAssets = scope === "all" ? buildable : chosen;
  const totalParts = scopeAssets.reduce((sum, a) => sum + (a.build?.parts.length ?? 0), 0);
  const totalGrams = scopeAssets.reduce((sum, a) => sum + (a.build?.material_grams ?? 0), 0);
  const totalPrice = (totalGrams / 1000) * plaPricePerKg;
  const projectFile = projectBlob(projectName, assets);

  const projectDownload: DownloadFile = {
    name: projectFileName(projectName),
    blob: projectFile,
  };

  const filesFor = async (asset: AssetRow, kind: "stl" | "obj" | "svg" | "pdf" | "3mf"): Promise<DownloadFile[]> => {
    const base = safeFileName(asset.name);
    const parts = asset.build?.parts ?? [];
    if (kind === "pdf") {
      return [{ name: `${base}-contorno.pdf`, blob: outlinePdf(asset) }];
    }
    if (kind === "svg") {
      return [{ name: `${base}-contorno.svg`, blob: outlineSvg(asset) }];
    }
    if (kind === "stl") {
      if (!parts.length) return [];
      const merged = combineBinaryStls(parts.map((part) => ({
        data: base64ToBytes(part.stl_b64),
        offset: part.preview_offset,
      })));
      return [{ name: `${base}.stl`, blob: bytesToBlob(merged, "model/stl") }];
    }
    if (kind === "obj") {
      if (!parts.length) return [];
      const text = binaryStlsToObj(parts.map((part) => ({
        name: part.name,
        data: base64ToBytes(part.stl_b64),
        offset: part.preview_offset,
      })));
      return [{ name: `${base}.obj`, blob: new Blob([text], { type: "model/obj" }) }];
    }
    const blob = await onExport3mf(
      asset,
      { ...asset.settings, color: asset.color },
      parts.map((p) => p.name),
      base,
    );
    return [{ name: `${base}.3mf`, blob }];
  };

  const filesForMany = async (items: AssetRow[], kind: Format): Promise<DownloadFile[]> => {
    if (kind === "3mf-set") {
      const blob = await onExport3mfMulti(items, projectName);
      return [{ name: `${safeFileName(projectName)}_conjunto.3mf`, blob }];
    }
    const out: DownloadFile[] = [];
    for (const asset of items) out.push(...await filesFor(asset, kind));
    return out;
  };

  const finish = (result: "saved" | "cancelled" | "unsupported", message: string) => {
    if (result === "cancelled") {
      setStatus("Guardado cancelado.");
      onToast("Guardado cancelado.");
      return;
    }
    setStatus(message);
    onToast(message);
  };

  const downloadOne = async (asset: AssetRow, kind: "stl" | "obj" | "svg" | "pdf" | "3mf") => {
    if (engineBusy || busy) return onToast("Espera a que termine la generación actual.");
    if (!asset.build) return onToast("Este diseño todavía no tiene geometría.");
    setBusy(true);
    setStatus(`Preparando ${kind.toUpperCase()} de ${asset.name}…`);
    try {
      const files = await filesFor(asset, kind);
      const bundle = includeProject ? [...files, projectDownload] : files;
      const result = await saveFilesChoosingSameLocation(bundle);
      finish(
        result,
        `${files.length} modelo(s)${includeProject ? " y el proyecto" : ""} guardados. La siguiente ventana propone la misma carpeta.`,
      );
    } catch (error) {
      const message = `No se pudo exportar: ${String((error as Error)?.message || error)}`;
      setStatus(message);
      onToast(message);
    } finally {
      setBusy(false);
    }
  };

  const downloadMockup = async (asset: AssetRow) => {
    if (engineBusy || busy) return onToast("Espera a que termine la generación actual.");
    setBusy(true);
    setStatus(`Preparando mockup de ${asset.name}…`);
    try {
      const image = await createMockup(asset, asset.build);
      const result = await saveBlobChoosingLocation(image.blob, image.name, "Mockup PNG");
      finish(result, `Mockup PNG guardado: ${image.name}`);
    } catch (error) {
      const message = `No se pudo crear el mockup: ${String((error as Error)?.message || error)}`;
      setStatus(message);
      onToast(message);
    } finally {
      setBusy(false);
    }
  };

  const bulkExport = async () => {
    if (engineBusy || busy) return onToast("Espera a que termine la generación actual.");
    if (!scopeAssets.length) return onToast("No hay diseños con geometría para exportar.");
    setBusy(true);
    setStatus(`Generando ${scopeAssets.length} diseño(s) en ${formatLabel}…`);
    try {
      const files = await filesForMany(scopeAssets, format);
      const bundle = includeProject ? [...files, projectDownload] : files;
      const result = await saveFilesChoosingSameLocation(bundle);
      finish(
        result,
        `${files.length} archivo(s) ${formatLabel}${includeProject ? " y el proyecto" : ""} guardados. La siguiente ventana propone la misma carpeta.`,
      );
    } catch (error) {
      const message = `No se pudo preparar la exportación: ${String((error as Error)?.message || error)}`;
      setStatus(message);
      onToast(message);
    } finally {
      setBusy(false);
    }
  };

  const downloadProject = async () => {
    try {
      const result = await saveBlobChoosingLocation(projectFile, projectFileName(projectName), "Proyecto CalicoCutters");
      finish(result, `Proyecto descargado: ${projectFileName(projectName)}`);
    } catch (error) {
      onToast(String((error as Error)?.message || error));
    }
  };

  if (!open) return null;

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Exportar modelos">
      <div className="modal export-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Salida</span>
            <h2>Guardar modelos y proyecto</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="export-layout">
          <div className="export-main">
            <div className="export-block">
              <div className="export-list-head">
                <span className="block-label">Diseños</span>
                <div>
                  <button type="button" className="mini-link" onClick={() => setSelected({})}>Todos</button>
                  <button type="button" className="mini-link" onClick={() => setSelected(Object.fromEntries(assets.map((a) => [a.id, false])))}>Ninguno</button>
                </div>
              </div>
              <div className="export-assets">
                {assets.map((asset) => {
                  const on = selected[asset.id] !== false;
                  return (
                    <div key={asset.id} className={`export-asset-row${on ? " selected" : ""}`} onClick={() => setSelected((s) => ({ ...s, [asset.id]: !on }))}>
                      <span className="part-swatch" style={{ background: asset.color }} />
                      <div className="export-asset-copy">
                        <strong>{asset.name}</strong>
                        <small>{asset.build ? `${asset.build.parts.length} pieza(s) · ${asset.build.dimensions.width.toFixed(0)} × ${asset.build.dimensions.height.toFixed(0)} mm · ${asset.build.material_grams.toFixed(1)} g` : "sin geometría"}</small>
                      </div>
                      <div className="export-asset-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="soft-button" title="Cortador y sello en un solo archivo STL." onClick={() => downloadOne(asset, "stl")} disabled={engineBusy || busy || !asset.build}>STL</button>
                        <button type="button" className="soft-button" title="Mallas agrupadas en un archivo OBJ." onClick={() => downloadOne(asset, "obj")} disabled={engineBusy || busy || !asset.build}>OBJ</button>
                        <button type="button" className="soft-button" title="Cortador y sello en un solo archivo 3MF." onClick={() => downloadOne(asset, "3mf")} disabled={engineBusy || busy || !asset.build}>3MF</button>
                        <button type="button" className="soft-button" title="Contorno vectorial SVG." onClick={() => downloadOne(asset, "svg")} disabled={engineBusy || busy}>SVG</button>
                        <button type="button" className="soft-button" title="Contorno imprimible en PDF." onClick={() => downloadOne(asset, "pdf")} disabled={engineBusy || busy}>PDF</button>
                        <button type="button" className="soft-button" title="Mockup PNG para catálogo o redes." onClick={() => downloadMockup(asset)} disabled={engineBusy || busy}>PNG</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="export-block">
              <span className="block-label">Exportación por lotes</span>
              <div className="export-choice-row">
                <span className="export-choice-label">Alcance</span>
                <div className="segmented">
                  <button type="button" className={scope === "selected" ? "on" : ""} onClick={() => setScope("selected")}>
                    Seleccionados ({chosen.length})
                  </button>
                  <button type="button" className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>
                    Todos ({buildable.length})
                  </button>
                </div>
              </div>
              <div className="export-choice-row">
                <span className="export-choice-label">Formato</span>
                <div className="segmented">
                  <button type="button" className={format === "stl" ? "on" : ""} onClick={() => setFormat("stl")}>STL</button>
                  <button type="button" className={format === "obj" ? "on" : ""} onClick={() => setFormat("obj")}>OBJ</button>
                  <button type="button" className={format === "svg" ? "on" : ""} onClick={() => setFormat("svg")}>SVG</button>
                  <button type="button" className={format === "3mf" ? "on" : ""} onClick={() => setFormat("3mf")}>3MF</button>
                  <button type="button" className={format === "pdf" ? "on" : ""} onClick={() => setFormat("pdf")}>PDF</button>
                  <button type="button" className={format === "3mf-set" ? "on" : ""} onClick={() => setFormat("3mf-set")}>3MF conjunto</button>
                </div>
              </div>
              <div className="export-action-grid single">
                <button type="button" className="soft-button" onClick={bulkExport} disabled={engineBusy || busy || !scopeAssets.length}>
                  <Save size={15} /> Guardar archivos…
                </button>
              </div>
              <Toggle
                label="Guardar también el proyecto"
                hint="Se pedirá el archivo .calicocutters después de los modelos, en la misma carpeta propuesta."
                checked={includeProject}
                onChange={setIncludeProject}
              />
              <div className="inline-hint">
                <Info size={13} />
                <span>
                  {formatLabel} · {scopeAssets.length} diseño(s), {totalParts} pieza(s). Se abrirá un diálogo por archivo;
                  el navegador propone la misma carpeta que el primer archivo. Cortador y sello van juntos en el mismo archivo.
                </span>
              </div>
              {status && <div className={`export-result${status.includes("cancel") ? " warn" : ""}`} role="status" aria-live="polite">{status}</div>}
            </div>

            <div className="project-save-row">
              <Save size={15} />
              <span>El archivo de proyecto incluye todos los diseños, ajustes, nombres y colores.</span>
              <button type="button" className="mini-link" onClick={downloadProject}>Descargar solo el proyecto</button>
            </div>
          </div>

          <aside className="export-aside">
            <div className="summary-card">
              <span className="eyebrow">Resumen</span>
              <div className="summary-line"><span>Diseños</span><strong>{scopeAssets.length}</strong></div>
              <div className="summary-line"><span>Piezas</span><strong>{totalParts}</strong></div>
              <div className="summary-line"><span>Peso aprox.</span><strong>{totalGrams.toFixed(1)} g</strong></div>
              <div className="summary-line"><span>Coste PLA</span><strong>{totalPrice.toFixed(2)} €</strong></div>
              <div className="summary-line"><span>Precio del PLA</span><strong>{plaPricePerKg.toFixed(2)} €/kg</strong></div>
              <div className="summary-line"><span>Línea</span><strong>{settings.lineWidth.toFixed(2)} mm</strong></div>
            </div>
            <div className="aside-note">
              <strong>Impresión</strong>
              <p>
                {settings.mode === "cutter-stamp"
                  ? "Base plana sobre la cama y sin soportes. En Cortador + sello, el sello va dentro del cortador."
                  : settings.mode === "stencil"
                    ? "Lámina plana sobre la cama. Revisa que los puentes y las islas queden unidos en la vista previa."
                    : settings.mode === "cakepop"
                      ? "Molde y prensador se imprimen por separado, con la cara plana sobre la cama."
                      : "Base plana sobre la cama y sin soportes. Revisa la vista previa de capas en el slicer."}
              </p>
            </div>
            <div className="aside-note soft">
              <strong>Importar en otro PC</strong>
              <p>Usa el botón “Importar” de la cabecera y elige el archivo .calicocutters. No hace falta nada más.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
