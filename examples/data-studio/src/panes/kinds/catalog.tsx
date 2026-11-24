import { DatabaseIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "jali-layout/react";
import { useState } from "react";
import { PaneGate } from "@jali-examples/shared/panes/shared/PaneGate";
import { useFocusWhen } from "@jali-examples/shared/panes/shared/useFocusWhen";
import { useListKeys } from "@jali-examples/shared/panes/shared/useListKeys";
import { useCatalog, isLoading } from "@jali-examples/shared/data/hooks";
import { formatCount } from "@jali-examples/shared/panes/format";
import { tableRef } from "@jali-examples/shared/panes/shared/refs";
import { Shell, Empty } from "@jali-examples/shared/panes/shared/states";

export function CatalogPane({ paused, focused, openBeside, peek }: PaneProps) {
  const q = useCatalog({ paused });
  const tables = q.data ?? [];
  const [sel, setSel] = useState(0);
  const ref = useFocusWhen<HTMLDivElement>(focused);
  const listKeys = useListKeys(tables.length, sel, setSel);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = tables[sel];
    if (listKeys(e)) return;
    if (e.key === " " && t) peek(tableRef(t.name));
    else if (e.key === "Enter" && e.altKey && t) openBeside(tableRef(t.name));
    else return;
    e.preventDefault();
  };

  if (isLoading(q) || q.isError) return <PaneGate queries={[q]} />;
  if (!tables.length)
    return (
      <Shell>
        <Empty title="No tables" />
      </Shell>
    );
  return (
    <Shell>
      <div className="pk-bar">
        <span className="pk-meta">{tables.length} tables</span>
      </div>
      <div
        className="pk-list"
        ref={ref}
        tabIndex={0}
        role="listbox"
        aria-label="Tables"
        onKeyDown={onKeyDown}
        aria-activedescendant={tables[sel] ? `cat-${tables[sel].name}` : undefined}
      >
        {tables.map((t, i) => (
          <div
            key={t.name}
            id={`cat-${t.name}`}
            role="option"
            aria-selected={i === sel}
            className="pk-item"
            onClick={() => setSel(i)}
            onDoubleClick={() => openBeside(tableRef(t.name))}
          >
            <span className="grow">{t.name}</span>
            <span className="pk-mono pk-meta">{formatCount(t.rowCount)}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export const catalogKind = definePane("catalog", {
  title: "Tables",
  icon: DatabaseIcon,
  width: { min: 240, max: 320 },
  height: { min: 200 },
  Component: CatalogPane,
});
