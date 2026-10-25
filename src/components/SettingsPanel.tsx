import { useEffect, useState } from "react";
import {
  Box,
  CircleHelp,
  Crown,
  Gauge,
  Layers,
  Ruler,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Wand2,
} from "lucide-react";
import type { BuildResult, DesignSettings, DesignShape, PrintCheck } from "../types";
import { PRINTER_PROFILES } from "../types";
import Section from "./Section";
import Toggle from "./Toggle";

function levelOf(checks: PrintCheck[]): "ok" | "warn" | "error" {
  if (checks.some((c) => c.level === "error")) return "error";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "ok";
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
  return (
    <label className="field-row">
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="field-input">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
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
  onColorChange?: (color: string) => void;
  onRename?: (name: string) => void;
  onRenameAll?: (base: string) => void;
  plaPricePerKg?: number;
  onPlaPriceChange?: (value: number) => void;
}) {
  const [nameDraft, setNameDraft] = useState(selectionNames[0] ?? "");
  const [bulkName, setBulkName] = useState("galleta");
  useEffect(() => {
    setNameDraft(selectionNames[0] ?? "");
  }, [selectionNames[0]]);
  const line = settings.lineWidth || 0.4;
  const level = levelOf(checks);
  const printer = PRINTER_PROFILES[settings.printer];
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
          <strong>{level === "ok" ? "Listo para imprimir" : level === "warn" ? "Revisar antes de imprimir" : "Hay un problema"}</strong>
          <small>
            {level === "ok"
              ? `${printer.label} · línea ${line.toFixed(2)} mm`
              : checks.filter((c) => c.level !== "ok").length + " aviso(s) de impresión"}
          </small>
        </span>
        <CircleHelp size={16} />
      </button>

      {!advanced && (
        <p className="basic-hint">Básico: elige modo, tamaño, cuchilla y sello. Cambia a Avanzado para impresión, base, color, nombres, coste y refuerzos.</p>
      )}

      <Section id="mode" title="Qué vas a crear" icon={<Crown size={16} />} defaultOpen summary={settings.mode === "cutter-stamp" ? "2 piezas" : "1 pieza"}>
        <div className="mode-grid">
          {[
            { value: "cutter-stamp" as const, label: "Stamper + cortador", icon: <Layers size={20} />, sub: "El modo por defecto" },
            { value: "cutter" as const, label: "Solo cortador", icon: <Scissors size={20} />, sub: "Contorno exterior" },
            { value: "stamp" as const, label: "Solo sello", icon: <Stamp size={20} />, sub: "Para marcar detalles" },
            { value: "imprint" as const, label: "Impronta", icon: <Sparkles size={20} />, sub: "Corte + relieve en una pieza" },
            { value: "multicutter" as const, label: "Puzzle", icon: <Layers size={20} />, sub: "Rejilla de copias" },
            { value: "sandwich" as const, label: "Sándwich", icon: <Box size={20} />, sub: "Corte + sellado" },
            { value: "roller" as const, label: "Rodillo", icon: <Crown size={20} />, sub: "Textura repetida" },
          ]
            .filter((m) => advanced || m.value === settings.mode || ["cutter-stamp", "cutter", "stamp", "imprint"].includes(m.value))
            .map((m) => (
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
      </Section>

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
          <span>Tamaño final con base</span>
          <strong>{final ? `${finalW.toFixed(1)} × ${finalH.toFixed(1)} mm` : "Calculando…"}</strong>
        </div>
      </Section>

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
        <div className="inline-hint">
          <SlidersHorizontal size={13} />
          <span>
            Cuchilla = <strong>{Math.max(1, settings.bladeThickness / line).toFixed(1)} líneas</strong>. Mínimo 2 líneas.
          </span>
        </div>
        <button type="button" className="soft-button" onClick={onApplyPrintable}>
          <Wand2 size={14} /> Ajustar a líneas imprimibles
        </button>
      </Section>
      )}

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
      </Section>

      {advanced && (
        <Section id="base" title="Base y mango" icon={<Box size={16} />} summary={`${settings.baseHeight.toFixed(1)} mm`}>
          <div className="two-fields">
            <NumberField label="Altura de la base" value={settings.baseHeight} min={1} max={12} step={0.5} onChange={(v) => onChange({ baseHeight: v })} />
            <NumberField label="Ancho de la base" value={settings.baseWidth} min={1} max={15} step={0.5} onChange={(v) => onChange({ baseWidth: v })} />
          </div>
          <label className="field-row">
            <span className="field-label">Forma del mango</span>
            <span className="field-input">
              <select value={settings.baseShape} onChange={(e) => onChange({ baseShape: e.target.value as DesignSettings["baseShape"] })}>
                <option value="chamfer">Chaflanada</option>
                <option value="rect">Rectangular</option>
                <option value="round">Redondeada</option>
              </select>
            </span>
          </label>
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
              <NumberField label="Posición" value={settings.pressHandlePosition} min={-100} max={100} step={5} unit="%" onChange={(v) => onChange({ pressHandlePosition: v })} />
            </>
          )}
        </Section>
      )}

      {(settings.mode === "cutter-stamp" || settings.mode === "stamp") && (
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
          {advanced && (
            <>
              <Toggle
                label="Borrar contorno exterior"
                hint="Elimina el contorno exterior del dibujo para que solo queden los detalles interiores."
                checked={settings.stampRemoveOuterEdge}
                onChange={(v) => onChange({ stampRemoveOuterEdge: v })}
              />
              {settings.stampRemoveOuterEdge && (
                <label className="field-row">
                  <span className="field-label">Método</span>
                  <span className="field-input">
                    <select value={settings.stampEdgeMethod} onChange={(e) => onChange({ stampEdgeMethod: e.target.value as DesignSettings["stampEdgeMethod"] })}>
                      <option value="preserve">Preservar silueta</option>
                      <option value="offset">Recortar hacia dentro</option>
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

      {advanced && (
        <Section id="bars" title="Barras centrales" icon={<Layers size={16} />} summary={settings.addBar ? "Activas" : "Desactivadas"}>
          <Toggle
            label="Añadir barra central"
            hint="Refuerza cortadores grandes y conecta zonas abiertas."
            checked={settings.addBar}
            onChange={(v) => onChange({ addBar: v })}
          />
          {settings.addBar && (
            <>
              <NumberField label="Ángulo" value={settings.barAngle} min={0} max={179} step={1} unit="°" onChange={(v) => onChange({ barAngle: v })} />
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
        <Section id="experimental" title="Avanzado" icon={<SlidersHorizontal size={16} />}>
          <Toggle
            label="Espejo"
            hint="Invierte el diseño horizontalmente; útil para parejas izquierda/derecha."
            checked={settings.mirror}
            onChange={(v) => onChange({ mirror: v })}
          />
          <Toggle
            label="Ajustar valores al cambiar de perfil"
            hint="Aplica grosores recomendados al cambiar entre 0,4 / 0,6 / resina."
            checked={settings.autoPrintable}
            onChange={(v) => onChange({ autoPrintable: v })}
          />
          <div className="inline-hint">
            <CircleHelp size={13} />
            <span>Los ajustes se guardan en este navegador. Los archivos no se suben a ningún servidor.</span>
          </div>
        </Section>
      )}

      <button type="button" className="export-button" onClick={onExport}>
        <Scissors size={17} />
        Exportar cortador y sello
      </button>
      <div className="panel-footnote">STL · 3MF · proyecto .calicocutters importable</div>
    </div>
  );
}

