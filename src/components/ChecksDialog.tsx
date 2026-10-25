import { AlertTriangle, CheckCircle2, ShieldCheck, Wand2, X } from "lucide-react";
import type { PrintCheck } from "../types";

export default function ChecksDialog({
  open,
  onClose,
  checks,
  onApplyFix,
}: {
  open: boolean;
  onClose: () => void;
  checks: PrintCheck[];
  onApplyFix?: (code: string) => void;
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
