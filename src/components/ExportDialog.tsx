import { useMemo, useState } from "react";
import { Download, FileBox, Info, Save, X } from "lucide-react";
import type { DesignAsset, DesignSettings } from "../types";
import type { AssetRow } from "./AssetsPanel";
import { base64ToBytes, bytesToBlob } from "../hooks/usePythonEngine";
import { saveBlobWithPicker, saveFilesChoosingLocation, safeFileName, type DownloadFile } from "../lib/download";
import { projectBlob, projectFileName } from "../lib/project";

export default function ExportDialog({
  open,
  onClose,
  assets,
  settings,
  projectName,
  onExport3mf,
  onToast,
  plaPricePerKg = 14,
}: {
  open: boolean;
  onClose: () => void;
  assets: AssetRow[];
  settings: DesignSettings;
  projectName: string;
  onExport3mf: (asset: DesignAsset, settings: DesignSettings, parts: string[], name: string) => Promise<Blob>;
  onToast: (message: string) => void;
  plaPricePerKg?: number;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const chosen = useMemo(
    () => assets.filter((a) => a.build && selected[a.id] !== false),
    [assets, selected],
  );
  const totalParts = chosen.reduce((sum, a) => sum + (a.build?.parts.length ?? 0), 0);
  const totalGrams = chosen.reduce((sum, a) => sum + (a.build?.material_grams ?? 0), 0);
  const totalPrice = (totalGrams / 1000) * plaPricePerKg;
  const projectFile = projectBlob(projectName, assets);

  if (!open) return null;

  const projectDownload: DownloadFile = {
    name: projectFileName(projectName),
    blob: projectFile,
  };

  const filesFor = async (asset: AssetRow, format: "stl" | "3mf"): Promise<DownloadFile[]> => {
    const base = safeFileName(asset.name);
    const parts = asset.build?.parts ?? [];
    if (format === "stl") {
      return parts.map((part) => ({
        name: `${base}_${safeFileName(part.name)}.stl`,
        blob: bytesToBlob(base64ToBytes(part.stl_b64), "model/stl"),
      }));
    }
    const blob = await onExport3mf(asset, settings, parts.map((p) => p.name), base);
    return [{ name: `${base}.3mf`, blob }];
  };

  const downloadOne = async (asset: AssetRow, format: "stl" | "3mf") => {
    setBusy(true);
    try {
      const files = await filesFor(asset, format);
      const result = await saveFilesChoosingLocation([...files, projectDownload]);
      if (result === "cancelled") return;
      onToast(`${format.toUpperCase()} de “${asset.name}” y proyecto guardados.`);
    } catch (error) {
      onToast(String((error as Error)?.message || error));
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = async (format: "stl" | "3mf") => {
    if (!chosen.length) return onToast("Selecciona al menos un diseño.");
    setBusy(true);
    try {
      const files: DownloadFile[] = [];
      for (const asset of chosen) files.push(...await filesFor(asset, format));
      const result = await saveFilesChoosingLocation([...files, projectDownload]);
      if (result === "cancelled") return;
      onToast(`${files.length} archivo(s) ${format.toUpperCase()} y el proyecto guardados.`);
    } catch (error) {
      onToast(String((error as Error)?.message || error));
    } finally {
      setBusy(false);
    }
  };


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
                        <button type="button" className="soft-button" onClick={() => downloadOne(asset, "stl")} disabled={busy || !asset.build}>STL</button>
                        <button type="button" className="soft-button" onClick={() => downloadOne(asset, "3mf")} disabled={busy || !asset.build}>3MF</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="export-block">
              <span className="block-label">Descargar todos los seleccionados, uno a uno</span>
              <div className="export-action-grid">
                <button type="button" className="soft-button" onClick={() => downloadAll("stl")} disabled={busy}><FileBox size={15} /> Todos en STL</button>
                <button type="button" className="soft-button" onClick={() => downloadAll("3mf")} disabled={busy}><Download size={15} /> Todos en 3MF</button>
              </div>
              <div className="inline-hint"><Info size={13} /><span>Elige la carpeta o el archivo de destino. El proyecto .calicocutters se guarda también junto a los modelos.</span></div>
            </div>

            <div className="project-save-row">
              <Save size={15} />
              <span>El archivo de proyecto incluye todos los diseños, ajustes, nombres y colores.</span>
              <button type="button" className="mini-link" onClick={async () => { await saveBlobWithPicker(projectFile, projectFileName(projectName), "Proyecto CalicoCutters"); }}>Descargar solo el proyecto</button>
            </div>
          </div>

          <aside className="export-aside">
            <div className="summary-card">
              <span className="eyebrow">Resumen</span>
              <div className="summary-line"><span>Diseños</span><strong>{chosen.length}</strong></div>
              <div className="summary-line"><span>Piezas</span><strong>{totalParts}</strong></div>
              <div className="summary-line"><span>Peso aprox.</span><strong>{totalGrams.toFixed(1)} g</strong></div>
              <div className="summary-line"><span>Coste PLA</span><strong>{totalPrice.toFixed(2)} €</strong></div>
              <div className="summary-line"><span>Precio del PLA</span><strong>{plaPricePerKg.toFixed(2)} €/kg</strong></div>
              <div className="summary-line"><span>Línea</span><strong>{settings.lineWidth.toFixed(2)} mm</strong></div>
            </div>
            <div className="aside-note">
              <strong>Impresión</strong>
              <p>Base plana sobre la cama y sin soportes. En Stamper + cortador, el sello va dentro del cortador.</p>
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
