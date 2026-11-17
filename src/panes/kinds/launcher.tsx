import { definePaneKind } from "../../ui/pane-kinds";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Plus, Search, Table2 } from "lucide-react";
import type { ObjectRef, TableInfo } from "../../data/types";
import { useFocusWhen } from "../shared/useFocusWhen";
import { useCatalog } from "../../data/hooks";
import { formatCount } from "../format";
import { recordRef, singular, tableRef } from "../shared/refs";
import type { PaneComponentProps } from "../../ui/pane-kinds";

/** One choosable row. `open` marks an object already on screen: choosing it focuses that pane. */
interface Item {
  key: string;
  section: "Go to" | "Recent" | "Tables" | "Create";
  ref: ObjectRef;
  label: string;
  meta?: ReactNode;
  icon: ReactNode;
}

const NEW_QUERY: ObjectRef = { kind: "query", params: {} };

/** "orders 12", "customer #3": a direct jump to a record when the words name a table. */
function recordJump(q: string, tables: TableInfo[]): ObjectRef | null {
  const m = /^([a-z_]+)\s*#?\s*(\d+)$/i.exec(q.trim());
  if (!m) return null;
  const word = m[1]!.toLowerCase();
  const t = tables.find((t) => t.name === word || singular(t.name) === word) ?? tables.find((t) => t.name.startsWith(word));
  return t ? recordRef(t.name, Number(m[2])) : null;
}

/**
 * The launcher: what a split or a stack's "+" opens. A search over recent objects and tables, plus "New query".
 * Choosing fills this same pane (openHere); Esc on an untouched launcher closes it and returns focus.
 */
export function LauncherPane({ node, focused, paused, openHere, dismiss, recent = [], isOpen = () => false, KindIcon = () => null, titleFor = ref => ref.kind }: PaneComponentProps) {
  const catalog = useCatalog({ paused });
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useFocusWhen<HTMLInputElement>(focused);
  const list = useRef<HTMLDivElement>(null);



  const items = useMemo<Item[]>(() => {
    const t = q.trim().toLowerCase();
    const hit = (s: string) => !t || s.toLowerCase().includes(t);
    const tables = catalog.data ?? [];
    const out: Item[] = [];
    const jump = t ? recordJump(t, tables) : null;
    if (jump) out.push({ key: "jump", section: "Go to", ref: jump, label: titleFor(jump), icon: <KindIcon kind="record" size={14} /> });
    for (const ref of recent) {
      const label = titleFor(ref);
      if (!hit(label) || (jump && label === titleFor(jump))) continue;
      out.push({ key: `r:${JSON.stringify(ref)}`, section: "Recent", ref, label, icon: <KindIcon kind={ref.kind} size={14} /> });
    }
    for (const tb of tables) {
      if (!hit(tb.name)) continue;
      out.push({ key: `t:${tb.name}`, section: "Tables", ref: tableRef(tb.name), label: tb.name, meta: <span className="pk-mono">{formatCount(tb.rowCount)}</span>, icon: <Table2 size={14} strokeWidth={1.5} aria-hidden /> });
    }
    if (hit("new query") || hit("sql")) out.push({ key: "new-query", section: "Create", ref: NEW_QUERY, label: "New query", meta: <span className="pk-mono">SQL</span>, icon: <Plus size={14} strokeWidth={1.5} aria-hidden /> });
    return out;
  }, [q, recent, catalog.data, KindIcon, titleFor]);

  const sel = Math.min(i, items.length - 1);
  const optId = (n: number) => `${node.id}-opt-${n}`;

  // Keep the active row in view inside the list only (never scroll the workspace).
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`#${CSS.escape(optId(sel))}`);
    const box = list.current;
    if (!el || !box) return;
    if (el.offsetTop < box.scrollTop + 28) box.scrollTop = Math.max(0, el.offsetTop - 28);
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const choose = (n: number) => {
    const it = items[n];
    if (it) openHere(it.ref);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return; // workspace chords pass through
    if (e.key === "ArrowDown") setI(Math.min(items.length - 1, sel + 1));
    else if (e.key === "ArrowUp") setI(Math.max(0, sel - 1));
    else if (e.key === "Home" && !q) setI(0);
    else if (e.key === "End" && !q) setI(items.length - 1);
    else if (e.key === "Enter") choose(sel);
    else if (e.key === "Escape") {
      if (q) { setQ(""); setI(0); }
      else dismiss();
    } else return;
    e.preventDefault();
  };

  const groups: { section: Item["section"]; rows: { it: Item; n: number }[] }[] = [];
  items.forEach((it, n) => {
    const g = groups[groups.length - 1];
    if (g && g.section === it.section) g.rows.push({ it, n });
    else groups.push({ section: it.section, rows: [{ it, n }] });
  });
  return (
    <div className="pk launcher">
      <label className="launcher-search">
        <Search size={15} strokeWidth={1.5} aria-hidden />
        <input
          ref={input}
          data-autofocus
          role="combobox"
          aria-label="Open in this pane"
          aria-expanded="true"
          aria-controls={`${node.id}-options`}
          aria-activedescendant={items[sel] ? optId(sel) : undefined}
          aria-autocomplete="list"
          placeholder="Open a table, record or query"
          spellCheck={false}
          autoComplete="off"
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={onKeyDown}
        />
      </label>
      <div className="launcher-list" ref={list} id={`${node.id}-options`} role="listbox" aria-label="Objects">
        {groups.map((g) => (
          <div key={g.section} role="group" aria-labelledby={`${node.id}-sec-${g.section}`}>
            <div className="launcher-section" id={`${node.id}-sec-${g.section}`}>{g.section}</div>
            {g.rows.map(({ it, n }) => {
              const open = isOpen(it.ref);
              return (
                <div
                  key={it.key}
                  id={optId(n)}
                  role="option"
                  aria-selected={n === sel}
                  aria-description={open ? "Already open: choosing focuses it" : undefined}
                  className="launcher-item"
                  onPointerMove={() => n !== sel && setI(n)}
                  onPointerDown={(e) => e.preventDefault() /* keep focus in the field */}
                  onClick={() => choose(n)}
                >
                  <span className="launcher-icon">{it.icon}</span>
                  <span className="launcher-label">{it.label}</span>
                  {open ? <span className="launcher-open">Open</span> : it.meta ? <span className="launcher-meta">{it.meta}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
        {catalog.isError ? <div className="launcher-note" role="alert">Tables could not be loaded.</div> : null}
        {!items.length && !catalog.isLoading ? <div className="launcher-note">Nothing matches “{q}”. Try a table name, or a table and an id such as “customer 3”.</div> : null}
        {!catalog.data && catalog.isLoading ? <div className="launcher-note">Loading tables…</div> : null}
      </div>
      <div className="launcher-foot" aria-hidden>
        <span><kbd>↑</kbd><kbd>↓</kbd> choose</span>
        <span><kbd>↵</kbd> open here</span>
        <span><kbd>esc</kbd> {q ? "clear" : "close"}</span>
      </div>
    </div>
  );
}


export const launcherKind = definePaneKind({
  kind: "launcher", ref: (params) => ({ kind: "launcher", params }),
  title: (_ref) => "New pane", minWidth: 320, minHeight: 200, transient: true, recordable: false, identity: () => undefined,
  icon: Plus, Component: LauncherPane,
});
