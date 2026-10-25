export default function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="toggle-row">
      <span className="toggle-copy">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-dot" />
      </button>
    </label>
  );
}
