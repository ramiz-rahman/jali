import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ObjectRef } from "../layout-core/types";
import type { Row } from "../data/types";
import { cellKind, columnLabel, formatCell, isMoneyColumn, isNumericType, rawText, type SortState } from "./format";
import { NullChip } from "./states";

export const ROW_H = 28;
export interface GridColumn { name: string; type: string; badge?: "PK" | "FK"; link?: (v: string | number | null) => ObjectRef | null }

interface Props {
  columns: GridColumn[];
  total: number;
  rows: Row[];
  /** Absolute index of rows[0]. */
  startOffset: number;
  onRange(start: number, end: number): void;
  selected: number | null;
  onSelect(i: number): void;
  onPeek?(i: number): void;
  onOpen?(i: number): void;
  /** Accessible name for the row action, e.g. "Open order 4 beside". */
  rowOpenLabel?(i: number): string;
  /** Id of the row, for "Copy ID". */
  rowId?(i: number): string | null;
  sort?: SortState;
  onSort?(column: string): void;
  filters?: Record<string, string>;
  onFilter?(column: string, text: string): void;
  onLink?(ref: ObjectRef): void;
  focused?: boolean;
  label: string;
}

const widthOf = (c: GridColumn) => (isNum(c) ? 112 : /^(id)$/.test(c.name) ? 72 : /(name|email|comment|sql|payload)/.test(c.name) ? 200 : 150);
const ACTION_W = 36;
const isNum = (c: GridColumn) => isNumericType(c.type) || isMoneyColumn(c.name);

interface MenuState { i: number; x: number; y: number }

