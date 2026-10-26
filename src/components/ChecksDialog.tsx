import { AlertTriangle, CheckCircle2, ShieldCheck, Wand2, X } from "lucide-react";
import type { PrintCheck } from "../types";

export default function ChecksDialog({
  open,
  onClose,
  checks,
  onApplyFix,
  onView,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  checks: PrintCheck[];
  onApplyFix?: (code: string) => void;
  onView?: (kind: "top" | "front" | "side" | "bottom") => void;
  onExport?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Comprobaciones de impresión">
      <div className="modal checks-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Impresión 3D</span>
            <h2>Comprobaciones</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="checks-list">
          {checks.map((c, i) => (
            <div key={`${c.title}-${i}`} className={`check-row ${c.level}`}>
              {c.level === "ok" ? <CheckCircle2 size={17} /> : c.level === "warn" ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
              <div>
                <strong>{c.title}</strong>
                <p>{c.detail}</p>
              </div>
              {c.code && c.level !== "ok" && onApplyFix && (
                <button type="button" className="check-fix" onClick={() => onApplyFix(c.code!)}>
                  <Wand2 size={12} /> Aplicar
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="preflight-card">
          <div>
            <span className="eyebrow">Antes de imprimir</span>
            <strong>Revisión rápida del modelo</strong>
            <p>Mira la pieza desde arriba, de lado y por debajo. Comprueba que el filo es continuo y que no hay islas sueltas.</p>
          </div>
          <div className="preflight-actions">
            {onView && (
              <>
                <button type="button" className="soft-button" onClick={() => onView("top")}>Superior</button>
                <button type="button" className="soft-button" onClick={() => onView("side")}>Lateral</button>
                <button type="button" className="soft-button" onClick={() => onView("bottom")}>Inferior</button>
              </>
            )}
            {onExport && <button type="button" className="soft-button" onClick={onExport}>Exportar</button>}
          </div>
          <small>Después imprime una prueba, mide el lado mayor y pruébala con masa fría antes de hacer una tanda.</small>
        </div>
        <div className="help-note soft">
          <p>
            Estas comprobaciones usan el ancho de línea y la geometría generada. Las partes finas o pequeñas pueden
            desgastarse, doblarse o caer con el tiempo, sobre todo si son muy altas. Pulsa “Aplicar” en un aviso para
            corregir ese ajuste. El slicer sigue siendo la última comprobación: revisa la vista previa de capas.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
