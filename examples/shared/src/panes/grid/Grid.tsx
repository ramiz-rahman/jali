/**
 * The shared data grid: a virtual window of rows under a sticky header, with sorting, filters, a row menu and an
 * "open beside" action. Focus stays on the grid itself; the selected row is its active descendant.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { copyRaw } from "../shared/copyRaw";
import { useFocusWhen } from "../shared/useFocusWhen";
import { useListKeys } from "../shared/useListKeys";
import { RowMenu } from "./RowMenu";
import { keyHint, type ObjectRef } from "jali-layout";
import type { Row } from "../../data/types";
import { cellKind, columnLabel, formatCell, isNumericType, rawText } from "../format";
import type { SortState } from "./grid-state";
import { NullChip } from "../shared/states";

export const ROW_H = 28;
const OVERSCAN_ROWS = 6;
export interface GridColumn {
  name: string;
  type: string;
  format?: "money" | "json";
  badge?: "PK" | "FK";
}

interface Props {
  columns: GridColumn[];
  total: number;
  rows: Row[];
  /** Absolute index of rows[0]. */
  startOffset: number;
  onRange(start: number, end: number): void;
  selected: number | null;
  onSelect(i: number): void;
  rowRef?(row: Row): ObjectRef | null;
  link?(value: string | number | null, row: Row, column: GridColumn): ObjectRef | null;
  select?(ref: ObjectRef | null): void;
  peek?(ref: ObjectRef): void;
  openBeside?(ref: ObjectRef): void;
  rowLabel?(ref: ObjectRef): string;
  sort?: SortState;
  onSort?(column: string): void;
  filters?: Record<string, string>;
  onFilter?(column: string, text: string): void;
  onLink?(ref: ObjectRef): void;
  focused?: boolean;
  label: string;
}

const widthOf = (c: GridColumn) =>
  isNum(c)
    ? 112
    : /^(id)$/.test(c.name)
      ? 72
      : /(name|email|comment|sql|payload)/.test(c.name)
        ? 200
        : 150;
const ACTION_W = 36;
/**
 * Pane content contract for the grid: text columns share the width the pane has beyond the grid's natural width, up to
 * twice their own, so names, dates and statuses truncate less; ids and numbers keep a tight right-aligned column under
 * their header. Past that the grid holds its measure: header, rows and the open-beside action end at a ruled right
 * edge and the pane continues as plain background. Stretching further would push values apart (a status 600px from
 * its total), and rules running to the pane's edge would read as a missing column.
 */
const GROW = 2;
const grownOf = (c: GridColumn) =>
  isNum(c) || /^(id)$/.test(c.name) ? widthOf(c) : widthOf(c) * GROW;
const cellStyle = (c: GridColumn): React.CSSProperties => {
  const w = widthOf(c);
  return isNum(c) || /^(id)$/.test(c.name)
    ? { width: w }
    : { flex: `${w} 0 ${w}px`, maxWidth: w * GROW };
};
const actionStyle: React.CSSProperties = { width: ACTION_W, flex: "none", marginLeft: "auto" };
const isNum = (c: GridColumn) => isNumericType(c.type) || c.format === "money";

export interface MenuState {
  i: number;
  x: number;
  y: number;
}

