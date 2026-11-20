/**
 * Auto layout: a new arrangement of the panes a layout holds, chosen from the room there is and each kind's size
 * hints, with no person or agent placing anything. The same panes (same ids, refs, links, pins and keeps), so every
 * pane's state survives; only the tree around them is new, and nobody has sized it.
 *
 * 1. Order. The panes in front first (a tab group's first pane, not its other tabs), then those behind, in reading
 *    order, with each pane's linked panes right after it, wherever they are (a list, then its detail, then what the
 *    detail opened): a chain. A row that scrolls sideways (`row({ scroll: "x" })`) is one unit, kept whole.
 * 2. One row: in order, every chain that fits across at its kinds' minimum widths, whole, so linked panes sit next to
 *    each other; then single panes that still fit. So auto layout shows as many panes as fit in a row.
 * 3. A second row, below, for what didn't fit across, the same way, each pane only when the height has room for it
 *    and the first row's tallest minimum. Never more than two.
 * 4. The rest become tabs: of the pane they were opened from, else of the pane whose tabs they are already, else of
 *    the nearest pane before them, else of any pane whose row still fits with the tab's width. The focused pane is the tab shown. A unit that scrolls always gets a
 *    place of its own, and takes no tabs.
 *
 * Every pane comes out exactly once. The tree reads in the order it was built from and its new nodes are named from
 * that order, so arranging an arranged layout returns it unchanged. Panes the layout hides (`hidden`) stay hidden.
 * The fit (`refit`) runs after, as for any layout.
 */
import { bounds, type Bounds } from "../geometry/bounds";
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
  /** At most this many panes across a row. Default: as many as fit. */
  maxColumns?: number;
  /** At most this many rows (1 or 2). Default 2. */
  maxRows?: number;
}

/** What auto layout places: a pane, or a row that scrolls, kept whole. */
interface Unit {
  node: PaneNode | SplitNode;
  /** The panes it holds: the pane itself, or a strip's panes. */
  ids: NodeId[];
  linkedTo?: NodeId;
  strip: boolean;
  b: Bounds;
}

const EPS = 1e-7;
const isStrip = (n: LayoutNode): boolean => n.type === "row" && n.scroll === "x";

/** The units of a layout in reading order: those in front, and those behind another tab. */
function unitsOf(root: LayoutNode, ctx: LayoutContext, hidden: ReadonlySet<NodeId>) {
  const front: Unit[] = [],
    behind: Unit[] = [];
  const { kinds, gap } = ctx.fit;
  const visit = (n: LayoutNode, back: boolean) => {
    if (isStrip(n)) {
      const ids = tree.panes(n).map((p) => p.id);
      front.push({ node: n as SplitNode, ids, strip: true, b: bounds(n, kinds, gap) });
      return;
    }
    if (n.type === "pane") {
      if (hidden.has(n.id)) return;
      const unit: Unit = { node: n, ids: [n.id], strip: false, b: bounds(n, kinds, gap) };
      if (n.linkedTo !== undefined) unit.linkedTo = n.linkedTo;
      (back ? behind : front).push(unit);
      return;
    }
    // A tab group's first pane is its own (the home its tabs belong to); the rest are behind it, whichever shows.
    if (n.type === "stack") {
      n.children.forEach((c, i) => visit(c, back || i > 0));
      return;
    }
    for (const c of n.children) visit(c, back);
  };
  visit(root, false);
  return { front, behind };
}

/**
 * Units as chains: each root in reading order, followed by the units linked from it, depth first. A link never
 * pulls a unit in front to behind (after a tab), so a pane shown stays ahead of the tabs.
 */
function chainsOf(units: Unit[], back: ReadonlySet<Unit>): Unit[][] {
  const owner = new Map<NodeId, Unit>();
  for (const u of units) for (const id of u.ids) owner.set(id, u);
  const children = new Map<Unit, Unit[]>();
  const roots: Unit[] = [];
  for (const u of units) {
    const parent = u.linkedTo !== undefined ? owner.get(u.linkedTo) : undefined;
    if (parent && parent !== u && !(back.has(parent) && !back.has(u)))
      children.set(parent, [...(children.get(parent) ?? []), u]);
    else roots.push(u);
  }
  const seen = new Set<Unit>();
  const walk = (u: Unit, into: Unit[]) => {
    if (seen.has(u)) return;
    seen.add(u);
    into.push(u);
    for (const c of children.get(u) ?? []) walk(c, into);
  };
  const chains: Unit[][] = [];
  for (const r of [...roots, ...units]) {
    // A cycle of links has no root: whatever is left, in reading order.
    if (seen.has(r)) continue;
    const chain: Unit[] = [];
    walk(r, chain);
    chains.push(chain);
  }
  return chains;
}

const widthOf = (us: Unit[], gap: number) =>
  us.reduce((s, u) => s + u.b.width, 0) + Math.max(0, us.length - 1) * gap;

/**
 * One row, in order: every chain that fits whole in what is left of the width. A chain that doesn't waits whole for
 * the next row, when there can be one (`last` false) and it would fit a row of its own; otherwise its panes go in one
 * by one as they fit. `fits` checks a unit against the height.
 */
