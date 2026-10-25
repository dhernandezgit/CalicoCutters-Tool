import { useState } from "react";
import { Type, X } from "lucide-react";
import { TEXT_FONTS, textToPngFile, type TextShapeOptions } from "../lib/textShape";

export default function TextDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (file: File) => void | Promise<void>;
}) {
  const [text, setText] = useState("Feliz cumpleaños");
  const [fontFamily, setFontFamily] = useState<string>(TEXT_FONTS[0]);
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [connect, setConnect] = useState(true);
  const [uppercase, setUppercase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const options: TextShapeOptions = {
    text,
    fontFamily,
    bold,
    italic,
    letterSpacing,
    connect,
    uppercase,
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const file = await textToPngFile(options);
      await onCreate(file);
      onClose();
    } catch (err) {
      setError(String((err as Error)?.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Crear diseño desde texto">
      <div className="modal text-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Nuevo diseño</span>
            <h2>Crear desde texto</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="text-modal-body">
          <label className="field-row">
            <span className="field-label">Texto</span>
            <span className="field-input wide">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={60}
                placeholder="Nombre, palabra o frase corta"
                autoFocus
              />
            </span>
          </label>

          <div className={`text-preview${uppercase ? " uppercase" : ""}`} style={{ fontFamily, fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal", letterSpacing }}>
            {text || "Tu texto"}
          </div>

          <div className="two-fields">
            <label className="field-row">
              <span className="field-label">Tipografía</span>
              <span className="field-input">
                <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
                  {TEXT_FONTS.map((font) => <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>)}
                </select>
              </span>
            </label>
            <label className="field-row">
              <span className="field-label">Espaciado</span>
              <span className="field-input">
                <input
                  type="number"
                  value={letterSpacing}
                  min={-20}
                  max={80}
                  step={1}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) setLetterSpacing(Math.min(80, Math.max(-20, value)));
                  }}
                />
                <span>px</span>
              </span>
            </label>
          </div>

          <div className="text-checks">
            <label><input type="checkbox" checked={bold} onChange={(event) => setBold(event.target.checked)} /> Negrita</label>
            <label><input type="checkbox" checked={italic} onChange={(event) => setItalic(event.target.checked)} /> Cursiva</label>
            <label><input type="checkbox" checked={uppercase} onChange={(event) => setUppercase(event.target.checked)} /> Mayúsculas</label>
            <label><input type="checkbox" checked={connect} onChange={(event) => setConnect(event.target.checked)} /> Unir letras por la base</label>
          </div>

          <div className="inline-hint">
            <Type size={13} />
            <span>
              El texto se convierte en una silueta de una pieza y se puede usar en cualquier modo.
              Si desactivas “unir letras”, las letras separadas pueden quedar fuera del contorno principal.
            </span>
          </div>
          {error && <div className="export-result warn" role="alert">{error}</div>}
        </div>

        <div className="modal-actions">
          <button type="button" className="soft-button" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary" onClick={create} disabled={busy || !text.trim()}>
            <Type size={15} /> {busy ? "Creando…" : "Crear diseño"}
          </button>
        </div>
      </div>
    </div>
  );
}
