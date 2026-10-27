import { Heart, X } from "lucide-react";

export const DONATE_URL = "https://paypal.me/Darkniel42";

export default function DonateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Apoyar CalicoCutters">
      <div className="modal donate-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Apoyar</span>
            <h2>¿Te ha servido CalicoCutters?</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="donate-heart"><Heart size={34} /></div>
        <p className="donate-copy">
          CalicoCutters es gratis, local y sin anuncios. Si quieres ayudar a mantener el motor, los tests y las
          próximas herramientas, puedes apoyar el proyecto por PayPal.
        </p>
        <div className="donate-actions">
          <a className="primary donate-link" href={DONATE_URL} target="_blank" rel="noreferrer">
            <Heart size={16} /> Apoyar en PayPal
          </a>
          <button type="button" className="soft-button" onClick={onClose}>Ahora no</button>
        </div>
        <p className="donate-small">También puedes compartir la app o enviar feedback. Es gratis y ayuda muchísimo.</p>
      </div>
    </div>
  );
}