function pack(
  chains: Unit[][],
  width: number,
  gap: number,
  max: number,
  last: boolean,
  fits: (u: Unit) => boolean = () => true,
): { row: Unit[]; left: Unit[][] } {
  const row: Unit[] = [];
  const left: Unit[][] = [];
  const room = () => width - widthOf(row, gap) - (row.length ? gap : 0);
  for (const chain of chains) {
    const ok = chain.filter(fits);
    const whole = ok.length === chain.length && chain.length <= max - row.length;
    if (whole && widthOf(chain, gap) <= room() + EPS) {
      row.push(...chain);
      continue;
    }
    // In the last row, or too wide for a row of its own: keep what fits of it, in order. Else it waits whole.
    if (last || widthOf(chain, gap) > width + EPS) {
      const rest: Unit[] = [];
      for (const u of chain) {
        if (row.length < max && fits(u) && u.b.width <= room() + EPS) row.push(u);
        else rest.push(u);
      }
      if (rest.length) left.push(rest);
    } else left.push(chain);
  }
  return { row, left };
}

/**
 * A fresh tree around the same panes. Returns `layout` itself when it holds fewer than two panes, or when the
 * arrangement is the one it already has. One step can still move a pane the next would move back (two details of
 * one width taking turns at the one place left, say), so it takes the step until it settles, and where steps go
 * round in a cycle it takes the same one of them every time. Either way, arranging its result changes nothing.
 */
export function arrange(layout: Layout, ctx: LayoutContext, options: ArrangeOptions = {}): Layout {
  const key = (l: Layout) => JSON.stringify([l.root, l.overlay?.hidden ?? []]);
  const seen: Layout[] = [layout];
  let now = layout;
  for (let i = 0; i < 8; i++) {
    const next = arrangeOnce(now, ctx, options);
    if (next === now) return now;
    const k = key(next);
    const at = seen.findIndex((l) => key(l) === k);
    if (at >= 0) {
      // A cycle: the one of its layouts that sorts first, so every way into the cycle ends at the same one.
      const cycle = seen.slice(at);
      const pick = cycle.reduce((a, b) => (key(b) < key(a) ? b : a));
      return pick === layout || key(pick) === key(layout) ? layout : pick;
    }
    seen.push(next);
    now = next;
  }
  return now;
}