export function Grid(p: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);

  useLayoutEffect(() => {
    const el = bodyRef.current; if (!el) return;
    setHeight(el.clientHeight || 400);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight || 400));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 6);
  const last = Math.min(p.total, Math.ceil((scrollTop + height) / ROW_H) + 6);
  const { onRange } = p;
  useEffect(() => { onRange(first, last); }, [first, last, onRange]);

  // Keep the selection in view.
  useEffect(() => {
    const el = bodyRef.current; if (!el || p.selected === null) return;
    const top = p.selected * ROW_H, headerH = p.onFilter ? 64 : 44;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H + headerH > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_H + headerH - el.clientHeight;
  }, [p.selected]);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (p.focused && !rootRef.current?.contains(document.activeElement)) rootRef.current?.focus({ preventScroll: true }); }, [p.focused]);

  const width = p.columns.reduce((s, c) => s + widthOf(c), 0) + (p.onOpen ? ACTION_W : 0);
  const move = (to: number) => { if (p.total) p.onSelect(Math.max(0, Math.min(p.total - 1, to))); };
  const cur = p.selected ?? -1;

  /** Copy puts the stored value on the clipboard: ISO timestamps, raw cents, raw JSON. */
  const copyRaw = (e: React.ClipboardEvent) => {
    const sel = window.getSelection();
    const node = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
    const raw = node?.closest<HTMLElement>("[data-raw]")?.dataset.raw;
    if (raw !== undefined && sel && sel.toString().length <= (node?.closest<HTMLElement>("[data-raw]")?.textContent?.length ?? 0)) { e.clipboardData.setData("text/plain", raw); e.preventDefault(); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const page = Math.max(1, Math.floor(height / ROW_H) - 2);
    if (e.key === "j" || e.key === "ArrowDown") move(cur + 1);
    else if (e.key === "k" || e.key === "ArrowUp") move(cur < 0 ? 0 : cur - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(p.total - 1);
    else if (e.key === "PageDown") move(cur + page);
    else if (e.key === "PageUp") move(cur - page);
    else if (e.key === " " && cur >= 0 && p.onPeek) p.onPeek(cur);
    else if ((e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) && cur >= 0) {
      const rowEl = rootRef.current?.querySelector<HTMLElement>(`[aria-rowindex="${cur + 1}"]`);
      const r = (rowEl ?? rootRef.current)!.getBoundingClientRect();
      setMenu({ i: cur, x: r.left + 24, y: r.bottom - 4 });
    }
    else if (e.key === "Enter" && e.altKey && cur >= 0 && p.onOpen) p.onOpen(cur);
    else return;
    e.preventDefault();
  };

  return (
    <div className="pk-grid" ref={rootRef} tabIndex={0} role="grid" aria-label={p.label} aria-rowcount={p.total} onKeyDown={onKeyDown} onCopy={copyRaw}>
      <div className="pk-gbody" ref={bodyRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        <div className="pk-gh" role="row" style={{ position: "sticky", top: 0, zIndex: 2, width }}>
          {p.columns.map((c) => {
            const num = isNum(c);
            const sorted = p.sort?.column === c.name ? p.sort.dir : null;
            return (
              <div key={c.name} role="columnheader" aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : "none"} className={`pk-hcell${num ? " r" : ""}`} style={{ width: widthOf(c) }}>
                <button className="sort" disabled={!p.onSort} onClick={() => p.onSort?.(c.name)} title={`${c.name} (${c.type})`}>
                  <span>{columnLabel(c.name)}</span>{c.badge && <span className="pk-chip key">{c.badge}</span>}{sorted && <span aria-hidden>{sorted === "asc" ? "↑" : "↓"}</span>}
                </button>
                <span className="type">{isMoneyColumn(c.name) ? "money" : c.type.toLowerCase()}</span>
                {p.onFilter && <input aria-label={`Filter ${c.name}`} placeholder="Filter" defaultValue={p.filters?.[c.name] ?? ""}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") p.onFilter?.(c.name, e.currentTarget.value); }}
                  onBlur={(e) => { if (e.currentTarget.value !== (p.filters?.[c.name] ?? "")) p.onFilter?.(c.name, e.currentTarget.value); }} />}
              </div>
            );
          })}
          {p.onOpen && <div style={{ width: ACTION_W }} />}
        </div>
        <div style={{ height: p.total * ROW_H, width, position: "relative" }}>
          {p.rows.map((row, k) => {
            const i = p.startOffset + k;
            if (i < first || i >= last) return null;
            return (
              <div key={i} role="row" aria-rowindex={i + 1} aria-selected={i === p.selected} className="pk-row" style={{ top: i * ROW_H, width }}
                onClick={() => p.onSelect(i)} onDoubleClick={() => p.onOpen?.(i)}
                onContextMenu={(e) => { e.preventDefault(); p.onSelect(i); setMenu({ i, x: e.clientX, y: e.clientY }); }}>
                {p.columns.map((c) => {
                  const v = row[c.name] ?? null;
                  const kind = cellKind(v, c);
                  const link = c.link?.(v) ?? null;
                  const raw = rawText(v);
                  return (
                    <div key={c.name} role="gridcell" className={`pk-cell${isNum(c) ? " r num" : ""}${kind === "json" ? " json" : ""}${kind === "time" ? " time" : ""}`} style={{ width: widthOf(c) }} title={raw} data-raw={v === null ? undefined : raw}>
                      {v === null ? <NullChip /> : link ? <button className="pk-link num" onClick={(e) => { e.stopPropagation(); p.onLink?.(link); }}>{formatCell(v, c)}</button> : formatCell(v, c)}
                    </div>
                  );
                })}
                {p.onOpen && <div className="pk-cell pk-act" style={{ width: ACTION_W }}>
                  <button className="pk-open" tabIndex={i === p.selected ? 0 : -1} aria-label={p.rowOpenLabel?.(i) ?? "Open beside"} title="Open beside (⌥↵)" onClick={(e) => { e.stopPropagation(); p.onOpen?.(i); }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9 9 3M4.5 3H9v4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>}
              </div>
            );
          })}
        </div>
      </div>
      {menu && <RowMenu menu={menu} onClose={() => { setMenu(null); rootRef.current?.focus({ preventScroll: true }); }}
        onOpen={p.onOpen && (() => p.onOpen?.(menu.i))} onPeek={p.onPeek && (() => p.onPeek?.(menu.i))} id={p.rowId?.(menu.i) ?? null} />}
    </div>
  );
}

function RowMenu({ menu, onClose, onOpen, onPeek, id }: { menu: MenuState; onClose(): void; onOpen?: () => void; onPeek?: () => void; id: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const items: { label: string; hint?: string; run(): void }[] = [];
  if (onOpen) items.push({ label: "Open beside", hint: "⌥↵", run: onOpen });
  if (onPeek) items.push({ label: "Peek", hint: "Space", run: onPeek });
  if (id !== null) items.push({ label: "Copy ID", run: () => { void navigator.clipboard?.writeText(id).catch(() => undefined); } });
  const [active, setActive] = useState(0);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener("pointerdown", away, true); window.addEventListener("blur", onClose);
    return () => { window.removeEventListener("pointerdown", away, true); window.removeEventListener("blur", onClose); };
  }, [onClose]);
  const left = Math.max(4, Math.min(menu.x, window.innerWidth - 196)), top = Math.max(4, Math.min(menu.y, window.innerHeight - items.length * 30 - 16));
  const choose = (k: number) => { onClose(); items[k]?.run(); };
  return createPortal(
    <div ref={ref} className="pk-menu" role="menu" aria-label="Row actions" tabIndex={-1} style={{ left, top }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); onClose(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a + items.length - 1) % items.length); }
        else if (e.key === "Home") { e.preventDefault(); setActive(0); }
        else if (e.key === "End") { e.preventDefault(); setActive(items.length - 1); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
        else if (e.key === "Tab") { e.preventDefault(); onClose(); }
      }}>
      {items.map((it, k) => (
        <div key={it.label} role="menuitem" className="pk-menu-item" data-active={k === active} onPointerMove={() => setActive(k)} onClick={() => choose(k)}>
          <span>{it.label}</span>{it.hint && <kbd>{it.hint}</kbd>}
        </div>
      ))}
    </div>, document.body);
}
