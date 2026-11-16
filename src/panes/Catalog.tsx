import { useEffect, useRef, useState } from "react";
import { useCatalog, errorText, isLoading } from "./data";
import { formatCount, tableRef } from "./format";
import { ErrorState, Loading, Shell, Empty } from "./states";
import type { PaneProps } from "./props";

export function CatalogPane({ paused, focused, openBeside, peek }: PaneProps) {
  const q = useCatalog({ paused });
  const tables = q.data ?? [];
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focused && !ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true }); }, [focused]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = tables[sel];
    if (e.key === "j" || e.key === "ArrowDown") setSel((s) => Math.min(tables.length - 1, s + 1));
    else if (e.key === "k" || e.key === "ArrowUp") setSel((s) => Math.max(0, s - 1));
    else if (e.key === " " && t) peek(tableRef(t.name));
    else if (e.key === "Enter" && e.altKey && t) openBeside(tableRef(t.name));
    else return;
    e.preventDefault();
  };

  if (isLoading(q)) return <Shell><Loading /></Shell>;
  if (q.isError) return <Shell><ErrorState message={errorText(q) ?? "Unknown error"} /></Shell>;
  if (!tables.length) return <Shell><Empty title="No tables" /></Shell>;
  return (
    <Shell>
      <div className="pk-bar"><span className="pk-meta">{tables.length} tables</span></div>
      <div className="pk-list" ref={ref} tabIndex={0} role="listbox" aria-label="Tables" onKeyDown={onKeyDown} aria-activedescendant={tables[sel] ? `cat-${tables[sel].name}` : undefined}>
        {tables.map((t, i) => (
          <div key={t.name} id={`cat-${t.name}`} role="option" aria-selected={i === sel} className="pk-item" onClick={() => setSel(i)} onDoubleClick={() => openBeside(tableRef(t.name))}>
            <span className="grow">{t.name}</span>
            <span className="pk-mono pk-meta">{formatCount(t.rowCount)}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
