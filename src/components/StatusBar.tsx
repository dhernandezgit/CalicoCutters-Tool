import { CircleHelp, Heart, ShieldCheck, TriangleAlert } from "lucide-react";
import type { BuildResult, DesignShape, PrintCheck } from "../types";
import Logo from "./Logo";

function levelOf(checks: PrintCheck[]): "ok" | "warn" | "error" {
  if (checks.some((c) => c.level === "error")) return "error";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "ok";
}

export default function StatusBar({
  shape,
  build,
  checks,
  engineReady,
  assetCount = 0,
  building = false,
  progressText = "",
  plaPricePerKg = 14,
  onHelp,
  onChecks,
  onDonate,
}: {
  shape: DesignShape | null;
  build: BuildResult | null;
  checks: PrintCheck[];
  engineReady: boolean;
  assetCount?: number;
  building?: boolean;
  progressText?: string;
  plaPricePerKg?: number;
  onHelp: () => void;
  onChecks: () => void;
  onDonate?: () => void;
}) {
  const level = build ? levelOf(checks) : "warn";
  const dims = build?.dimensions;
  const grams = build?.material_grams ?? 0;
  const price = (grams / 1000) * plaPricePerKg;
  return (
    <footer className="statusbar">
      <Logo small />
      <div className="status-project">
        <strong>{shape?.name || "Sin diseño"}</strong>
        <span>{engineReady ? `${assetCount} archivo${assetCount === 1 ? "" : "s"} · motor Python listo` : "cargando motor…"}</span>
      </div>
      <div className="status-chips">
        <span className="stat-chip">
          <b>{dims ? `${dims.width.toFixed(1)} × ${dims.height.toFixed(1)}` : "—"}</b>
          mm
        </span>
        <span className="stat-chip">
          <b>{build ? grams.toFixed(1) : "—"}</b>
          g PLA
        </span>
        <span className="stat-chip price">
          <b>{build ? `${price.toFixed(2)} €` : "—"}</b>
          a {plaPricePerKg.toFixed(2)} €/kg
        </span>
      </div>
      <button type="button" className={`status-ready ${level}`} onClick={onChecks}>
        {level === "ok" ? <ShieldCheck size={15} /> : <TriangleAlert size={15} />}
        {!build ? "Sin modelo" : level === "ok" ? "Print-ready" : level === "warn" ? "Revisar" : "Error"}
      </button>
      <button type="button" className="status-action" onClick={onHelp}>
        <CircleHelp size={15} /> Cómo usar
      </button>
      {onDonate && (
        <button type="button" className="status-action donate" onClick={onDonate}>
          <Heart size={15} /> Apoyar
        </button>
      )}
      <span className="status-lang">ES</span>
      <span className="status-version">v0.7.1</span>
      {building && (
        <div className="statusbar-progress" role="status" aria-live="polite">
          <div className="statusbar-progress-bar" />
          <span>{progressText || "Procesando…"}</span>
        </div>
      )}
    </footer>
  );
}