export function Grid(p: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setHeight(el.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN_ROWS);
  const last = Math.min(p.total, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN_ROWS);
  const { onRange } = p;
  useEffect(() => {
    onRange(first, last);
  }, [first, last, onRange]);

  // Keep the selection in view.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || p.selected === null) return;
    const top = p.selected * ROW_H,
      headerH = headerRef.current?.offsetHeight ?? 0;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H + headerH > el.scrollTop + el.clientHeight)
      el.scrollTop = top + ROW_H + headerH - el.clientHeight;
  }, [p.selected]);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const rootRef = useFocusWhen<HTMLDivElement>(!!p.focused);
  // Focus stays on the grid; the selected row is its active descendant, so a screen reader reads each row J, K or an
  // arrow moves to. Row ids are this grid's own: two grids of the same table can be on screen.
  const rowIdBase = useId();
  const rowId = (i: number) => `${rowIdBase}-r${i}`;

  const refAt = (i: number) => {
    const row = p.rows[i - p.startOffset];
    return row ? (p.rowRef?.(row) ?? null) : null;
  };
  const selectAt = (i: number) => {
    p.onSelect(i);
    p.select?.(refAt(i));
  };
  // Opening a row selects it first, so the detail it opens follows the list (or the list's detail shows it).
  const openAt = (i: number) => {
    const ref = refAt(i);
    if (!ref) return;
    if (i !== cur) selectAt(i);
    p.openBeside?.(ref);
  };
  const peekAt = (i: number) => {
    const ref = refAt(i);
    if (ref) p.peek?.(ref);
  };
  const width = p.columns.reduce((s, c) => s + widthOf(c), 0) + (p.openBeside ? ACTION_W : 0);
  const measure = p.columns.reduce((s, c) => s + grownOf(c), 0) + (p.openBeside ? ACTION_W : 0) + 1;
  const move = (to: number) => {
    if (p.total) selectAt(Math.max(0, Math.min(p.total - 1, to)));
  };
  const cur = p.selected ?? -1;

  const listKeys = useListKeys(p.total, cur, move);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const page = Math.max(1, Math.floor(height / ROW_H) - 2);
    if (listKeys(e)) return;
    if (e.key === "Home") move(0);
    else if (e.key === "End") move(p.total - 1);
    else if (e.key === "PageDown") move(cur + page);
    else if (e.key === "PageUp") move(cur - page);
    else if (e.key === " " && !e.metaKey && !e.ctrlKey && !e.altKey && cur >= 0 && p.peek)
      peekAt(cur);
    else if ((e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) && cur >= 0) {
      const at = document.getElementById(rowId(cur)) ?? rootRef.current;
      if (!at) return;
      const r = at.getBoundingClientRect();
      setMenu({ i: cur, x: r.left + 24, y: r.bottom - 4 });
    } else if (e.key === "Enter" && e.altKey && cur >= 0 && p.openBeside) openAt(cur);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="pk-grid"
      ref={rootRef}
      tabIndex={0}
      role="grid"
      aria-label={p.label}
      // The header row is row 1, so the data rows are 2 to total + 1.
      aria-rowcount={p.total + 1}
      aria-activedescendant={
        cur >= first && cur < last && p.rows[cur - p.startOffset] ? rowId(cur) : undefined
      }
      onKeyDown={onKeyDown}
      onCopy={copyRaw}
    >
      <div
        className="pk-gbody"
        ref={bodyRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div
          className="pk-gh"
          ref={headerRef}
          role="row"
          aria-rowindex={1}
          style={{ position: "sticky", top: 0, zIndex: 2, minWidth: width, maxWidth: measure }}
        >
          {p.columns.map((c) => {
            const num = isNum(c);
            const sorted = p.sort?.column === c.name ? p.sort.dir : null;
            return (
              <div
                key={c.name}
                role="columnheader"
                aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : "none"}
                className={`pk-hcell${num ? " r" : ""}`}
                style={cellStyle(c)}
              >
                <button
                  className="sort"
                  disabled={!p.onSort}
                  onClick={() => p.onSort?.(c.name)}
                  title={`${c.name} (${c.type})`}
                >
                  <span>{columnLabel(c.name, c.format)}</span>
                  {c.badge && <span className="pk-chip key">{c.badge}</span>}
                  {sorted && <span aria-hidden>{sorted === "asc" ? "↑" : "↓"}</span>}
                </button>
                <span className="type">
                  {c.format === "money" ? "money" : c.type.toLowerCase()}
                </span>
                {p.onFilter && (
                  <input
                    aria-label={`Filter ${c.name}`}
                    placeholder="Filter"
                    defaultValue={p.filters?.[c.name] ?? ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        p.onFilter?.(c.name, e.currentTarget.value);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.currentTarget.value !== (p.filters?.[c.name] ?? ""))
                        p.onFilter?.(c.name, e.currentTarget.value);
                    }}
                  />
                )}
              </div>
            );
          })}
          {p.openBeside && (
            <div role="columnheader" style={actionStyle}>
              <span className="sr-only">Open beside</span>
            </div>
          )}
        </div>
        <div
          className="pk-grows"
          style={{ height: p.total * ROW_H, minWidth: width, maxWidth: measure }}
        >
          {p.rows.map((row, k) => {
            const i = p.startOffset + k;
            if (i < first || i >= last) return null;
            return (
              <div
                key={i}
                id={rowId(i)}
                role="row"
                aria-rowindex={i + 2}
                aria-selected={i === p.selected}
                className="pk-row"
                style={{ top: i * ROW_H, right: 0 }}
                onClick={() => selectAt(i)}
                onDoubleClick={() => openAt(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  selectAt(i);
                  setMenu({ i, x: e.clientX, y: e.clientY });
                }}
              >
                {p.columns.map((c) => {
                  const v = row[c.name] ?? null;
                  const kind = cellKind(v, c);
                  const link = p.link?.(v, row, c) ?? null;
                  const raw = rawText(v);
                  return (
                    <div
                      key={c.name}
                      role="gridcell"
                      className={`pk-cell${isNum(c) ? " r num" : ""}${kind === "json" ? " json" : ""}${kind === "time" ? " time" : ""}`}
                      style={cellStyle(c)}
                      title={raw}
                      data-raw={v === null ? undefined : raw}
                    >
                      {v === null ? (
                        <NullChip />
                      ) : link ? (
                        <button
                          className="pk-link num"
                          onClick={(e) => {
                            e.stopPropagation();
                            p.onLink?.(link);
                          }}
                        >
                          {formatCell(v, c)}
                        </button>
                      ) : (
                        formatCell(v, c)
                      )}
                    </div>
                  );
                })}
                {p.openBeside && (
                  <div role="gridcell" className="pk-cell pk-act" style={actionStyle}>
                    <button
                      className="pk-open"
                      tabIndex={i === p.selected ? 0 : -1}
                      aria-label={(refAt(i) && p.rowLabel?.(refAt(i)!)) ?? "Open beside"}
                      title={`Open beside (${keyHint("Alt+Enter")})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAt(i);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <path
                          d="M3 9 9 3M4.5 3H9v4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {menu && (
        <RowMenu
          menu={menu}
          onClose={() => {
            setMenu(null);
            rootRef.current?.focus({ preventScroll: true });
          }}
          onOpen={p.openBeside && (() => openAt(menu.i))}
          onPeek={p.peek && (() => peekAt(menu.i))}
          id={String(refAt(menu.i)?.params.id ?? "") || null}
        />
      )}
    </div>
  );
}