function arrangeOnce(layout: Layout, ctx: LayoutContext, options: ArrangeOptions): Layout {
  const hidden = new Set(layout.overlay?.hidden ?? []);
  const all = tree.panes(layout.root);
  if (all.filter((p) => !hidden.has(p.id)).length < 2) return layout;
  const { width, height, gap } = ctx.fit;
  const { front, behind } = unitsOf(layout.root, ctx, hidden);
  // Chains across both, so a link means the same on every run; a chain starts where its root is, front first.
  const chains = chainsOf([...front, ...behind], new Set(behind));
  const units = chains.flat();
  if (units.length < 2) return layout;

  // Rows: the first takes what fits across; a second, what fits of the rest, when the height has room for it.
  const across = Math.max(1, Math.min(options.maxColumns ?? Infinity, ctx.paneCap));
  // A second row can only be when two of the shortest panes fit one above the other.
  const shortest = Math.min(...units.map((u) => u.b.height));
  const twoRows = (options.maxRows ?? 2) >= 2 && shortest * 2 + gap <= height + EPS;
  const one = pack(chains, width, gap, across, !twoRows);
  // Even a pane wider than the room gets a row: the fit makes what it can of it.
  if (!one.row.length) one.row.push(...one.left.shift()!.splice(0, 1));
  const rows: Unit[][] = [one.row];
  let waiting = one.left.filter((c) => c.length);
  const tallest = (r: Unit[]) => Math.max(0, ...r.map((u) => u.b.height));
  if (waiting.length && twoRows) {
    const room = Math.max(0, ctx.paneCap - one.row.length);
    const top = tallest(one.row);
    const two = room
      ? pack(
          waiting,
          width,
          gap,
          Math.min(across, room),
          true,
          (u) => top + gap + u.b.height <= height + EPS,
        )
      : { row: [], left: waiting };
    if (two.row.length) {
      rows.push(two.row);
      waiting = two.left.filter((c) => c.length);
    }
  }
  let overflow = waiting.flat();
  // A row that scrolls always gets a place of its own: at the end of the last row (the fit folds what it must).
  for (const strip of overflow.filter((u) => u.strip)) rows[rows.length - 1]!.push(strip);
  overflow = overflow.filter((u) => !u.strip);
  // Panes need a pane's place to be tabs of: when every place went to a row that scrolls, the first waits beside it.
  if (overflow.length && rows.flat().every((u) => u.strip))
    rows[rows.length - 1]!.push(overflow.shift()!);
  const placed = rows.flat();

  // Each tab joins the cell of the pane it was opened from, else of the nearest pane before it, else of any pane, as
  // long as that cell's row still fits with the tab's width; failing that, the cell it widens least.
  const groups = new Map<Unit, Unit[]>(placed.map((u) => [u, [u]]));
  const cellOf = new Map<NodeId, Unit>();
  for (const u of placed) for (const id of u.ids) cellOf.set(id, u);
  const rowOf = new Map<Unit, Unit[]>();
  for (const r of rows) for (const u of r) rowOf.set(u, r);
  const minOf = (cell: Unit) => Math.max(...groups.get(cell)!.map((u) => u.b.width));
  const rowWidth = (r: Unit[], cell?: Unit, extra?: Unit) =>
    r.reduce((s, c) => s + (c === cell ? Math.max(minOf(c), extra!.b.width) : minOf(c)), 0) +
    (r.length - 1) * gap;
  const panesOnly = placed.filter((c) => !c.strip);
  // A pane that is a tab already stays with the pane its tabs belong to (so arranging again changes nothing).
  const tabOf = new Map<NodeId, NodeId>();
  for (const s of tree.nodes(layout.root))
    if (s.type === "stack") for (const c of s.children.slice(1)) tabOf.set(c.id, s.children[0]!.id);
  for (const u of overflow) {
    const before = units.slice(0, units.indexOf(u)).reverse();
    const was = tabOf.get(u.ids[0]!);
    const prefer = [
      u.linkedTo !== undefined ? cellOf.get(u.linkedTo) : undefined,
      was !== undefined ? cellOf.get(was) : undefined,
      ...before.map((b) => cellOf.get(b.ids[0]!)),
      ...panesOnly,
    ].filter((c): c is Unit => !!c && !c.strip);
    const home =
      prefer.find((c) => rowWidth(rowOf.get(c)!, c, u) <= width + EPS) ??
      [...panesOnly].sort(
        (a, b) =>
          Math.max(0, u.b.width - minOf(a)) - Math.max(0, u.b.width - minOf(b)) ||
          prefer.indexOf(a) - prefer.indexOf(b),
      )[0]!;
    groups.get(home)!.push(u);
    for (const id of u.ids) cellOf.set(id, home);
  }

  const position = new Map(all.map((p, i) => [p.id, i]));
  // New nodes are named from the order alone, so the same arrangement gets the same names.
  const taken = new Set(all.map((p) => p.id));
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
  const cell = (group: Unit[]): LayoutNode => {
    const head = group[0]!;
    if (head.strip) return { ...(head.node as SplitNode), size: { weight: 1 } };
    if (group.length === 1) return clean(head.node as PaneNode);
    // Its tabs in the order the layout had them, so arranging again keeps it.
    const tabs = group.slice(1).sort((a, b) => position.get(a.ids[0]!)! - position.get(b.ids[0]!)!);
    const children = [head, ...tabs].map((u) => clean(u.node as PaneNode));
    const pinned = children.filter((c) => c.pinned);
    const sorted = [...pinned, ...children.filter((c) => !c.pinned)];
    // The cell's own pane shows, unless the focused pane is one of its tabs.
    const shown = sorted.find((c) => c.id === options.focused) ?? children[0]!;
    const stack: StackNode = {
      id: fresh("tabs"),
      type: "stack",
      size: { weight: 1 },
      children: sorted,
      active: shown.id,
      origin: "user",
    };
    return stack;
  };
  const line = (r: Unit[]): LayoutNode =>
    r.length === 1
      ? cell(groups.get(r[0]!)!)
      : {
          id: fresh("row"),
          type: "row",
          size: { weight: 1 },
          children: r.map((u) => cell(groups.get(u)!)),
        };
  const lines = rows.map(line);
  let root: LayoutNode =
    lines.length === 1
      ? { ...lines[0]!, size: { weight: 1 } }
      : { id: fresh("column"), type: "column", size: { weight: 1 }, children: lines };

  // Hidden panes stay hidden, in the tree beside the rest (those inside a kept row that scrolls are there already).
  const inTree = new Set(tree.panes(root).map((p) => p.id));
  const off = all.filter((p) => hidden.has(p.id) && !inTree.has(p.id)).map(clean);
  if (off.length)
    root =
      root.type === "row" || root.type === "column"
        ? { ...root, children: [...root.children, ...off] }
        : { id: fresh("row"), type: "row", size: { weight: 1 }, children: [root, ...off] };
  const next: Layout = { version: 1, root };
  const stillHidden = all.filter((p) => hidden.has(p.id)).map((p) => p.id);
  if (stillHidden.length) next.overlay = { tucks: [], folds: [], shown: {}, hidden: stillHidden };

  // Every pane exactly once, or no change: auto layout must never lose or copy a pane.
  const out = tree.panes(next.root).map((p) => p.id);
  if (
    out.length !== all.length ||
    new Set(out).size !== out.length ||
    all.some((p) => !out.includes(p.id))
  )
    return layout;
  // The arrangement it already has: the same layout, so nothing changes and no history entry is made.
  if (JSON.stringify(next.root) === JSON.stringify(layout.root)) return layout;
  return next;
}
