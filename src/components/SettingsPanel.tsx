import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Box,
  CakeSlice,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleHelp,
  Cookie,
  Crown,
  Cylinder,
  Fingerprint,
  Flower2,
  Focus,
  Gauge,
  Gem,
  Grid3X3,
  Layers,
  Lollipop,
  PaintRoller,
  Puzzle,
  Ruler,
  Sandwich,
  Scissors,
  SlidersHorizontal,
  Stamp,
  Wand2,
} from "lucide-react";
import type { BuildResult, DesignSettings, DesignShape, PrintCheck } from "../types";
import { DEFAULT_SETTINGS, PRINTER_BEDS, PRINTER_PROFILES } from "../types";
import Section from "./Section";
import Toggle from "./Toggle";

function levelOf(checks: PrintCheck[]): "ok" | "warn" | "error" {
  if (checks.some((c) => c.level === "error")) return "error";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "ok";
}

interface SavedProfile {
  id: string;
  name: string;
  savedAt: string;
  settings: DesignSettings;
}

const PROFILE_KEY = "calicocutters-profiles";

function loadProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && typeof p.name === "string" && p.settings).slice(0, 30);
  } catch {
    return [];
  }
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit = "mm",
  hint,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: React.ReactNode;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(() => String(Number.isFinite(value) ? value : ""));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(Number.isFinite(value) ? value : ""));
    }
  }, [value]);

  const commit = () => {
    const raw = inputRef.current?.value ?? draft;
    const parsed = Number(raw.replace(",", ".").trim());
    if (!raw.trim() || !Number.isFinite(parsed)) {
      // Empty or non-numeric: restore the last valid value and flag it.
      setDraft(String(Number.isFinite(value) ? value : ""));
      setInvalid(true);
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    const changed = clamped !== value;
    setDraft(String(clamped));
    setInvalid(clamped !== parsed);
    if (changed) onChange(clamped);
  };

  return (
    <label className="field-row">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="field-input">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={invalid}
          title={invalid ? `Valor no válido. Rango permitido: ${min}–${max}.` : undefined}
          className={invalid ? "invalid" : undefined}
          onFocus={() => setInvalid(false)}
          onChange={(e) => {
            setDraft(e.target.value);
            if (invalid) setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(String(Number.isFinite(value) ? value : ""));
              setInvalid(false);
              e.currentTarget.blur();
            }
          }}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPanel({
  settings,
  shape,
  build,
  checks,
  onChange,
  onApplyPrintable,
  onOpenChecks,
  onExport,
  advanced,
  setAdvanced,
  selectionCount = 1,
  selectionNames = [],
  assetColor = "#f39ab1",
  assetName = "",
  onColorChange,
  onRename,
  onRenameAll,
  plaPricePerKg = 14,
  onPlaPriceChange,
}: {
  settings: DesignSettings;
  shape: DesignShape | null;
  build: BuildResult | null;
  checks: PrintCheck[];
  onChange: (patch: Partial<DesignSettings>) => void;
  onApplyPrintable: () => void;
  onOpenChecks: () => void;
  onExport: () => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  selectionCount?: number;
  selectionNames?: string[];
  assetColor?: string;
  assetName?: string;
  onColorChange?: (color: string) => void;
  onRename?: (name: string) => void;
  onRenameAll?: (base: string) => void;
  plaPricePerKg?: number;
  onPlaPriceChange?: (value: number) => void;
}) {
  const [nameDraft, setNameDraft] = useState(assetName || selectionNames[0] || "");
  const [bulkName, setBulkName] = useState("galleta");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Galletas: true });
  const [profiles, setProfiles] = useState<SavedProfile[]>(() => loadProfiles());
  const [profileName, setProfileName] = useState("");
  useEffect(() => {
    setNameDraft(assetName || selectionNames[0] || "");
  }, [assetName, selectionNames[0]]);
  const line = settings.lineWidth || 0.4;
  const level = build ? levelOf(checks) : "warn";
  const printer = PRINTER_PROFILES[settings.printer];
  const cutterLike = ["cutter", "cutter-stamp", "imprint", "multicutter", "sandwich", "cutter-set"].includes(settings.mode);
  const supportsExtras = ["cutter", "cutter-stamp", "multicutter"].includes(settings.mode);
  const stampLike = settings.mode === "stamp" || settings.mode === "cutter-stamp";
  const aspect = shape ? shape.bounds.width / Math.max(shape.bounds.height, 0.001) : 1;
  const final = build?.parts[0];
  const finalW = final ? final.bounds.max[0] - final.bounds.min[0] : 0;
  const finalH = final ? final.bounds.max[1] - final.bounds.min[1] : 0;

  const setWidth = (v: number) => {
    if (settings.lockAspect) onChange({ width: v, height: Number((v / aspect).toFixed(2)) });
    else onChange({ width: v });
  };
  const setHeight = (v: number) => {
    if (settings.lockAspect) onChange({ height: v, width: Number((v * aspect).toFixed(2)) });
    else onChange({ height: v });
  };

  const persistProfiles = (next: SavedProfile[]) => {
    setProfiles(next);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
  };

  const saveProfile = () => {
    const name = profileName.trim();
    if (!name) return;
    const { color: _color, ...rest } = settings;
    const profile: SavedProfile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      savedAt: new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS, ...rest },
    };
    const existing = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const next = existing
      ? profiles.map((p) => (p.id === existing.id ? { ...profile, id: existing.id } : p))
      : [profile, ...profiles].slice(0, 30);
    persistProfiles(next);
    setProfileName("");
  };

  const applyProfile = (profile: SavedProfile) => {
    const { color: _color, ...rest } = profile.settings;
    onChange(rest);
  };

  const removeProfile = (id: string) => {
    persistProfiles(profiles.filter((p) => p.id !== id));
  };

  return (
    <div className="settings-panel">
      <div className="panel-heading settings-heading">
        <div>
          <span className="eyebrow">Ajustes</span>
          <h2>Hazlo imprimible</h2>
        </div>
        <Segmented
          value={advanced ? "adv" : "basic"}
          options={[
            { value: "basic", label: "Básico" },
            { value: "adv", label: "Avanzado" },
          ]}
          onChange={(v) => setAdvanced(v === "adv")}
        />
      </div>

      {selectionCount > 1 && (
        <div className="selection-banner">
          <strong>Editando {selectionCount} diseños</strong>
          <span>{selectionNames.slice(0, 4).join(" · ")}{selectionNames.length > 4 ? "…" : ""}</span>
          <small>Los ajustes se aplican a todos los seleccionados.</small>
        </div>
      )}

      <button type="button" className={`print-badge ${level}`} onClick={onOpenChecks}>
        <span className="badge-dot" />
        <span>
          <strong>{!build ? "Falta geometría" : level === "ok" ? "Listo para imprimir" : level === "warn" ? "Revisar antes de imprimir" : "Hay un problema"}</strong>
          <small>
            {!build
              ? "Añade un diseño o espera al motor"
              : level === "ok"
                ? `${printer.label} · línea ${line.toFixed(2)} mm`
                : checks.filter((c) => c.level !== "ok").length + " aviso(s) de impresión"}
          </small>
        </span>
        <CircleHelp size={16} />
      </button>

      {!advanced && (
        <p className="basic-hint">Básico: elige qué crear, el tamaño y los ajustes esenciales. Cambia a Avanzado para impresión, color, nombres, coste y refuerzos.</p>
      )}

      <Section id="mode" title="Qué vas a crear" icon={<Crown size={16} />} defaultOpen summary={build ? `${build.parts.length} pieza${build.parts.length === 1 ? "" : "s"}` : (settings.mode === "cutter-stamp" || settings.mode === "cakepop" ? "2 piezas" : "1 pieza")}>
        {[
          {
            label: "Galletas",
            basic: true,
            icon: <Cookie size={12} />,
            modes: [
              { value: "cutter-stamp" as const, label: "Stamper + cortador", icon: <span className="mode-icon-pair"><Scissors size={16} /><Stamp size={14} /></span>, sub: "El modo por defecto" },
              { value: "cutter" as const, label: "Cortador", icon: <Scissors size={20} />, sub: "Contorno exterior" },
              { value: "imprint" as const, label: "Impronta", icon: <Fingerprint size={20} />, sub: "Corte + relieve en una pieza" },
              { value: "multicutter" as const, label: "Puzzle", icon: <Puzzle size={20} />, sub: "Rejilla de copias" },
              { value: "cutter-set" as const, label: "Set de cortadores", icon: <Layers size={20} />, sub: "Varios tamaños" },
            ],
          },
          {
            label: "Sellos",
            basic: true,
            icon: <Stamp size={12} />,
            modes: [
              { value: "stamp" as const, label: "Sello", icon: <Stamp size={20} />, sub: "Para marcar detalles" },
            ],
          },
          {
            label: "Sándwich",
            basic: true,
            icon: <Sandwich size={12} />,
            modes: [
              { value: "sandwich" as const, label: "Cortador sándwich", icon: <Sandwich size={20} />, sub: "Corte + sellado" },
            ],
          },
          {
            label: "Rodillo",
            basic: true,
            icon: <Cylinder size={12} />,
            modes: [
              { value: "roller" as const, label: "Rodillo de textura", icon: <PaintRoller size={20} />, sub: "Patrón repetido" },
            ],
          },
          {
            label: "Repostería",
            basic: true,
            icon: <CakeSlice size={12} />,
            modes: [
              { value: "topper" as const, label: "Topper de tarta", icon: <CakeSlice size={20} />, sub: "Relieve + pin" },
              { value: "stencil" as const, label: "Stencil", icon: <Grid3X3 size={20} />, sub: "Plantilla calada" },
              { value: "practice" as const, label: "Galleta de práctica", icon: <CircleDashed size={20} />, sub: "Forma con fondo" },
              { value: "cakepop" as const, label: "Molde cake pop", icon: <Lollipop size={20} />, sub: "Molde + prensador" },
            ],
          },
          {
            label: "Papelería",
            basic: true,
            icon: <Bookmark size={12} />,
            modes: [
              { value: "bookmark" as const, label: "Marcapáginas", icon: <Bookmark size={20} />, sub: "Para páginas de papel" },
            ],
          },
        ]
          .map((group) => {
            const explicitlyOpen = openGroups[group.label];
            const hasActive = group.modes.some((m) => m.value === settings.mode);
            const open = explicitlyOpen ?? (group.label === "Galletas" || hasActive);
            return (
              <div className="mode-group" key={group.label}>
                <button
                  type="button"
                  className={`mode-group-head${open ? " open" : ""}`}
                  aria-expanded={open}
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !open }))}
                >
                  <span className="mode-group-title">{group.icon}<span>{group.label}</span></span>
                  {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                {open && (
                  <div className="mode-grid">
                    {group.modes.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        className={`mode-card${settings.mode === m.value ? " on" : ""}`}
                        onClick={() => onChange({ mode: m.value })}
                      >
                        {m.icon}
                        <strong>{m.label}</strong>
                        <small>{m.sub}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        <div className="mode-group">
          <button
            type="button"
            className={`mode-group-head${openGroups.Cerámica ? " open" : ""}`}
            aria-expanded={!!openGroups.Cerámica}
            onClick={() => setOpenGroups((prev) => ({ ...prev, Cerámica: !prev.Cerámica }))}
          >
            <span className="mode-group-title"><Flower2 size={12} /><span>Cerámica</span></span>
            {openGroups.Cerámica ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {openGroups.Cerámica && (
          <div className="mode-grid">
            <button
              type="button"
              className="mode-card clay-preset"
              onClick={() => onChange({
                mode: "cutter",
                printer: "fdm04",
                lineWidth: 0.4,
                layerHeight: 0.2,
                bladeThickness: 1.2,
                bladeDepth: 10,
                baseHeight: 3,
                tipWidth: 0.4,
                stampRelief: 2,
              })}
            >
              <Scissors size={20} />
              <strong>Cortador de arcilla</strong>
              <small>Pared 1,2 mm y altura 10 mm</small>
            </button>
            <button
              type="button"
              className="mode-card clay-preset"
              onClick={() => onChange({
                mode: "multicutter",
                longest: 25,
                bladeThickness: 1,
                bladeDepth: 8,
                baseHeight: 2.5,
                baseWidth: 3,
                tipWidth: 0.4,
                multiRows: 2,
                multiCols: 3,
                multiSpacing: 4,
              })}
            >
              <Gem size={20} />
              <strong>Set de pendientes</strong>
              <small>6 cortadores pequeños</small>
            </button>
            <button
              type="button"
              className="mode-card clay-preset"
              onClick={() => onChange({
                mode: "stamp",
                bladeThickness: 1,
                stampBack: 5,
                stampRelief: 2,
                stampClearance: 0.8,
                stampBorder: false,
              })}
            >
              <Stamp size={20} />
              <strong>Sello de arcilla</strong>
              <small>Relieve suave sin borde</small>
            </button>
          </div>
          )}
        </div>
      </Section>

      {settings.mode !== "stencil" && settings.mode !== "bookmark" && (
      <Section
        id="size"
        title="Tamaño"
        icon={<Ruler size={16} />}
        defaultOpen
        summary={final ? `${finalW.toFixed(1)} × ${finalH.toFixed(1)} mm` : "—"}
      >
        <Segmented
          value={settings.sizeMode}
          options={[
            { value: "longest", label: "Lado mayor" },
            { value: "wh", label: "Ancho × alto" },
          ]}
          onChange={(v) => onChange({ sizeMode: v })}
        />
        {settings.sizeMode === "longest" ? (
          <NumberField
            label="Lado mayor del diseño"
            value={settings.longest}
            min={20}
            max={240}
            step={1}
            hint="Antes de añadir la cuchilla y la base."
            onChange={(v) => onChange({ longest: v })}
          />
        ) : (
          <>
            <NumberField label="Ancho" value={settings.width} min={15} max={240} step={0.5} onChange={setWidth} />
            <NumberField label="Alto" value={settings.height} min={15} max={240} step={0.5} onChange={setHeight} />
            <Toggle label="Mantener proporción" checked={settings.lockAspect} onChange={(v) => onChange({ lockAspect: v })} />
          </>
        )}
        <div className="size-note">
          <span>Tamaño final de la pieza</span>
          <strong>{final ? `${finalW.toFixed(1)} × ${finalH.toFixed(1)} mm` : "Calculando…"}</strong>
        </div>
      </Section>
      )}

      {advanced && (
      <Section
        id="printer"
        title="Impresión"
        icon={<Gauge size={16} />}
        defaultOpen
        summary={`${line.toFixed(2)} mm/línea`}
      >
        <label className="field-row">
          <span className="field-label">Perfil de impresora</span>
          <span className="field-input">
            <select value={settings.printer} onChange={(e) => onChange({ printer: e.target.value as DesignSettings["printer"] })}>
              {Object.entries(PRINTER_PROFILES).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
          </span>
        </label>
        <div className="two-fields">
          <NumberField label="Línea" value={settings.lineWidth} min={0.2} max={1} step={0.05} onChange={(v) => onChange({ lineWidth: v })} />
          <NumberField label="Altura de capa" value={settings.layerHeight} min={0.05} max={0.4} step={0.05} onChange={(v) => onChange({ layerHeight: v })} />
        </div>
        <label className="field-row">
          <span className="field-label">Cama de impresión</span>
          <span className="field-input">
            <select
              value={settings.bedModel}
              onChange={(e) => {
                const key = e.target.value;
                const preset = PRINTER_BEDS[key];
                if (!preset) return;
                onChange({ bedModel: key, bedWidth: preset.width, bedDepth: preset.depth });
              }}
            >
              {Object.entries(PRINTER_BEDS).map(([key, bed]) => (
                <option key={key} value={key}>
                  {key === "custom" ? `Cama personalizada · ${settings.bedWidth}×${settings.bedDepth}` : `${bed.label} · ${bed.width}×${bed.depth}`}
                </option>
              ))}
            </select>
          </span>
        </label>
        {settings.bedModel === "custom" && (
          <div className="two-fields">
            <NumberField label="Ancho de cama" value={settings.bedWidth} min={50} max={1000} step={1} onChange={(v) => onChange({ bedWidth: v, bedModel: "custom" })} />
            <NumberField label="Fondo de cama" value={settings.bedDepth} min={50} max={1000} step={1} onChange={(v) => onChange({ bedDepth: v, bedModel: "custom" })} />
          </div>
        )}
        <div className="inline-hint">
          <SlidersHorizontal size={13} />
          <span>
            Cama de <strong>{settings.bedWidth.toFixed(0)} × {settings.bedDepth.toFixed(0)} mm</strong> en el visor. Cuchilla = <strong>{Math.max(1, settings.bladeThickness / line).toFixed(1)} líneas</strong>. Mínimo 2 líneas.
          </span>
        </div>
        <button type="button" className="soft-button" onClick={onApplyPrintable}>
          <Wand2 size={14} /> Ajustar a líneas imprimibles
        </button>
      </Section>
      )}

      {advanced && (cutterLike || stampLike) && (
        <Section id="alignment" title="Alineación" icon={<Focus size={16} />} summary={settings.alignmentHole ? `${settings.alignmentHoleDiameter.toFixed(1)} mm` : "Desactivada"}>
          <Toggle
            label="Punto de alineación"
            hint="Un agujero mínimo en la base del cortador y en el sello, en el mismo ángulo, para orientarlos como las marcas de un objetivo."
            checked={settings.alignmentHole}
            onChange={(v) => onChange({ alignmentHole: v })}
          />
          {settings.alignmentHole && (
            <NumberField
              label="Diámetro del punto"
              value={settings.alignmentHoleDiameter}
              min={0.8}
              max={5}
              step={0.1}
              onChange={(v) => onChange({ alignmentHoleDiameter: v })}
            />
          )}
        </Section>
      )}

      {advanced && (
        <Section id="preprocess" title="Preprocesado del dibujo" icon={<Wand2 size={16} />} summary={settings.preprocessSmooth ? "Suave" : "Original"}>
          <Toggle
            label="Suavizar dibujo"
            hint="Desactivado por defecto para conservar los detalles finos del dibujo."
            checked={settings.preprocessSmooth}
            onChange={(v) => onChange({ preprocessSmooth: v })}
          />
          {settings.preprocessSmooth && (
            <>
              <div className="two-fields">
                <NumberField
                  label="Simplificar trazos"
                  value={settings.preprocessSimplify}
                  min={0}
                  max={0.8}
                  step={0.02}
                  hint="0 = sin simplificar"
                  onChange={(v) => onChange({ preprocessSimplify: v })}
                />
                <NumberField
                  label="Redondeo de uniones"
                  value={settings.preprocessAmount}
                  min={0}
                  max={1.5}
                  step={0.05}
                  hint={settings.preprocessPreserveCorners ? "Se aplica al desactivar respetar esquinas" : "Radio pequeño"}
                  onChange={(v) => onChange({ preprocessAmount: v })}
                />
              </div>
              <Toggle
                label="Respetar esquinas"
                hint="Mantén los vértices marcados del dibujo; solo se simplifican los trazos."
                checked={settings.preprocessPreserveCorners}
                onChange={(v) => onChange({ preprocessPreserveCorners: v })}
              />
              <Toggle
                label="Suavizar también los detalles"
                hint="Puede perder trazos muy finos. Desactivado por defecto."
                checked={settings.preprocessSmoothDetails}
                onChange={(v) => onChange({ preprocessSmoothDetails: v })}
              />
            </>
          )}
          <Toggle
            label="Quitar detalles minúsculos"
            hint="Puede eliminar detalles del dibujo. Desactivado por defecto."
            checked={settings.preprocessRemoveTiny}
            onChange={(v) => onChange({ preprocessRemoveTiny: v })}
          />
          {settings.preprocessRemoveTiny && (
            <NumberField
              label="Área mínima de detalle"
              value={settings.preprocessMinDetail}
              min={0.1}
              max={20}
              step={0.1}
              unit="mm²"
              onChange={(v) => onChange({ preprocessMinDetail: v })}
            />
          )}
        </Section>
      )}

      {cutterLike && (
      <Section
        id="blade"
        title="Cuchilla"
        icon={<Scissors size={16} />}
        defaultOpen
        summary={`${settings.bladeThickness.toFixed(2)} mm`}
      >
        <NumberField
          label="Grosor de la cuchilla"
          value={settings.bladeThickness}
          min={0.4}
          max={3}
          step={0.05}
          hint={`${(settings.bladeThickness / line).toFixed(1)} líneas`}
          onChange={(v) => onChange({ bladeThickness: v })}
        />
        <NumberField
          label="Profundidad de la cuchilla"
          value={settings.bladeDepth}
          min={5}
          max={25}
          step={0.5}
          hint="12 mm para galleta; 8–10 mm para arcilla."
          onChange={(v) => onChange({ bladeDepth: v })}
        />
        {advanced && (
          <>
            <Toggle
              label="Borde de corte afilado"
              hint="Chaflán superior para cortar limpio sin llegar a cuchillo."
              checked={settings.sharpEdge}
              onChange={(v) => onChange({ sharpEdge: v })}
            />
            {settings.sharpEdge && (
              <div className="two-fields">
                <NumberField label="Ancho de punta" value={settings.tipWidth} min={0.2} max={1.2} step={0.05} onChange={(v) => onChange({ tipWidth: v })} />
                <NumberField label="Altura del chaflán" value={settings.chamferHeight} min={0.5} max={5} step={0.1} onChange={(v) => onChange({ chamferHeight: v })} />
              </div>
            )}
            {supportsExtras && (
              <>
                <Toggle
                  label="Cuchilla extra"
                  hint="Refuerza la parte baja de la pared; opcional."
                  checked={settings.extraBlade}
                  onChange={(v) => onChange({ extraBlade: v })}
                />
                {settings.extraBlade && (
                  <div className="two-fields">
                    <NumberField label="Profundidad extra" value={settings.extraBladeDepth} min={1} max={settings.bladeDepth} step={0.5} onChange={(v) => onChange({ extraBladeDepth: v })} />
                    <NumberField label="Grosor extra" value={settings.extraBladeThickness} min={0.2} max={3} step={0.1} onChange={(v) => onChange({ extraBladeThickness: v })} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Section>
      )}

      {advanced && cutterLike && (
        <Section id="base" title="Base y mango" icon={<Box size={16} />} summary={`${settings.baseHeight.toFixed(1)} mm`}>
          <div className="two-fields">
            <NumberField label="Altura de la base" value={settings.baseHeight} min={1} max={12} step={0.5} onChange={(v) => onChange({ baseHeight: v })} />
            <NumberField label="Ancho de la base" value={settings.baseWidth} min={1} max={15} step={0.5} onChange={(v) => onChange({ baseWidth: v })} />
          </div>
          <label className="field-row">
            <span className="field-label">Forma de la base</span>
            <span className="field-input">
              <select value={settings.baseShape} onChange={(e) => onChange({ baseShape: e.target.value as DesignSettings["baseShape"] })}>
                <option value="chamfer">Chaflanada</option>
                <option value="rect">Rectangular</option>
                <option value="round">Redondeada</option>
              </select>
            </span>
          </label>
          {supportsExtras && (
            <>
              <Toggle
                label="Mango de presión"
                hint="Añade un agarre exterior para presionar con comodidad."
                checked={settings.addPressHandle}
                onChange={(v) => onChange({ addPressHandle: v })}
              />
              {settings.addPressHandle && (
                <>
                  <div className="two-fields">
                    <NumberField label="Largo" value={settings.pressHandleLength} min={10} max={80} step={1} onChange={(v) => onChange({ pressHandleLength: v })} />
                    <NumberField label="Ancho" value={settings.pressHandleWidth} min={5} max={25} step={0.5} onChange={(v) => onChange({ pressHandleWidth: v })} />
                  </div>
                  <NumberField label="Posición" value={settings.pressHandlePosition} min={0} max={100} step={5} unit="%" onChange={(v) => onChange({ pressHandlePosition: v })} />
                  <Toggle
                    label="Mango en ambos extremos"
                    hint="Añade un segundo agarre para presionar con las dos manos."
                    checked={settings.pressHandlesBothEnds}
                    onChange={(v) => onChange({ pressHandlesBothEnds: v })}
                  />
                </>
              )}
            </>
          )}
        </Section>
      )}

      {stampLike && (
        <Section
          id="stamp"
          title="Sello"
          icon={<Stamp size={16} />}
          defaultOpen
          summary={`${settings.stampRelief.toFixed(1)} mm relieve`}
        >
          <div className="two-fields">
            <NumberField label="Grosor del respaldo" value={settings.stampBack} min={2} max={12} step={0.5} onChange={(v) => onChange({ stampBack: v })} />
            <NumberField label="Profundidad del relieve" value={settings.stampRelief} min={0.5} max={8} step={0.5} onChange={(v) => onChange({ stampRelief: v })} />
          </div>
          <NumberField
            label="Holgura del sello"
            value={settings.stampClearance}
            min={0.2}
            max={3}
            step={0.1}
            hint={`${(settings.stampClearance / line).toFixed(1)} líneas`}
            onChange={(v) => onChange({ stampClearance: v })}
          />
          <div className="inline-hint">
            <CircleHelp size={13} />
            <span>El sello se genera un poco más pequeño para entrar dentro del cortador.</span>
          </div>
          <Toggle
            label="Borde perimetral del sello"
            hint="Deja un marco elevado a la misma altura que el dibujo. Desactívalo para que el borde quede a la altura de la base plana."
            checked={settings.stampBorder}
            onChange={(v) => onChange({ stampBorder: v })}
          />
          {advanced && settings.stampBorder && (
            <NumberField
              label="Ancho del borde"
              value={settings.stampBorderWidth}
              min={0.8}
              max={5}
              step={0.2}
              onChange={(v) => onChange({ stampBorderWidth: v })}
            />
          )}
          {advanced && (
            <Toggle
              label="Relieve negativo (hundido)"
              hint="Hunde el dibujo en el respaldo para dejar detalles en relieve sobre la masa."
              checked={settings.stampRecessed}
              onChange={(v) => onChange({ stampRecessed: v })}
            />
          )}
          {advanced && (
            <>
              <Toggle
                label="Quitar contorno exterior del sello"
                hint="Elimina la línea del borde para que el sello no marque el contorno de la galleta."
                checked={settings.stampRemoveOuterEdge}
                onChange={(v) => onChange({ stampRemoveOuterEdge: v })}
              />
              {settings.stampRemoveOuterEdge && (
                <label className="field-row">
                  <span className="field-label">Método de recorte</span>
                  <span className="field-input">
                    <select value={settings.stampEdgeMethod} onChange={(e) => onChange({ stampEdgeMethod: e.target.value as DesignSettings["stampEdgeMethod"] })}>
                      <option value="preserve">Conservar detalles completos</option>
                      <option value="offset">Recortar detalles en el borde</option>
                    </select>
                  </span>
                </label>
              )}
            </>
          )}
        </Section>
      )}

      {settings.mode === "imprint" && (
        <Section id="imprint" title="Profundidad de impronta" icon={<Layers size={16} />} defaultOpen summary={`${settings.imprintDepth.toFixed(1)} mm`}>
          <NumberField
            label="Profundidad desde la cuchilla"
            value={settings.imprintDepth}
            min={1}
            max={12}
            step={0.5}
            hint="0 sería enrasado con el filo; 4,5 mm es un buen comienzo."
            onChange={(v) => onChange({ imprintDepth: v })}
          />
        </Section>
      )}

      {settings.mode === "multicutter" && (
        <Section id="multi" title="Puzzle" icon={<Layers size={16} />} defaultOpen summary={`${settings.multiRows} × ${settings.multiCols}`}>
          <div className="two-fields">
            <NumberField label="Filas" value={settings.multiRows} min={1} max={6} step={1} unit="" onChange={(v) => onChange({ multiRows: Math.round(v) })} />
            <NumberField label="Columnas" value={settings.multiCols} min={1} max={6} step={1} unit="" onChange={(v) => onChange({ multiCols: Math.round(v) })} />
          </div>
          <NumberField label="Separación" value={settings.multiSpacing} min={0} max={30} step={0.5} onChange={(v) => onChange({ multiSpacing: v })} />
        </Section>
      )}

      {settings.mode === "sandwich" && (
        <Section id="sandwich" title="Cortador sándwich" icon={<Box size={16} />} defaultOpen summary={`${settings.sandwichSealWidth.toFixed(1)} mm sellado`}>
          <div className="two-fields">
            <NumberField label="Ancho de sellado" value={settings.sandwichSealWidth} min={1} max={12} step={0.5} onChange={(v) => onChange({ sandwichSealWidth: v })} />
            <NumberField label="Separación" value={settings.sandwichGap} min={0} max={4} step={0.1} onChange={(v) => onChange({ sandwichGap: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Tamaño de muesca" value={settings.sandwichDentSize} min={1} max={8} step={0.5} onChange={(v) => onChange({ sandwichDentSize: v })} />
            <NumberField label="Separación muescas" value={settings.sandwichDentSpacing} min={2} max={30} step={0.5} onChange={(v) => onChange({ sandwichDentSpacing: v })} />
          </div>
          <NumberField label="Profundidad de muesca" value={settings.sandwichDentDepth} min={0.2} max={5} step={0.2} onChange={(v) => onChange({ sandwichDentDepth: v })} />
        </Section>
      )}

      {settings.mode === "roller" && (
        <Section id="roller" title="Rodillo de textura" icon={<Crown size={16} />} defaultOpen summary={`${settings.rollerDiameter.toFixed(0)} × ${settings.rollerLength.toFixed(0)} mm`}>
          <div className="two-fields">
            <NumberField label="Diámetro" value={settings.rollerDiameter} min={15} max={120} step={1} onChange={(v) => onChange({ rollerDiameter: v })} />
            <NumberField label="Longitud" value={settings.rollerLength} min={20} max={200} step={1} onChange={(v) => onChange({ rollerLength: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Profundidad del relieve" value={settings.rollerRelief} min={0.3} max={5} step={0.1} onChange={(v) => onChange({ rollerRelief: v })} />
            <NumberField label="Eje" value={settings.rollerBore} min={0} max={30} step={0.5} onChange={(v) => onChange({ rollerBore: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Repeticiones alrededor" value={settings.rollerRepeatsAround} min={1} max={16} step={1} unit="" onChange={(v) => onChange({ rollerRepeatsAround: Math.round(v) })} />
            <NumberField label="A lo largo" value={settings.rollerRepeatsAlong} min={1} max={16} step={1} unit="" onChange={(v) => onChange({ rollerRepeatsAlong: Math.round(v) })} />
          </div>
          <NumberField label="Borde de extremo" value={settings.rollerRim} min={0} max={8} step={0.5} onChange={(v) => onChange({ rollerRim: v })} />
        </Section>
      )}

      {settings.mode === "cutter-set" && (
        <Section id="cutter-set" title="Set de cortadores" icon={<Scissors size={16} />} defaultOpen summary={`${settings.setCount} tamaños`}>
          <div className="two-fields">
            <NumberField label="Número de cortadores" value={settings.setCount} min={2} max={6} step={1} unit="" onChange={(v) => onChange({ setCount: Math.round(v) })} />
            <NumberField label="Reducción entre tamaños" value={settings.setStep * 100} min={5} max={45} step={1} unit="%" onChange={(v) => onChange({ setStep: v / 100 })} />
          </div>
          <NumberField label="Separación" value={settings.setSpacing} min={2} max={40} step={1} onChange={(v) => onChange({ setSpacing: v })} />
          <div className="inline-hint"><CircleHelp size={13} /><span>Se generan varios cortadores del mismo dibujo, de mayor a menor, en una sola pieza de impresión.</span></div>
        </Section>
      )}

      {settings.mode === "stencil" && (
        <Section id="stencil" title="Stencil" icon={<Layers size={16} />} defaultOpen summary={`${settings.stencilWidth.toFixed(0)} × ${settings.stencilHeight.toFixed(0)} mm`}>
          <div className="two-fields">
            <NumberField label="Ancho de lámina" value={settings.stencilWidth} min={30} max={250} step={1} onChange={(v) => onChange({ stencilWidth: v })} />
            <NumberField label="Alto de lámina" value={settings.stencilHeight} min={30} max={250} step={1} onChange={(v) => onChange({ stencilHeight: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Filas" value={settings.stencilRows} min={1} max={10} step={1} unit="" onChange={(v) => onChange({ stencilRows: Math.round(v) })} />
            <NumberField label="Columnas" value={settings.stencilCols} min={1} max={10} step={1} unit="" onChange={(v) => onChange({ stencilCols: Math.round(v) })} />
          </div>
          <div className="two-fields">
            <NumberField label="Tamaño de cada forma" value={settings.stencilShapeSize} min={0} max={80} step={1} hint="0 = ajustar al hueco" onChange={(v) => onChange({ stencilShapeSize: v })} />
            <NumberField label="Separación" value={settings.stencilSpacing} min={1} max={20} step={0.5} onChange={(v) => onChange({ stencilSpacing: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Margen exterior" value={settings.stencilMargin} min={0} max={20} step={0.5} onChange={(v) => onChange({ stencilMargin: v })} />
            <NumberField label="Grosor de lámina" value={settings.stencilThickness} min={0.6} max={4} step={0.1} onChange={(v) => onChange({ stencilThickness: v })} />
          </div>
          <label className="field-row">
            <span className="field-label">Disposición</span>
            <span className="field-input">
              <select value={settings.stencilPattern} onChange={(e) => onChange({ stencilPattern: e.target.value as DesignSettings["stencilPattern"] })}>
                <option value="grid">Cuadrícula</option>
                <option value="diagonal">Diagonal</option>
                <option value="random">Aleatoria</option>
              </select>
            </span>
          </label>
          {advanced && (
            <>
              <Toggle
                label="Puentes para islas interiores"
                hint="Mantiene unidas las islas del dibujo con finos puentes de material."
                checked={settings.stencilBridges}
                onChange={(v) => onChange({ stencilBridges: v })}
              />
              {settings.stencilBridges && (
                <NumberField label="Grosor del puente" value={settings.stencilBridgeWidth} min={0.6} max={5} step={0.2} onChange={(v) => onChange({ stencilBridgeWidth: v })} />
              )}
            </>
          )}
        </Section>
      )}

      {settings.mode === "topper" && (
        <Section id="topper" title="Topper de tarta" icon={<Crown size={16} />} defaultOpen summary={`${settings.topperThickness.toFixed(1)} mm base`}>
          <div className="two-fields">
            <NumberField label="Grosor de base" value={settings.topperThickness} min={1} max={12} step={0.5} onChange={(v) => onChange({ topperThickness: v })} />
            <NumberField label="Altura de relieve" value={settings.topperRelief} min={0.2} max={6} step={0.2} onChange={(v) => onChange({ topperRelief: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Respaldo perimetral" value={settings.topperBacking} min={0} max={15} step={0.5} onChange={(v) => onChange({ topperBacking: v })} />
            <NumberField label="Ancho del pin" value={settings.topperPinWidth} min={2} max={20} step={0.5} onChange={(v) => onChange({ topperPinWidth: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Largo del pin" value={settings.topperPinLength} min={5} max={120} step={1} onChange={(v) => onChange({ topperPinLength: v })} />
            <NumberField label="Posición del pin" value={settings.topperPinPosition} min={-100} max={100} step={5} unit="%" onChange={(v) => onChange({ topperPinPosition: v })} />
          </div>
          {advanced && (
            <Toggle
              label="Invertir relieve"
              hint="Eleva el fondo y deja el dibujo rebajado."
              checked={settings.topperInvert}
              onChange={(v) => onChange({ topperInvert: v })}
            />
          )}
        </Section>
      )}

      {settings.mode === "practice" && (
        <Section id="practice" title="Galleta de práctica" icon={<Scissors size={16} />} defaultOpen summary={`${settings.practiceWallHeight.toFixed(0)} mm pared`}>
          <div className="two-fields">
            <NumberField label="Grosor del fondo" value={settings.practiceThickness} min={1} max={10} step={0.5} onChange={(v) => onChange({ practiceThickness: v })} />
            <NumberField label="Altura de pared" value={settings.practiceWallHeight} min={2} max={20} step={0.5} onChange={(v) => onChange({ practiceWallHeight: v })} />
          </div>
          <NumberField label="Grosor de pared" value={settings.practiceWallWidth} min={0.8} max={5} step={0.1} onChange={(v) => onChange({ practiceWallWidth: v })} />
        </Section>
      )}

      {settings.mode === "bookmark" && (
        <Section id="bookmark" title="Marcapáginas" icon={<Bookmark size={16} />} defaultOpen summary={`${settings.bookmarkWidth.toFixed(0)} × ${settings.bookmarkHeight.toFixed(0)} mm`}>
          <div className="two-fields">
            <NumberField label="Ancho" value={settings.bookmarkWidth} min={20} max={150} step={1} onChange={(v) => onChange({ bookmarkWidth: v })} />
            <NumberField label="Alto" value={settings.bookmarkHeight} min={50} max={300} step={1} onChange={(v) => onChange({ bookmarkHeight: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Grosor" value={settings.bookmarkThickness} min={1.2} max={8} step={0.2} onChange={(v) => onChange({ bookmarkThickness: v })} />
            <NumberField label="Radio de esquina" value={settings.bookmarkCorner} min={0} max={30} step={0.5} onChange={(v) => onChange({ bookmarkCorner: v })} />
          </div>
          <NumberField label="Margen del dibujo" value={settings.bookmarkMargin} min={2} max={30} step={0.5} onChange={(v) => onChange({ bookmarkMargin: v })} />
          <Toggle
            label="Agujero para cinta"
            hint="Un agujero pasante en la parte superior para lana, cinta o cordón."
            checked={settings.bookmarkHole}
            onChange={(v) => onChange({ bookmarkHole: v })}
          />
          {settings.bookmarkHole && (
            <div className="two-fields">
              <NumberField label="Diámetro del agujero" value={settings.bookmarkHoleDiameter} min={2} max={20} step={0.5} onChange={(v) => onChange({ bookmarkHoleDiameter: v })} />
              <NumberField label="Margen al borde" value={settings.bookmarkHoleMargin} min={5} max={60} step={1} onChange={(v) => onChange({ bookmarkHoleMargin: v })} />
            </div>
          )}
          <div className="two-fields">
            <NumberField label="Relieve del dibujo" value={settings.bookmarkRelief} min={0} max={3} step={0.1} onChange={(v) => onChange({ bookmarkRelief: v })} />
            <label className="field-row">
              <span className="field-label">Estilo del dibujo</span>
              <span className="field-input">
                <select value={settings.bookmarkDesignStyle} onChange={(e) => onChange({ bookmarkDesignStyle: e.target.value as DesignSettings["bookmarkDesignStyle"] })}>
                  <option value="line">Línea</option>
                  <option value="relief">Silueta</option>
                  <option value="none">Sin dibujo</option>
                </select>
              </span>
            </label>
          </div>
          <div className="inline-hint"><Bookmark size={13} /><span>Lámina plana con diseño en relieve. Si el dibujo tiene muchos detalles finos, usa estilo Línea y revisa la vista previa.</span></div>
        </Section>
      )}

      {settings.mode === "cakepop" && (
        <Section id="cakepop" title="Molde cake pop" icon={<Box size={16} />} defaultOpen summary={`${settings.cakePopMoldHeight.toFixed(0)} mm profundidad`}>
          <div className="two-fields">
            <NumberField label="Profundidad del molde" value={settings.cakePopMoldHeight} min={6} max={40} step={0.5} onChange={(v) => onChange({ cakePopMoldHeight: v })} />
            <NumberField label="Grosor de pared" value={settings.cakePopMoldWall} min={1.2} max={8} step={0.2} onChange={(v) => onChange({ cakePopMoldWall: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Base del molde" value={settings.cakePopBase} min={1} max={8} step={0.5} onChange={(v) => onChange({ cakePopBase: v })} />
            <NumberField label="Agujero del palito" value={settings.cakePopStickHole} min={2.5} max={12} step={0.1} onChange={(v) => onChange({ cakePopStickHole: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Holgura del palito" value={settings.cakePopHoleClearance} min={0} max={2} step={0.1} onChange={(v) => onChange({ cakePopHoleClearance: v })} />
            <NumberField label="Holgura del prensador" value={settings.cakePopPlungerClearance} min={0.2} max={2.5} step={0.1} onChange={(v) => onChange({ cakePopPlungerClearance: v })} />
          </div>
          <div className="two-fields">
            <NumberField label="Respaldo del prensador" value={settings.cakePopPlungerBack} min={1} max={8} step={0.5} onChange={(v) => onChange({ cakePopPlungerBack: v })} />
            <NumberField label="Relieve del prensador" value={settings.cakePopRelief} min={0.2} max={6} step={0.2} onChange={(v) => onChange({ cakePopRelief: v })} />
          </div>
          <div className="inline-hint"><CircleHelp size={13} /><span>Incluye molde y prensador. El palito se inserta por el agujero central; imprime con la cara plana sobre la cama.</span></div>
        </Section>
      )}

      {advanced && supportsExtras && (
        <Section id="bars" title="Barras centrales" icon={<Layers size={16} />} summary={settings.addBar ? "Activas" : "Desactivadas"}>
          <Toggle
            label="Añadir barra central"
            hint="Refuerza cortadores grandes y conecta zonas abiertas."
            checked={settings.addBar}
            onChange={(v) => onChange({ addBar: v })}
          />
          {settings.addBar && (
            <>
              <NumberField label="Ángulo" value={settings.barAngle} min={0} max={179} step={1} unit="°" onChange={(v) => onChange({ barAngle: v })} />
              <NumberField label="Posición" value={settings.barPosition} min={0} max={100} step={1} unit="%" onChange={(v) => onChange({ barPosition: v })} />
              <NumberField
                label="Ancho"
                value={settings.barWidth}
                min={0.8}
                max={8}
                step={0.1}
                hint={`${(settings.barWidth / line).toFixed(1)} líneas`}
                onChange={(v) => onChange({ barWidth: v })}
              />
            </>
          )}
        </Section>
      )}

      {advanced && (
        <Section id="color" title="Color y nombres" icon={<Crown size={16} />} summary={assetColor}>
          <div className="color-row">
            <span className="field-label">Color de este archivo<small>Se usa en la vista y en el 3MF.</small></span>
            <input type="color" value={assetColor} onChange={(e) => onColorChange?.(e.target.value)} aria-label="Color del archivo" />
          </div>
          <label className="field-row">
            <span className="field-label">Renombrar</span>
            <span className="field-input wide">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => nameDraft.trim() && onRename?.(nameDraft.trim())}
                onKeyDown={(e) => { if (e.key === "Enter" && nameDraft.trim()) onRename?.(nameDraft.trim()); }}
                maxLength={48}
              />
            </span>
          </label>
          <div className="bulk-rename">
            <input value={bulkName} onChange={(e) => setBulkName(e.target.value)} placeholder="Base para todos" maxLength={32} />
            <button type="button" className="soft-button" onClick={() => onRenameAll?.(bulkName)}>Renombrar todos</button>
          </div>
        </Section>
      )}

      {advanced && (
        <Section id="cost" title="Coste del material" icon={<Crown size={16} />} summary={`${plaPricePerKg.toFixed(2)} €/kg`}>
          <NumberField
            label="Precio del PLA"
            value={plaPricePerKg}
            min={1}
            max={100}
            step={0.5}
            unit="€/kg"
            hint="Precio fijo por kilogramo. El coste se calcula con el peso estimado."
            onChange={(v) => onPlaPriceChange?.(v)}
          />
          <div className="inline-hint">
            <CircleHelp size={13} />
            <span>El peso y el coste aparecen en la barra inferior y en el resumen de exportación.</span>
          </div>
        </Section>
      )}

      {advanced && (
        <Section id="profiles" title="Perfiles" icon={<Bookmark size={16} />} summary={`${profiles.length} guardado${profiles.length === 1 ? "" : "s"}`}>
          <div className="profile-save">
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="Nombre del perfil"
              maxLength={32}
              onKeyDown={(event) => { if (event.key === "Enter") saveProfile(); }}
            />
            <button type="button" className="soft-button" onClick={saveProfile} disabled={!profileName.trim()}>
              <Bookmark size={13} /> Guardar
            </button>
          </div>
          {profiles.length > 0 ? (
            <div className="profile-list">
              {profiles.map((profile) => (
                <div className="profile-row" key={profile.id}>
                  <span title={profile.name}>{profile.name}</span>
                  <button type="button" className="mini-link" onClick={() => applyProfile(profile)}>Aplicar</button>
                  <button type="button" className="mini-link danger" onClick={() => removeProfile(profile.id)}>Borrar</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-hint"><Bookmark size={13} /><span>Guarda tus ajustes de cuchilla, base, sello y preprocesado para reutilizarlos en otro diseño.</span></div>
          )}
        </Section>
      )}

      {advanced && (
        <Section id="experimental" title="Avanzado" icon={<SlidersHorizontal size={16} />}>
          <Toggle
            label="Espejo"
            hint="Invierte el diseño horizontalmente; útil para parejas izquierda/derecha."
            checked={settings.mirror}
            onChange={(v) => onChange({ mirror: v })}
          />
          {["cutter", "cutter-stamp", "stamp"].includes(settings.mode) && (
            <Toggle
              label="Par espejo"
              hint="Genera también la versión invertida como pieza separada en el mismo modelo."
              checked={settings.mirrorPair}
              onChange={(v) => onChange({ mirrorPair: v })}
            />
          )}
          <Toggle
            label="Ajustar valores al cambiar de perfil"
            hint="Aplica grosores recomendados al cambiar entre 0,4 / 0,6 / resina."
            checked={settings.autoPrintable}
            onChange={(v) => onChange({ autoPrintable: v })}
          />
          <div className="inline-hint">
            <CircleHelp size={13} />
            <span>Los archivos no se suben a ningún servidor. Guarda el proyecto para conservar ajustes y colores.</span>
          </div>
        </Section>
      )}

      <button type="button" className="export-button" onClick={onExport}>
        <Scissors size={17} />
        Exportar modelos
      </button>
      <div className="panel-footnote">STL · 3MF · proyecto .calicocutters importable</div>
    </div>
  );
}

