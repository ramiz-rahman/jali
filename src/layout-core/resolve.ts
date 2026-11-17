import type { Axis, FitOptions, Layout, LayoutNode, PaneNode, Rect, ResolvedLayout, Size, ViewState } from "./types";
import { clone, combined, unfold } from "./model";
import { untuckAll } from "./tuck";

interface Bounds { width: number; height: number; maxWidth: number }
interface Projected {
  id: string;
  type: LayoutNode["type"] | "auto";
  size: Size;
  children: Projected[];
  pane?: PaneNode;
  active?: string;
  /** Pane the automatic stack formed around (the folded panes' related home). */
  home?: string;
  bounds: Bounds;
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export interface Share { size: Size; min: number; max?: number }

/** Fixed pixels first; weighted children freeze at their bounds and re-share the remainder. */
export function shares(items: Share[], available: number): number[] {
  const values = items.map(() => 0);
  const minimum = items.reduce((sum, item) => sum + item.min, 0);
  const budget = Math.max(available, minimum);
  const fixed = items.flatMap((item, i) => "px" in item.size ? [i] : []);
  const weighted = items.flatMap((item, i) => "weight" in item.size ? [i] : []);
  for (const i of fixed) values[i] = clamp((items[i]!.size as { px: number }).px, items[i]!.min, items[i]!.max ?? Infinity);
  const fixedTotal = fixed.reduce((sum, i) => sum + values[i]!, 0);
  const weightedMin = weighted.reduce((sum, i) => sum + items[i]!.min, 0);
  // A saved px preference cannot crowd out another child's hard minimum after a viewport shrink.
  const excess = Math.max(0, fixedTotal + weightedMin - budget);
  const slack = fixed.reduce((sum, i) => sum + values[i]! - items[i]!.min, 0);
  if (excess && slack) for (const i of fixed) values[i] = values[i]! - excess * (values[i]! - items[i]!.min) / slack;
  let remaining = budget - fixed.reduce((sum, i) => sum + values[i]!, 0);
  let pending = weighted;
  while (pending.length) {
    const weight = pending.reduce((sum, i) => sum + (items[i]!.size as { weight: number }).weight, 0);
    const raw = new Map(pending.map(i => [i, remaining * (items[i]!.size as { weight: number }).weight / weight]));
    const boundedTotal = pending.reduce((sum, i) => sum + clamp(raw.get(i)!, items[i]!.min, items[i]!.max ?? Infinity), 0);
    const freezeMin = boundedTotal > remaining + 1e-7;
    const freeze = pending.filter(i => freezeMin ? raw.get(i)! < items[i]!.min : raw.get(i)! > (items[i]!.max ?? Infinity));
    if (!freeze.length) {
      for (const i of pending) values[i] = clamp(raw.get(i)!, items[i]!.min, items[i]!.max ?? Infinity);
      break;
    }
    for (const i of freeze) {
      values[i] = freezeMin ? items[i]!.min : (items[i]!.max ?? Infinity);
      remaining -= values[i]!;
    }
    pending = pending.filter(i => !freeze.includes(i));
  }
  // Never leave a void: hand leftover space to children that can grow (fixed-px preferences included), in proportion, up to their max.
  let leftover = budget - values.reduce((sum, v) => sum + v, 0);
  let growable = items.map((_, i) => i).filter(i => values[i]! < (items[i]!.max ?? Infinity) - 1e-7);
  while (leftover > 1e-6 && growable.length) {
    const base = growable.reduce((sum, i) => sum + Math.max(values[i]!, 1), 0);
    let given = 0;
    for (const i of growable) {
      const add = Math.min(leftover * Math.max(values[i]!, 1) / base, (items[i]!.max ?? Infinity) - values[i]!);
      values[i] = values[i]! + add; given += add;
    }
    leftover -= given;
    growable = growable.filter(i => values[i]! < (items[i]!.max ?? Infinity) - 1e-7);
    if (given < 1e-9) break;
  }
  return values;
}

function refresh(node: Projected, fit: FitOptions): void {
  if (node.pane) return;
  const children = node.children;
  const widths = children.map(c => c.bounds.width);
  const heights = children.map(c => c.bounds.height);
  const maxima = children.map(c => c.bounds.maxWidth);
  const gaps = Math.max(0, children.length - 1) * fit.gap;
  if (node.type === "row") node.bounds = { width: widths.reduce((a, b) => a + b, 0) + gaps, height: Math.max(...heights), maxWidth: maxima.reduce((a, b) => a + b, 0) + gaps };
  else if (node.type === "column") node.bounds = { width: Math.max(...widths), height: heights.reduce((a, b) => a + b, 0) + gaps, maxWidth: Math.max(Math.max(...widths), Math.min(...maxima)) };
  else node.bounds = { width: Math.max(...widths), height: Math.max(...heights), maxWidth: Math.max(Math.max(...widths), Math.min(...maxima)) };
}
function project(node: LayoutNode, fit: FitOptions): Projected {
  if (node.type === "pane") {
    const kind = fit.kinds[node.ref.kind];
    if (!kind) throw new Error(`Unknown pane kind: ${node.ref.kind}`);
    const bounds = { width: kind.minWidth, height: kind.minHeight, maxWidth: kind.maxWidth ?? Infinity };
    return { id: node.id, type: "pane", size: node.size, children: [], pane: node, bounds };
  }
  // "user" and "tuck" stacks are both tree stacks here; only legacy "auto" stacks were unfolded before projection.
  const result: Projected = {
    id: node.id, type: node.type === "stack" && node.origin === "auto" ? "auto" : node.type, size: node.size,
    active: node.type === "stack" ? node.active : undefined,
    children: node.children.map(c => project(c, fit)),
    bounds: { width: 0, height: 0, maxWidth: Infinity },
  };
  refresh(result, fit);
  return result;
}
const allPanes = (n: Projected): Projected[] => n.pane ? [n] : n.children.flatMap(allPanes);
const contains = (n: Projected, id?: string): boolean => !!id && allPanes(n).some(p => p.id === id);
/**
 * Stable home of a slot: a pane is its own home, a deliberate stack's is its first tab (never its active tab, which a
 * click changes), and an automatic group keeps the home it formed around. Fold records and tab choices key on it.
 */
const homeOf = (n: Projected): string => n.type === "auto" ? n.home ?? allPanes(n)[0]!.id : n.pane ? n.id : allPanes(n)[0]!.id;
const orderOf = (n: Projected, order: Map<string, number>) => Math.min(...allPanes(n).map(p => order.get(p.id) ?? Infinity));
/** Automatic stacks are named after their home pane, so the id survives the group growing or a tab being chosen. */
export const AUTO_PREFIX = "@auto:";
function auto(children: Projected[], fit: FitOptions, order: Map<string, number>, home: Projected, fallback?: string): Projected {
  const size = children.map(c => c.size).reduce(combined);
  const homeId = homeOf(home);
  const preferred = children.find(c => c.id === fallback);
  if (preferred?.type === "auto") fallback = preferred.active;
  // Keep one tab group when a later fold grows an automatic stack; tabs stay in reading order.
  children = children.flatMap(c => c.type === "auto" ? c.children : [c]).sort((a, b) => orderOf(a, order) - orderOf(b, order));
  const result: Projected = {
    id: `${AUTO_PREFIX}${homeId}`, type: "auto", children, size, home: homeId,
    // The home stays the shown tab: a fold never changes what the receiving slot displays.
    active: children.find(c => c.id === fallback)?.id ?? children[0]!.id,
    bounds: { width: 0, height: 0, maxWidth: Infinity },
  };
  refresh(result, fit);
  return result;
}
function slots(root: Projected): Projected[] {
  return root.type === "row" || root.type === "column" ? root.children.flatMap(slots) : [root];
}
function autos(root: Projected): Projected[] {
  return root.type === "auto" ? [root] : root.pane ? [] : root.children.flatMap(autos);
}
/** Remove one displayed slot, retaining the outer size of pruned singleton splits. */
function removeSlot(node: Projected, id: string): Projected | undefined {
  if (node.id === id) return undefined;
  if (node.type !== "row" && node.type !== "column") return node;
  node.children = node.children.flatMap(c => { const next = removeSlot(c, id); return next ? [next] : []; });
  if (!node.children.length) return undefined;
  return node.children.length === 1 ? { ...node.children[0]!, size: node.size } : node;
}

const cmp = (a: number, b: number) => a === b ? 0 : a < b ? -1 : 1;
const NO_FOCUS: ViewState = { focusHistory: [] };
/**
 * Which displayed slot to fold next. Runs only when a fold is needed (structural or size change), never on focus.
 * Protected: the focused pane, its source and its direct details.
 * Order: unprotected unpinned, unprotected pinned, protected unpinned, protected pinned, the focused slot.
 * Within a tier: unlinked panes, then the far end of link chains (deepest from focus), then least recently
 * focused, then narrowest, then reading order. With no focused pane, the first pane in reading order stands in.
 */
function chooseFold(root: Projected, view: ViewState, order: Map<string, number>): Projected | undefined {
  const displayed = slots(root);
  if (displayed.length < 2) return undefined;
  const panes = allPanes(root);
  const ids = new Set(panes.map(p => p.id));
  const linkOf = (p: Projected) => p.pane!.linkedTo && ids.has(p.pane!.linkedTo) ? p.pane!.linkedTo : undefined;
  // With no focus yet (boot, a shared link), the first pane in reading order counts as focused: apps focus it first.
  const focused = view.focused && ids.has(view.focused) ? view.focused : [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))[0];
  const protectedIds = new Set<string>();
  if (focused) {
    protectedIds.add(focused);
    const source = linkOf(panes.find(p => p.id === focused)!);
    if (source) protectedIds.add(source);
    for (const p of panes) if (linkOf(p) === focused) protectedIds.add(p.id);
  }
  // Undirected link distance from the focused pane; unreachable chains are infinitely far.
  const distance = new Map<string, number>();
  if (focused) {
    distance.set(focused, 0);
    for (let queue = [focused]; queue.length;) {
      const id = queue.shift()!;
      for (const p of panes) {
        const near = linkOf(p) === id ? p.id : p.id === id ? linkOf(p) : undefined;
        if (near && !distance.has(near)) { distance.set(near, distance.get(id)! + 1); queue.push(near); }
      }
    }
  }
  const linkedIds = new Set(panes.flatMap(p => linkOf(p) ? [p.id, linkOf(p)!] : []));
  const rank = (id: string) => { const i = view.focusHistory.indexOf(id); return i < 0 ? Infinity : i; };
  const score = (slot: Projected) => {
    const members = allPanes(slot);
    const pinned = members.some(p => p.pane!.pinned);
    const tier = members.some(p => p.id === focused) ? 4 : members.some(p => protectedIds.has(p.id)) ? 2 + Number(pinned) : Number(pinned);
    return {
      slot, tier, linked: Number(members.some(p => linkedIds.has(p.id))),
      depth: Math.max(...members.map(p => distance.get(p.id) ?? Infinity)),
      recent: Math.min(...members.map(p => rank(p.id))), width: slot.bounds.width, order: orderOf(slot, order),
    };
  };
  const ranked = displayed.map(score).sort((a, b) => cmp(a.tier, b.tier) || cmp(a.linked, b.linked) || cmp(b.depth, a.depth) || cmp(b.recent, a.recent) || cmp(a.width, b.width) || cmp(a.order, b.order));
  return ranked[0]!.slot;
}
/**
 * Fold one displayed slot into its related home: its source's slot, else a direct detail's, else its nearest
 * neighbour (preferring an existing automatic stack). Depends only on the tree, never on focus, so a recorded
 * sequence of folds replays to the same arrangement.
 */
