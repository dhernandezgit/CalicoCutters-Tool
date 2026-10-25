export interface ProgressState {
  percent: number;
  label: string;
  text: string;
  indeterminate?: boolean;
}

export default function ProcessingBar({ progress }: { progress: ProgressState | null }) {
  if (!progress) return null;
  return (
    <div className={`processing-bar${progress.indeterminate ? " indeterminate" : ""}`} role="status" aria-live="polite">
      <div className="processing-fill" style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }} />
      <div className="processing-label">
        <strong>{progress.label}</strong>
        <span>{progress.text}</span>
        <b>{progress.indeterminate ? "…" : `${Math.round(progress.percent)}%`}</b>
      </div>
    </div>
  );
}
