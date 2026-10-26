import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

export const SettingsSearchContext = createContext("");

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
  const search = useContext(SettingsSearchContext).trim().toLowerCase();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [matches, setMatches] = useState(true);

  useEffect(() => {
    if (!search) {
      setMatches(true);
      return;
    }
    const body = bodyRef.current?.textContent ?? "";
    setMatches(`${title} ${body}`.toLowerCase().includes(search));
  }, [search, title, children]);

  if (search && !matches) return null;
  const expanded = open || !!search;
  return (
    <section className={`sect${expanded ? " open" : ""}`} id={`sect-${id}`}>
      <button type="button" className="sect-head" onClick={() => setOpen((v) => !v)} aria-expanded={expanded}>
        {icon && <span className="sect-icon">{icon}</span>}
        <span className="sect-title">{title}</span>
        {summary && <span className="sect-summary">{summary}</span>}
        <span className="sect-arrow">{expanded ? "▾" : "▸"}</span>
      </button>
      <div ref={bodyRef} className="sect-body" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}