function foldSlot(root: Projected, choice: Projected, fit: FitOptions, order: Map<string, number>): Projected {
  const displayed = slots(root);
  const panes = allPanes(root);
  const ids = new Set(panes.map(p => p.id));
  const linkOf = (p: Projected) => p.pane!.linkedTo && ids.has(p.pane!.linkedTo) ? p.pane!.linkedTo : undefined;
  function owner(n: Projected): Projected | undefined {
    if (n.type !== "row" && n.type !== "column") return undefined;
    return n.children.includes(choice) ? n : n.children.map(owner).find(Boolean);
  }
  const parent = owner(root)!;
  const members = new Set(allPanes(choice).map(p => p.id));
  const outside = (id: string | undefined) => id && !members.has(id) ? displayed.find(s => s !== choice && contains(s, id)) : undefined;
  const sources = allPanes(choice).map(p => outside(linkOf(p))).filter((s): s is Projected => !!s);
  const details = panes.filter(p => !members.has(p.id) && members.has(linkOf(p) ?? "")).map(p => displayed.find(s => contains(s, p.id))!);
  let home = sources[0] ?? details[0];
  if (!home) {
    // Unlinked (or only linked within itself): nearest neighbour, preferring an existing automatic stack.
    const at = displayed.indexOf(choice);
    const near = [displayed[at - 1], displayed[at + 1]].filter((n): n is Projected => !!n);
    near.sort((a, b) => Number(b.type === "auto") - Number(a.type === "auto"));
    home = near[0]!;
  }
  const pair = displayed.indexOf(choice) < displayed.indexOf(home) ? [choice, home] : [home, choice];
  const group = auto(pair, fit, order, home, home.type === "auto" ? home.active : home.id);
  // Across nested splits, the receiving slot keeps its allocation in its own axis.
  const sameParent = parent.children.includes(home);
  root = removeSlot(root, choice.id)!;
  function replace(n: Projected): Projected {
    if (n.id === home!.id) { if (!sameParent) group.size = n.size; return group; }
    if (n.type === "row" || n.type === "column") n.children = n.children.map(replace);
    refresh(n, fit);
    return n;
  }
  return replace(root);
}

