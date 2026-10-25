import { useRef, useState } from "react";
import { Check, Copy, Eye, FolderOpen, ImagePlus, Plus, RefreshCw, Shapes, Sparkles, Trash2, Type, Upload } from "lucide-react";
import type { BuildResult, DesignAsset, DesignShape } from "../types";
import { modeLabel } from "../lib/settings";
import { BUILTIN_SHAPES } from "../data/shapes";

function ringPath(ring: [number, number][]): string {
  return ring.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + "Z";
}

function MiniShape({ shape }: { shape: DesignShape }) {
  const b = shape.bounds;
  const pad = Math.max(b.width, b.height) * 0.08;
  return (
    <svg viewBox={`${b.minX - pad} ${b.minY - pad} ${b.width + pad * 2} ${b.height + pad * 2}`} aria-hidden="true">
      <path d={[shape.outer, ...shape.holes].map(ringPath).join(" ")} fill="#f2a0b7" fillRule="evenodd" />
      <path d={shape.details.map(ringPath).join(" ")} fill="#b7a4e8" fillRule="evenodd" opacity="0.9" />
    </svg>
  );
}

export interface AssetRow extends DesignAsset {
  build: BuildResult | null;
}

export default function AssetsPanel({
  assets,
  selectedIds,
  activeId,
  busy,
  onFiles,
  onSample,
  onSelect,
  onRemove,
  onDuplicate,
  onViewOnly,
  onRemoveAll,
  onText,
}: {
  assets: AssetRow[];
  selectedIds: string[];
  activeId: string | null;
  busy: boolean;
  onFiles: (files: File[]) => void;
  onSample: (id: string) => void;
  onSelect: (id: string, mode: "single" | "toggle" | "range") => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onViewOnly: (id: string) => void;
  onRemoveAll: () => void;
  onText: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  const pick = (files: FileList | null) => {
    if (files?.length) onFiles(Array.from(files));
  };

  return (
    <div className="assets-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Diseño</span>
          <h2>Tus formas</h2>
        </div>
        <span className="count-badge">{assets.length}</span>
      </div>

      <div
        className={`dropzone${over ? " over" : ""}${busy ? " busy" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".svg,image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            pick(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <span className="dropzone-icon">
          {busy ? <RefreshCw className="spin" size={22} /> : <Upload size={22} />}
        </span>
        <span>
          <strong>{busy ? "Analizando archivos…" : "Arrastra una o varias imágenes"}</strong>
          <small>PNG · JPG · WebP · SVG · Ctrl+V para pegar · varios a la vez</small>
        </span>
        <button
          type="button"
          className="mini-cta"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <FolderOpen size={14} /> Elegir
        </button>
      </div>

      <div className="asset-tools">
        <button type="button" onClick={() => inputRef.current?.click()}><Plus size={13} /> Añadir</button>
        <button type="button" onClick={onText} disabled={busy}><Type size={13} /> Texto</button>
        <button type="button" onClick={() => assets.forEach((a) => { if (!selectedIds.includes(a.id)) onSelect(a.id, "toggle"); })}>
          <Check size={13} /> Todos
        </button>
        <button type="button" onClick={() => selectedIds.forEach((id) => onSelect(id, "toggle"))}>Quitar selección</button>
        <button type="button" className="danger" onClick={() => { if (window.confirm("¿Vaciar todos los diseños del proyecto?")) onRemoveAll(); }}><Trash2 size={13} /> Vaciar</button>
      </div>

      <div className="asset-list">
        {assets.length === 0 && (
          <div className="empty-card">
            <ImagePlus size={24} />
            <strong>Aún no hay diseños</strong>
            <span>Sube una silueta o elige uno de los ejemplos.</span>
          </div>
        )}
        {assets.map((asset) => {
          const on = selectedIds.includes(asset.id);
          const isActive = activeId === asset.id;
          return (
            <article
              key={asset.id}
              className={`asset-card${on ? " selected" : ""}${isActive ? " active" : ""}`}
              onClick={(e) => onSelect(asset.id, e.shiftKey ? "range" : (e.ctrlKey || e.metaKey) ? "toggle" : "single")}
            >
              <div className="asset-thumb">
                {asset.shape.previewUrl && asset.shape.sourceKind === "raster" ? (
                  <img src={asset.shape.previewUrl} alt="" />
                ) : (
                  <MiniShape shape={asset.shape} />
                )}
              </div>
              <div className="asset-info">
                <div className="asset-name-row">
                  <strong title={asset.name}>{asset.name}</strong>
                  <span className="asset-kind">{modeLabel(asset.settings.mode)}</span>
                </div>
                <div className="asset-meta">
                  {asset.build
                    ? `${asset.build.dimensions.width.toFixed(1)} × ${asset.build.dimensions.height.toFixed(1)} mm`
                    : "calculando…"}
                  <span>·</span>
                  {asset.shape.details.length ? `${asset.shape.details.length} detalle${asset.shape.details.length === 1 ? "" : "s"}` : "sin detalles"}
                </div>
                {asset.shape.warnings[0] && <div className="asset-warning">{asset.shape.warnings[0]}</div>}
                <div className="asset-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => onViewOnly(asset.id)} title="Ver solo este diseño"><Eye size={13} /> Ver</button>
                  <button type="button" onClick={() => onDuplicate(asset.id)} title="Duplicar"><Copy size={13} /> Duplicar</button>
                  <button type="button" className="danger" onClick={() => onRemove(asset.id)}><Trash2 size={13} /> Quitar</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="samples-head">
        <span className="eyebrow"><Sparkles size={13} /> Ejemplos listos</span>
        <span className="muted-small">se añaden como diseño nuevo</span>
      </div>
      <div className="samples-grid">
        {BUILTIN_SHAPES.map((s) => (
          <button key={s.id} type="button" className="sample-card" onClick={() => onSample(s.id)} title={s.name}>
            <span className="sample-art"><Shapes size={16} /></span>
            <span>{s.name}</span>
          </button>
        ))}
      </div>

      <div className="tip-card">
        <strong>Selección múltiple</strong>
        <p>Clic para editar uno. Ctrl/Cmd+clic para sumar o quitar. Shift+clic para seleccionar un rango. También puedes hacer clic en una pieza del visor 3D.</p>
      </div>
    </div>
  );
}
