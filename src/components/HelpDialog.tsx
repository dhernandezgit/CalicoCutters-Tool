import { Download, ImagePlus, Printer, Ruler, ShieldCheck, X } from "lucide-react";

export default function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Cómo usar CalicoCutters">
      <div className="modal help-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Guía rápida</span>
            <h2>De un dibujo a un cortador imprimible</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="help-steps">
          <div className="help-step">
            <span className="help-num">1</span>
            <ImagePlus size={20} />
            <div>
              <strong>Sube o pega tu diseño</strong>
              <p>SVG, PNG, JPG o WebP. Los dibujos de líneas se rellenan para crear la silueta exterior y los detalles interiores se usan para el sello.</p>
            </div>
          </div>
          <div className="help-step">
            <span className="help-num">2</span>
            <Ruler size={20} />
            <div>
              <strong>Ajusta el tamaño</strong>
              <p>El tamaño se mide en milímetros y se mantiene la proporción. La base y el mango se añaden después, por eso el tamaño final es algo mayor.</p>
            </div>
          </div>
          <div className="help-step">
            <span className="help-num">3</span>
            <ShieldCheck size={20} />
            <div>
              <strong>Respeta las líneas de impresión</strong>
              <p>Con boquilla de 0,4 mm, una cuchilla de 0,8 mm son 2 líneas. La app avisa si una pared, un filo o un agujero no se puede imprimir. Pulsa “Ajustar a líneas imprimibles”.</p>
            </div>
          </div>
          <div className="help-step">
            <span className="help-num">4</span>
            <Download size={20} />
            <div>
              <strong>Exporta STL o 3MF</strong>
              <p>El STL es universal. El 3MF conserva cortador y sello como objetos separados, con nombres y colores, y es el formato recomendado para Bambu Studio.</p>
            </div>
          </div>
          <div className="help-step">
            <span className="help-num">5</span>
            <Printer size={20} />
            <div>
              <strong>Imprime plano y sin soportes</strong>
              <p>Cortador con la base en la cama y filo hacia arriba. Sello con el respaldo en la cama. 0,2 mm de capa, 3–4 perímetros y 15–20 % de relleno.</p>
            </div>
          </div>
        </div>

        <div className="help-note">
          <strong>Bambu Studio</strong>
          <p>
            Descarga el 3MF y ábrelo con doble clic o arrastrándolo a Bambu Studio. No hay botón de apertura directa:
            Bambu Studio bloquea las URLs de dominios de terceros. El 3MF conserva los objetos separados y sus nombres.
          </p>
        </div>

        <div className="help-note soft">
          <strong>Privacidad</strong>
          <p>El motor Python se ejecuta en tu navegador con WebAssembly. Tus archivos no se suben a ningún servidor.</p>
        </div>

        <div className="modal-actions">
          <button type="button" className="primary" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