interface Replayed { root: Projected; order: Map<string, number>; applied: string[] }
/** The canonical tree (automatic stacks from older links unfolded) with the recorded folds applied, in order. */
function replay(layout: Layout, folds: readonly string[], fit: FitOptions): Replayed {
  let root = project(unfold(clone(layout.root)), fit);
  const order = new Map(allPanes(root).map((p, i) => [p.id, i]));
  const applied: string[] = [];
  for (const id of folds) {
    const displayed = slots(root);
    if (displayed.length < 2) break;
    const choice = displayed.find(s => s.id === id);
    if (!choice) continue; // stale record (closed or moved pane): skip it
    root = foldSlot(root, choice, fit, order);
    applied.push(id);
  }
  return { root, order, applied };
}
const tooSmall = (root: Projected, fit: FitOptions) => root.bounds.width > fit.width + 1e-7 || root.bounds.height > fit.height + 1e-7;
const misfit = (root: Projected, fit: FitOptions, paneCap: number) => tooSmall(root, fit) || slots(root).length > paneCap;
/** Show each automatic group's chosen tab (keyed by home), when that pane is still in the group. */
function choose(root: Projected, active: Record<string, string> | undefined): void {
  if (!active) return;
  for (const group of autos(root)) {
    const want = active[group.home!];
    const child = want ? group.children.find(c => contains(c, want)) : undefined;
    if (child) group.active = child.id;
  }
}

