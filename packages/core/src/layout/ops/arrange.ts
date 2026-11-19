/**
 * Auto layout: a new arrangement of the panes a layout holds, chosen from the room there is and each kind's size
 * hints, with no person or agent placing anything. The same panes (same ids, refs, links, pins and keeps), so every
 * pane's state survives; only the tree around them is new, and nobody has sized it.
 *
 * 1. Order: reading order, with each pane's linked panes right after it (a list, then its detail, then what the
 *    detail opened), so linked panes sit side by side.
 * 2. Columns: as many as fit across at the kinds' comfortable widths (their minimums, when they have none).
 * 3. Rows: a second row in each column only when the height has room for two of the tallest minimum, so stacked
 *    panes stay usable; never more than two.
 * 4. Panes past the cells become tabs, of the cell holding the pane they were opened from, else of the last cell.
 *
 * Sizes are weights: a column by its widest pane's comfortable width. The fit (`refit`) runs after, as for any layout.
 */
import * as tree from "../tree/tree";
import type {
  Layout,
  LayoutContext,
  LayoutNode,
  NodeId,
  PaneNode,
  SplitNode,
  StackNode,
} from "../types";

export interface ArrangeOptions {
  /** The pane to keep shown in its tabs, when it lands in a group (the focused one). */
  focused?: NodeId;
  /** At most this many columns. Default: as many as fit. */
  maxColumns?: number;
  /** At most this many rows in a column (1 or 2). Default 2. */
  maxRows?: number;
}

/** The panes in reading order, each followed by the panes linked from it. */
function ordered(panes: PaneNode[]): PaneNode[] {
  const ids = new Set(panes.map((p) => p.id));
  const children = new Map<NodeId, PaneNode[]>();
  const roots: PaneNode[] = [];
  for (const p of panes) {
    if (p.linkedTo && ids.has(p.linkedTo) && p.linkedTo !== p.id) {
      const list = children.get(p.linkedTo) ?? [];
      list.push(p);
      children.set(p.linkedTo, list);
    } else roots.push(p);
  }
  const out: PaneNode[] = [];
  const seen = new Set<NodeId>();
  const visit = (p: PaneNode) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    out.push(p);
    for (const c of children.get(p.id) ?? []) visit(c);
  };
  roots.forEach(visit);
  panes.forEach(visit); // a cycle of links: whatever is left, in reading order
  return out;
}

/** A fresh tree around the same panes. Returns `layout` itself when it holds fewer than two panes. */
export function arrange(layout: Layout, ctx: LayoutContext, options: ArrangeOptions = {}): Layout {
  const panes = ordered(tree.panes(layout.root));
  if (panes.length < 2) return layout;
  const { width, height, gap, kinds } = ctx.fit;
  const kind = (p: PaneNode) => kinds[p.ref.kind];
  const wide = (p: PaneNode) => kind(p)?.comfortableWidth ?? kind(p)?.minWidth ?? 240;
  const tall = (p: PaneNode) => kind(p)?.minHeight ?? 160;

  // Columns: as many panes, in order, as fit across at their comfortable widths.
  let used = 0;
  let columns = 0;
  for (const p of panes) {
    const w = wide(p) + (columns ? gap : 0);
    if (columns && used + w > width) break;
    used += w;
    columns++;
  }
  columns = Math.max(1, Math.min(columns, options.maxColumns ?? Infinity, ctx.paneCap));
  const tallest = Math.max(...panes.map(tall));
  const rows = Math.min(options.maxRows ?? 2, height >= tallest * 2 + gap ? 2 : 1);
  const cells = Math.min(columns * rows, ctx.paneCap);

  // Fill the cells in order; the rest join the cell of the pane they were opened from, else the last.
  const placed: PaneNode[][] = panes.slice(0, cells).map((p) => [p]);
  const cellOf = new Map(placed.map((c, i) => [c[0]!.id, i]));
  for (const p of panes.slice(cells)) {
    const at = (p.linkedTo !== undefined ? cellOf.get(p.linkedTo) : undefined) ?? placed.length - 1;
    placed[at]!.push(p);
    cellOf.set(p.id, at);
  }

  const taken = new Set(panes.map((p) => p.id));
  let n = 0;
  const fresh = (prefix: string) => {
    let id: string;
    do id = `${prefix}-${++n}`;
    while (taken.has(id));
    taken.add(id);
    return id;
  };
  const clean = (p: PaneNode): PaneNode => {
    const { userSized: _u, base: _b, ...rest } = p;
    return { ...rest, size: { weight: 1 } };
  };
  const cell = (group: PaneNode[]): PaneNode | StackNode => {
    if (group.length === 1) return clean(group[0]!);
    const children = group.map(clean);
    const pinned = children.filter((c) => c.pinned);
    const sorted = [...pinned, ...children.filter((c) => !c.pinned)];
    const shown = sorted.find((c) => c.id === options.focused) ?? sorted[0]!;
    return {
      id: fresh("tabs"),
      type: "stack",
      size: { weight: 1 },
      children: sorted,
      active: shown.id,
      origin: "user",
    };
  };

  // Columns of up to `rows` cells, in order down each column, then across.
  const perColumn = Math.ceil(placed.length / Math.min(columns, placed.length));
  const cols: PaneNode[][][] = [];
  for (let i = 0; i < placed.length; i += perColumn) cols.push(placed.slice(i, i + perColumn));
  const column = (groups: PaneNode[][]): LayoutNode => {
    const weight = Math.max(...groups.flat().map(wide));
    if (groups.length === 1) return { ...cell(groups[0]!), size: { weight } };
    const node: SplitNode = {
      id: fresh("column"),
      type: "column",
      size: { weight },
      children: groups.map(cell),
    };
    return node;
  };
  const root: LayoutNode =
    cols.length === 1
      ? { ...column(cols[0]!), size: { weight: 1 } }
      : { id: fresh("row"), type: "row", size: { weight: 1 }, children: cols.map(column) };
  return { version: 1, root };
}
