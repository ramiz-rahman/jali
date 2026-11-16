import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ObjectRef } from "../layout-core/types";
import type { Row } from "../data/types";
import { formatCell, isNumericType, type SortState } from "./format";
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
  openLabel?: string;
  sort?: SortState;
  onSort?(column: string): void;
  filters?: Record<string, string>;
  onFilter?(column: string, text: string): void;
  onLink?(ref: ObjectRef): void;
  focused?: boolean;
  label: string;
}

const widthOf = (c: GridColumn) => (isNumericType(c.type) ? 112 : /^(id)$/.test(c.name) ? 72 : /(name|email|comment|sql|payload)/.test(c.name) ? 200 : 150);
const ACTION_W = 36;

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

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (p.focused && !rootRef.current?.contains(document.activeElement)) rootRef.current?.focus({ preventScroll: true }); }, [p.focused]);

  const width = p.columns.reduce((s, c) => s + widthOf(c), 0) + (p.onOpen ? ACTION_W : 0);
  const move = (to: number) => { if (p.total) p.onSelect(Math.max(0, Math.min(p.total - 1, to))); };
  const cur = p.selected ?? -1;

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
    else if (e.key === "Enter" && e.altKey && cur >= 0 && p.onOpen) p.onOpen(cur);
    else return;
    e.preventDefault();
  };

  return (
    <div className="pk-grid" ref={rootRef} tabIndex={0} role="grid" aria-label={p.label} aria-rowcount={p.total} onKeyDown={onKeyDown}>
      <div className="pk-gbody" ref={bodyRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        <div className="pk-gh" role="row" style={{ position: "sticky", top: 0, zIndex: 2, width }}>
          {p.columns.map((c) => {
            const num = isNumericType(c.type);
            const sorted = p.sort?.column === c.name ? p.sort.dir : null;
            return (
              <div key={c.name} role="columnheader" aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : "none"} className={`pk-hcell${num ? " r" : ""}`} style={{ width: widthOf(c) }}>
                <button className="sort" disabled={!p.onSort} onClick={() => p.onSort?.(c.name)} title={`${c.name} (${c.type})`}>
                  <span>{c.name}</span>{c.badge && <span className="pk-chip key">{c.badge}</span>}{sorted && <span aria-hidden>{sorted === "asc" ? "↑" : "↓"}</span>}
                </button>
                <span className="type">{c.type.toLowerCase()}</span>
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
                onClick={() => p.onSelect(i)} onDoubleClick={() => p.onOpen?.(i)}>
                {p.columns.map((c) => {
                  const v = row[c.name] ?? null;
                  const num = isNumericType(c.type);
                  const link = c.link?.(v) ?? null;
                  return (
                    <div key={c.name} role="gridcell" className={`pk-cell${num ? " r num" : ""}`} style={{ width: widthOf(c) }} title={v === null ? "NULL" : String(v)}>
                      {v === null ? <NullChip /> : link ? <button className="pk-link num" onClick={(e) => { e.stopPropagation(); p.onLink?.(link); }}>{formatCell(v, c)}</button> : formatCell(v, c)}
                    </div>
                  );
                })}
                {p.onOpen && <div className="pk-cell" style={{ width: ACTION_W, padding: 0, textAlign: "center" }}>
                  <button className="pk-link" aria-label={p.openLabel ?? "Open beside"} title={`${p.openLabel ?? "Open beside"} (⌥↵)`} onClick={(e) => { e.stopPropagation(); p.onOpen?.(i); }}>↗</button>
                </div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