function build(layout: Layout, fit: FitOptions, paneCap: number): Projected {
  let { root, order } = replay(layout, layout.fold?.order ?? [], fit);
  // Safety net only: a layout not yet refitted for this size still never squeezes. Focus plays no part here
  // (the first pane in reading order stands in for it).
  while (misfit(root, fit, paneCap)) {
    const choice = chooseFold(root, NO_FOCUS, order);
    if (!choice) break;
    root = foldSlot(root, choice, fit, order);
  }
  choose(root, layout.fold?.active);
  return root;
}

export interface RefitOptions {
  /**
   * "full": unfold (most recent first) when room returned, then fold if needed. "fold": only fold, never unfold.
   * "load": a layout arriving from a link, reload or Back; same as "full". Either way unfolding is judged as if every
   * tucked pane were back in its slot, so the space a tuck gave its home never unfolds anything, and the same width
   * always gives the same arrangement whatever is tucked.
   */
  mode?: "full" | "fold" | "load";
  /** A just-opened pane: when there is no room it becomes the tab ("Opened as a tab: not enough room"). */
  fresh?: string;
  /** Panes the cap must not tab (the open's source and the new pane). */
  keep?: readonly string[];
  /** Pane age for the cap (lower is older); reading order otherwise. */
  age?: ReadonlyMap<string, number>;
}
/**
 * Decide folds for the current size and record them on the Layout (`layout.fold`). Called only on a structural change
 * or a size change. Unfolds pop the most recent folds first, to the shortest recorded prefix that fits, so returning
 * to an earlier width restores the arrangement it had. New folds use the focus-protecting priority as it stands now.
 * Returns the same Layout object when nothing changed.
 */
