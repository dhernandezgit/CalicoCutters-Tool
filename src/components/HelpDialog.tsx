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
              <strong>Sube, pega o escribe tu diseño</strong>
              <p>SVG, PNG, JPG o WebP, o crea una silueta desde texto con el botón “Texto”. Los dibujos de líneas se rellenan para crear la silueta exterior y los detalles interiores se usan para el sello.</p>
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
              <strong>Elige formato y guarda</strong>
              <p>STL, OBJ, SVG, 3MF, PDF de contorno o mockup PNG, por diseño o de los seleccionados/todos. Cortador y sello van juntos en el mismo archivo. Se pide una ubicación por archivo y el navegador propone la misma carpeta; el proyecto se guarda también allí.</p>
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
          <strong>Visualización</strong>
          <p>
            El botón “Vista” abre una escena tipo CookieCAD V8: 14 superficies de color, mármol o madera;
            materiales sólidos, bicolor, degradado, glitter o seda; masa con galleta suelta, regla y moneda;
            medidas 3D y centro de giro movible. Haz clic en la pieza o en la masa para orbitar alrededor de ese punto;
            con el botón derecho desplazas la vista. También hay captura PNG, pantalla completa y ajuste de cámara.
          </p>
        </div>

        <div className="help-note">
          <strong>Preparación y primera impresión</strong>
          <p>
            Antes de exportar, revisa la pieza desde arriba, de lado y por debajo y comprueba que el filo sea continuo.
            Empieza con un tamaño de 3–4 pulgadas, imprime una prueba, mide el lado mayor y pruébala con masa fría.
            El panel de comprobaciones incluye atajos de vista y consejos de imagen para siluetas limpias.
          </p>
        </div>

        <div className="help-note">
          <strong>Base, suavizado y alineación</strong>
          <p>
            En Avanzado puedes elegir la cama de tu impresora (Bambu, Prusa, Creality, Elegoo, Anycubic, Sovol, QIDI,
            Voron y más) o introducir medidas personalizadas. El preprocesado suaviza trazos rectos y elimina detalles
            minúsculos; el punto de alineación es un hundido superficial en la cara inferior del cortador y del sello,
            no un agujero pasante, para orientarlos sin marcar la masa. Puedes desactivarlo.
          </p>
        </div>

        <div className="help-note">
          <strong>Perfiles, búsqueda y tema</strong>
          <p>
            En Avanzado puedes guardar ajustes de cuchilla, base, sello, cama y preprocesado, incluyendo opcionalmente
            el tamaño final y la escena de la vista previa. El buscador de ajustes filtra por nombre y contenido.
            El botón de tema de la cabecera alterna entre modo claro y oscuro y recuerda tu elección.
          </p>
        </div>

        <div className="help-note">
          <strong>Más que un cortador</strong>
          <p>
            El menú “Qué vas a crear” agrupa galletas, sellos, sándwich, rodillo, repostería y papelería:
            cortador + sello, cortador, cortador con relieve, sello, sándwich, rodillo de textura, topper,
            stencil, galleta de práctica, molde cake pop y pinza de página plana con bisagras vivas.
            Cada tipo cambia el resultado; no hay variantes que repitan el mismo cortador.
          </p>
        </div>

        <div className="help-note">
          <strong>Bambu Studio</strong>
          <p>
            Descarga el 3MF y ábrelo con doble clic o arrastrándolo a Bambu Studio. No hay botón de apertura directa:
            Bambu Studio bloquea las URLs de dominios de terceros. El 3MF conserva los objetos separados y sus nombres.
            También puedes usar “3MF conjunto” para colocar varios diseños en una sola escena.
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
