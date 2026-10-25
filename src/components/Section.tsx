import { type ReactNode, useState } from "react";

export default function Section({
  id,
  title,
  icon,
  summary,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`sect${open ? " open" : ""}`} id={`sect-${id}`}>
      <button type="button" className="sect-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {icon && <span className="sect-icon">{icon}</span>}
        <span className="sect-title">{title}</span>
        {summary && <span className="sect-summary">{summary}</span>}
        <span className="sect-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="sect-body">{children}</div>}
    </section>
  );
}