export function refit(layout: Layout, view: ViewState, fit: FitOptions, paneCap = Infinity, options: RefitOptions = {}): Layout {
  const stored = layout.fold?.order ?? [];
  let current = replay(layout, stored, fit).applied;
  const mode = options.mode ?? "full";
  if (mode !== "fold") {
    const probe: Layout = untuckAll(layout);
    for (let k = 0; k < current.length; k++) {
      if (!misfit(replay(probe, current.slice(0, k), fit).root, fit, paneCap)) { current = current.slice(0, k); break; }
    }
  }
  const kept = current.length;
  const keep = new Set(options.keep ?? []);
  for (;;) {
    const { root, order } = replay(layout, current, fit);
    const small = tooSmall(root, fit), over = slots(root).length > paneCap;
    if (!small && !over) break;
    const displayed = slots(root);
    if (displayed.length < 2) break;
    const fresh = options.fresh ? displayed.find(s => s.pane && s.id === options.fresh) : undefined;
    let choice: Projected | undefined;
    if (small) choice = fresh;
    else {
      // Over the cap only: the oldest unpinned, unfocused pane becomes a tab (spec §3).
      const age = (id: string) => options.age?.get(id) ?? order.get(id) ?? Infinity;
      choice = displayed.filter(s => s.pane && !keep.has(s.id) && s.id !== view.focused && !s.pane.pinned).sort((a, b) => age(a.id) - age(b.id))[0] ?? fresh;
    }
    choice ??= chooseFold(root, view, order);
    if (!choice) break;
    current = [...current, choice.id];
  }
  // Tab choices are kept while both panes exist, even when their group is absorbed or unfolded, so the group shows
  // the same tab when a later size change re-forms it.
  const { root } = replay(layout, current, fit);
  const present = new Set(allPanes(root).map(p => p.id));
  const active: Record<string, string> = Object.fromEntries(Object.entries(layout.fold?.active ?? {}).filter(([home, pane]) => present.has(home) && present.has(pane)));
  const changed = current.length !== stored.length || current.some((id, i) => id !== stored[i]);
  // Only a new fold may change a shown tab (to keep the focused pane in view); unfolding restores what was there.
  if (current.length > kept && view.focused) {
    const group = autos(root).find(g => contains(g, view.focused));
    if (group) {
      choose(group, active);
      if (!contains(group.children.find(c => c.id === group.active)!, view.focused)) active[group.home!] = view.focused;
    }
  }
  const before = layout.fold?.active ?? {};
  const sameActive = Object.keys(active).length === Object.keys(before).length && Object.entries(active).every(([k, v]) => before[k] === v);
  if (!changed && sameActive) return layout;
  const next: Layout = { ...layout };
  delete next.fold;
  if (current.length || Object.keys(active).length) next.fold = { order: current, ...(Object.keys(active).length ? { active } : {}) };
  return next;
}
/** Whether the layout, with its recorded folds, fits the size and cap. */
export function fits(layout: Layout, fit: FitOptions, paneCap = Infinity): boolean {
  return !misfit(replay(layout, layout.fold?.order ?? [], fit).root, fit, paneCap);
}
export function minimum(node: LayoutNode, fit: FitOptions, axis: Axis): number {
  const bounds = project(node, fit).bounds;
  return axis === "row" ? bounds.width : bounds.height;
}
export function resolve(layout: Layout, view: ViewState, fit: FitOptions, paneCap = Infinity): ResolvedLayout {
  if (![fit.width, fit.height, fit.gap].every(Number.isFinite) || fit.width < 0 || fit.height < 0 || fit.gap < 0) throw new RangeError("Fit dimensions and gap must be finite and non-negative");
  const root = build(layout, fit, paneCap);
  const result: ResolvedLayout = { panes: [], dividers: [], folded: [], stacks: [], shelf: [] };
  function draw(n: Projected, input: Rect, stackId?: string, hidden = false, folded = false): void {
    const rect = { ...input, width: Math.max(n.bounds.width, Math.min(input.width, n.bounds.maxWidth)), height: Math.max(input.height, n.bounds.height) };
    if (n.pane) {
      result.panes.push({ id: n.id, rect, ...(stackId ? { stackId, hiddenInStack: hidden } : {}) });
      if (folded) result.folded.push(n.id);
      return;
    }
    if (n.type === "stack" || n.type === "auto") {
      const selected = n.children.find(c => c.id === n.active) ?? n.children[0]!;
      if (n.type === "auto" && !stackId) {
        const homeId = n.home ?? allPanes(n)[0]!.id;
        result.stacks.push({ id: n.id, origin: "auto", homeId, foldedCount: n.children.filter(c => !contains(c, homeId)).reduce((sum, c) => sum + allPanes(c).length, 0), paneIds: allPanes(n).map(p => p.id) });
      }
      n.children.forEach(c => draw(c, rect, stackId ?? n.id, hidden || c !== selected, folded || (n.type === "auto" && c !== selected)));
      return;
    }
    const axis: Axis = n.type === "row" ? "row" : "column";
    const horizontal = axis === "row";
    const length = horizontal ? rect.width : rect.height;
    const mins = n.children.map(c => horizontal ? c.bounds.width : c.bounds.height);
    const maxs = n.children.map(c => horizontal ? c.bounds.maxWidth : Infinity);
    const available = length - fit.gap * (n.children.length - 1);
    const lengths = shares(n.children.map((c, i) => ({ size: c.size, min: mins[i]!, max: maxs[i] })), available);
    let offset = horizontal ? rect.x : rect.y;
    n.children.forEach((child, index) => {
      const extent = lengths[index]!;
      const childRect = horizontal ? { x: offset, y: rect.y, width: extent, height: rect.height } : { x: rect.x, y: offset, width: rect.width, height: extent };
      draw(child, childRect, stackId, hidden, folded);
      offset += extent;
      if (index < n.children.length - 1) {
        const total = extent + lengths[index + 1]!;
        const min = Math.max(mins[index]!, total - maxs[index + 1]!);
        const max = Math.min(maxs[index]!, total - mins[index + 1]!);
        result.dividers.push({ parentId: n.id, index, axis, min, max, value: extent, neighbours: [allPanes(child).map(p => p.id), allPanes(n.children[index + 1]!).map(p => p.id)], rect: horizontal ? { x: offset, y: rect.y, width: fit.gap, height: rect.height } : { x: rect.x, y: offset, width: rect.width, height: fit.gap } });
        offset += fit.gap;
      }
    });
  }
  draw(root, { x: 0, y: 0, width: Math.max(fit.width, root.bounds.width), height: Math.max(fit.height, root.bounds.height) });
  // The shelf: every pane not on screen, before the zoom overlay (zoom is a view, not a hiding place).
  const folded = new Set(result.folded);
  for (const box of result.panes) {
    if (!box.hiddenInStack || !box.stackId) continue;
    const shown = result.panes.find(b => b.stackId === box.stackId && !b.hiddenInStack);
    const node = allPanes(root).find(p => p.id === box.id)!.pane!;
    result.shelf.push({ paneId: box.id, homeId: shown?.id ?? box.stackId, stackId: box.stackId, reason: node.tuckedFrom ? "tucked" : folded.has(box.id) ? "folded" : "tab" });
  }
  // Zoom overlays geometry; the canonical tree and all split sizes remain intact.
  const zoom = result.panes.find(p => p.id === view.zoomed);
  if (zoom) {
    const selected = allPanes(root).find(p => p.id === zoom.id)!;
    for (const p of result.panes) p.hiddenInStack = p !== zoom;
    zoom.rect = { x: 0, y: 0, width: Math.max(fit.width, selected.bounds.width), height: Math.max(fit.height, selected.bounds.height) };
    result.dividers = [];
  }
  return result;
}
