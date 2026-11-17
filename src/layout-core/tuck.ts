/**
 * Tuck and put back (17 Nov; replaces minimise to a rail). A tucked pane leaves its split and becomes a tab of its home.
 * The home's slot absorbs the vacated extent, so every rect outside the home's group stays where it was, and `putBack`
 * reverses the change exactly when nothing has changed since.
 */
import type {
  Axis, Edge, FitOptions, Layout, LayoutNode, PaneBox, PaneNode, PutBackResult, Size, SplitNode, StackNode, TuckCheck,
  TuckOrigin, TuckResult, ViewState,
} from "./types";
import { clone, find, isSplit, newId, nodes, panes, parent, replace, unfold } from "./model";
import { focus } from "./focus";
import { AUTO_PREFIX, resolve } from "./resolve";

const NO_FOCUS: ViewState = { focusHistory: [] };
const sameSize = (a: Size, b: Size) => ("px" in a && "px" in b && a.px === b.px) || ("weight" in a && "weight" in b && a.weight === b.weight);
const holds = (n: LayoutNode, id: string) => n.id === id || panes(n).some(p => p.id === id);

interface Geometry { boxes: Map<string, PaneBox>; shown: Set<string> }
function geometry(layout: Layout, fit: FitOptions | undefined, paneCap: number): Geometry | undefined {
  if (!fit) return undefined;
  const boxes = resolve(layout, NO_FOCUS, fit, paneCap).panes;
  return { boxes: new Map(boxes.map(b => [b.id, b])), shown: new Set(boxes.filter(b => !b.hiddenInStack).map(b => b.id)) };
}
/** The pane on screen where `id` lives: itself, or the shown tab of its displayed group. */
function shownFor(id: string, g: Geometry | undefined): string | undefined {
  if (!g) return id;
  const box = g.boxes.get(id);
  if (!box) return undefined;
  if (!box.hiddenInStack) return id;
  return [...g.boxes.values()].find(b => b.stackId === box.stackId && !b.hiddenInStack)?.id;
}
const centre = (b: PaneBox) => [b.rect.x + b.rect.width / 2, b.rect.y + b.rect.height / 2] as const;

interface Home {
  /** The pane on screen that the tucked pane joins (named in announcements). */
  shown: string;
  /** The tree node the pane is inserted into: a pane (becomes a "tuck" stack) or an existing stack. */
  target: string;
  /** The split level and child slot that absorbs the vacated extent (absent when the home is further out). */
  slot?: LayoutNode;
}
/**
 * The home: the pane's source if it is on screen in an adjacent sibling slot; otherwise the nearest previous sibling
 * slot with something on screen; otherwise the nearest next one. Within a slot, the source, else the pane on screen
 * nearest the tucked pane. A slot that only shows the tucked pane's own group does not count. If no sibling qualifies,
 * the search moves out one split level.
 */
function chooseHome(layout: Layout, pane: PaneNode, g: Geometry | undefined): Home | undefined {
  const own = shownFor(pane.id, g);
  const ownGroup = g?.boxes.get(pane.id)?.stackId;
  const me = g?.boxes.get(pane.id);
  const candidates = (slot: LayoutNode, from: "prev" | "next") => {
    const ids = panes(slot).map(p => p.id).filter(id => id !== pane.id);
    const shown = [...new Set(ids.map(id => shownFor(id, g)).filter((s): s is string => !!s && s !== own))]
      .filter(s => !ownGroup || g!.boxes.get(s)?.stackId !== ownGroup);
    if (!shown.length) return undefined;
    if (pane.linkedTo && shown.includes(pane.linkedTo)) return pane.linkedTo;
    if (me && g) {
      const [mx, my] = centre(me);
      return shown.sort((a, b) => { const [ax, ay] = centre(g.boxes.get(a)!), [bx, by] = centre(g.boxes.get(b)!); return Math.hypot(ax - mx, ay - my) - Math.hypot(bx - mx, by - my); })[0];
    }
    return from === "prev" ? shown.at(-1) : shown[0];
  };
  const targetFor = (shown: string): string => {
    // A pane shown in an automatic fold joins the fold's home pane in the tree (its tab choice keeps it shown).
    const stackId = g?.boxes.get(shown)?.stackId;
    const treePane = stackId?.startsWith(AUTO_PREFIX) ? stackId.slice(AUTO_PREFIX.length) : shown;
    const holder = parent(layout.root, treePane);
    return holder?.type === "stack" ? holder.id : treePane;
  };
  let child: LayoutNode = pane;
  let level = parent(layout.root, pane.id);
  let direct = true;
  while (level && isSplit(level)) {
    const at = level.children.findIndex(c => c.id === child.id);
    const prev = level.children.slice(0, at).reverse(), next = level.children.slice(at + 1);
    let found: { shown: string; slot: LayoutNode } | undefined;
    if (pane.linkedTo) for (const slot of [prev[0], next[0]]) {
      if (!found && slot && holds(slot, pane.linkedTo) && shownFor(pane.linkedTo, g) === pane.linkedTo) found = { shown: pane.linkedTo, slot };
    }
    for (const slot of prev) { if (found) break; const s = candidates(slot, "prev"); if (s) found = { shown: s, slot }; }
    for (const slot of next) { if (found) break; const s = candidates(slot, "next"); if (s) found = { shown: s, slot }; }
    if (found) {
      const target = targetFor(found.shown);
      return { shown: found.shown, target, ...(direct && holds(found.slot, target) ? { slot: found.slot } : {}) };
    }
    child = level; level = parent(layout.root, level.id); direct = false;
  }
  return undefined;
}

export function canTuck(layout: Layout, paneId: string, fit?: FitOptions, paneCap = Infinity): TuckCheck {
  const node = find(layout.root, paneId);
  if (node?.type !== "pane") return { ok: false, reason: "missing" };
  const container = parent(layout.root, paneId);
  if (!container) return { ok: false, reason: "last" };
  if (container.type === "stack") return { ok: false, reason: "tab" };
  const g = geometry(layout, fit, paneCap);
  if (g && !g.shown.has(paneId)) return { ok: false, reason: "hidden" };
  if (g && g.shown.size <= 1) return { ok: false, reason: "last" };
  const home = chooseHome(layout, node, g);
  return home ? { ok: true, home: home.shown } : { ok: false, reason: "last" };
}

/** Pixel extent of a subtree along an axis, from the shown panes' rects. */
function extentOf(node: LayoutNode, axis: Axis, g: Geometry): number {
  const rects = panes(node).map(p => g.boxes.get(p.id)).filter((b): b is PaneBox => !!b && !b.hiddenInStack).map(b => b.rect);
  if (!rects.length) return 0;
  return axis === "row" ? Math.max(...rects.map(r => r.x + r.width)) - Math.min(...rects.map(r => r.x)) : Math.max(...rects.map(r => r.y + r.height)) - Math.min(...rects.map(r => r.y));
}
const rectsEqual = (a: PaneBox["rect"], b: PaneBox["rect"]) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.width - b.width) < 1e-6 && Math.abs(a.height - b.height) < 1e-6;

/** Insert `pane` as a tab of `target`, keeping the target's shown tab. A lone pane becomes a "tuck" stack. */
function addTab(layout: Layout, target: string, pane: PaneNode): void {
  const node = find(layout.root, target)!;
  if (node.type === "stack") { node.children.push(pane); return; }
  const home = node as PaneNode;
  const stack: StackNode = { id: newId(layout.root, "stack"), type: "stack", size: clone(home.size), children: [home, pane], active: home.id, origin: "tuck" };
  if (home.userSized !== undefined) stack.userSized = home.userSized;
  layout.root = replace(layout.root, home.id, stack);
}

export function tuck(layout: Layout, view: ViewState, paneId: string, fit?: FitOptions, paneCap = Infinity): TuckResult {
  const check = canTuck(layout, paneId, fit, paneCap);
  if (!check.ok) return check;
  const g = geometry(layout, fit, paneCap);
  const next: Layout = { ...clone(layout), root: unfold(clone(layout.root)) };
  const pane = find(next.root, paneId) as PaneNode;
  const home = chooseHome(next, pane, g)!;
  const container = parent(next.root, paneId) as SplitNode;
  const axis: Axis = container.type;
  const at = container.children.indexOf(pane);
  const slot = home.slot ? container.children.find(c => c.id === home.slot!.id) : undefined;
  const beside = slot ?? container.children[at - 1] ?? container.children[at + 1]!;
  const origin: TuckOrigin = {
    parent: container.id, axis, index: at, beside: beside.id, side: container.children.indexOf(beside) < at ? "after" : "before",
    size: clone(pane.size), home: home.shown,
    seq: 1 + Math.max(0, ...panes(layout.root).map(q => q.tuckedFrom?.seq ?? 0)), order: container.children.map(c => panes(c)[0]?.id ?? c.id),
  };
  if (pane.userSized !== undefined) origin.userSized = pane.userSized;
  // The home's slot absorbs the vacated extent (and the gap), so its siblings keep their rects.
  const before = new Map(container.children.map(c => [c.id, clone(c.size)]));
  const others = container.children.filter(c => c !== pane);
  if (slot && g) {
    const extent = extentOf(pane, axis, g);
    origin.extent = extent;
    const sizes = others.map(c => ({ c, e: extentOf(c, axis, g) }));
    const outside = panes(layout.root).filter(p => p.id !== paneId && !holds(slot, p.id));
    const verify = (): boolean => {
      const trial: Layout = clone(next);
      const trialParent = find(trial.root, container.id) as SplitNode;
      trialParent.children = trialParent.children.filter(c => c.id !== paneId);
      const after = resolve(trial, NO_FOCUS, fit!, paneCap).panes;
      return outside.every(p => { const a = g.boxes.get(p.id), b = after.find(x => x.id === p.id); return !a || !b || a.hiddenInStack || rectsEqual(a.rect, b.rect); });
    };
    const original = others.map(c => clone(c.size));
    let done = false;
    if (others.every(c => "weight" in c.size) && "weight" in pane.size) {
      // Same units: only the slot changes. The extra weight pays for the gap the pane no longer needs.
      const W = [...container.children].reduce((sum, c) => sum + (c.size as { weight: number }).weight, 0);
      const A = sizes.reduce((sum, s) => sum + s.e, 0) + extent;
      if (A > 0) {
        slot.size = { weight: (slot.size as { weight: number }).weight + (pane.size as { weight: number }).weight + W * fit!.gap / A };
        done = verify();
        if (!done) slot.size = clone(original[others.indexOf(slot)]!);
      }
    }
    if (!done) {
      // Mixed units or bound minimums: restate the split in pixel-proportional weights, the slot taking the extent.
      for (const { c, e } of sizes) if (e > 0) c.size = { weight: c === slot ? e + extent + fit!.gap : e };
      if (!verify()) others.forEach((c, i) => { c.size = original[i]!; });
    }
  } else if (slot) {
    if (("px" in slot.size) === ("px" in pane.size)) slot.size = sizeSum(slot.size, pane.size);
  }
  const resized = others.flatMap(c => sameSize(c.size, before.get(c.id)!) ? [] : [[c.id, before.get(c.id)!, clone(c.size)] as [string, Size, Size]]);
  if (resized.length) origin.resized = resized;
  // Leave the split in place even with one child, so its id (the origin) survives for putBack.
  container.children = others;
  const moved: PaneNode = { ...pane, tuckedFrom: origin };
  addTab(next, home.target, moved);
  return { ok: true, layout: next, view: focus(view, home.shown), home: home.shown, undo: { label: "Pane tucked", before: { layout: clone(layout), view: clone(view) }, tucked: paneId } };
}
const sizeSum = (a: Size, b: Size): Size => "px" in a && "px" in b ? { px: a.px + b.px } : { weight: (a as { weight: number }).weight + (b as { weight: number }).weight };

const edgeFor = (axis: Axis, side: "before" | "after"): Edge => axis === "row" ? (side === "after" ? "right" : "left") : (side === "after" ? "bottom" : "top");

/** Take `pane` out of its stack; a "tuck" stack left with one tab dissolves into that pane at the stack's size. Returns the id now holding the home. */
function leaveStack(layout: Layout, paneId: string, prefer?: string): string | undefined {
  const stack = parent(layout.root, paneId);
  if (stack?.type !== "stack") return undefined;
  stack.children = stack.children.filter(c => c.id !== paneId);
  if (!stack.children.some(c => c.id === stack.active)) stack.active = stack.children.find(c => c.id === prefer)?.id ?? stack.children[0]!.id;
  if (stack.origin === "tuck" && stack.children.length === 1) {
    const only = { ...stack.children[0]!, size: clone(stack.size) };
    if (stack.userSized !== undefined) only.userSized = stack.userSized; else delete only.userSized;
    layout.root = replace(layout.root, stack.id, only);
    return only.id;
  }
  return stack.id;
}

export function putBack(layout: Layout, view: ViewState, paneId: string, fit?: FitOptions, paneCap = Infinity): PutBackResult {
  const node = find(layout.root, paneId);
  if (node?.type !== "pane") return { ok: false, reason: "missing" };
  if (!node.tuckedFrom) return { ok: false, reason: "not-tucked" };
  const from = node.tuckedFrom;
  const next: Layout = { ...clone(layout), root: unfold(clone(layout.root)) };
  const pane = clone(find(next.root, paneId) as PaneNode);
  delete pane.tuckedFrom;
  pane.size = clone(from.size);
  if (from.userSized !== undefined) pane.userSized = from.userSized; else delete pane.userSized;
  const holder = leaveStack(next, paneId, from.home);
  const container = find(next.root, from.parent);
  const besideChild = container && isSplit(container) && container.type === from.axis ? container.children.find(c => holds(c, from.beside)) : undefined;
  if (container && isSplit(container) && besideChild) {
    // Exact path: siblings the tuck resized and nobody touched since get their sizes back.
    let restored = true;
    for (const [id, beforeSize, afterSize] of from.resized ?? []) {
      const child = container.children.find(c => c.id === id || (id === from.beside && c === besideChild));
      if (child && sameSize(child.size, afterSize)) child.size = clone(beforeSize); else restored = false;
    }
    if (!restored && fit && from.extent) {
      // Sizes changed since: carve the pane's old extent out of the sibling it sat beside.
      const g = geometry(layout, fit, paneCap)!;
      const room = extentOf(besideChild, from.axis, g);
      const want = Math.min(from.extent, Math.max(0, room - fit.gap - 1));
      for (const c of container.children) { const e = extentOf(c, from.axis, g); if (e > 0) c.size = { weight: c === besideChild ? room - want - fit.gap : e }; }
      pane.size = { weight: want };
    }
    container.children.splice(slotIn(next, container, from, paneId) ?? container.children.indexOf(besideChild) + (from.side === "after" ? 1 : 0), 0, pane);
    handOn(next, from, paneId);
    return { ok: true, layout: next, view: focus(view, paneId), restored: "origin", home: from.home };
  }
  if (container && isSplit(container) && container.type === from.axis) {
    // The recorded neighbour is gone (itself tucked, or a stack that dissolved): the recorded order still says where.
    const at = slotIn(next, container, from, paneId);
    if (at !== undefined) {
      container.children.splice(at, 0, pane);
      for (const c of container.children) if (!c.userSized) c.size = { weight: 1 };
      handOn(next, from, paneId);
      return { ok: true, layout: next, view: focus(view, paneId), restored: "beside", home: from.home };
    }
  }
  // The origin is gone: beside the home, on the side it came from.
  const anchor = holder ?? (find(next.root, from.home) ? from.home : nodes(next.root).find(n => n.type === "pane")!.id);
  besideNode(next, anchor, edgeFor(from.axis, from.side), pane);
  return { ok: true, layout: next, view: focus(view, paneId), restored: "beside", home: from.home };
}

/**
 * Where a put-back pane goes among the split's children. The tuck that happened earliest recorded the split's full
 * order, including every pane tucked after it, so the earliest record still tucked from this split (or this pane's own)
 * is the reference: the pane goes before the nearest following sibling now present, else after the nearest preceding one.
 * That restores the original relative order whichever order the panes come back in. Undefined when the record has no
 * usable order (older links), and the recorded neighbour is used instead.
 */
function slotIn(layout: Layout, container: SplitNode, from: TuckOrigin, paneId: string): number | undefined {
  let ref: TuckOrigin = from;
  for (const q of panes(layout.root)) {
    const o = q.tuckedFrom;
    if (o && q.id !== paneId && o.parent === from.parent && o.order && (o.seq ?? Infinity) < (ref.seq ?? Infinity) && o.order.includes(paneId)) ref = o;
  }
  const order = ref.order;
  const at = order?.indexOf(paneId) ?? -1;
  if (!order || at < 0) return undefined;
  const here = (id: string) => container.children.findIndex(c => panes(c).some(x => x.id === id && !x.tuckedFrom));
  const next = order.slice(at + 1).map(here).find(i => i >= 0);
  if (next !== undefined) return next;
  const prev = order.slice(0, at).reverse().map(here).find(i => i >= 0);
  return prev === undefined ? undefined : prev + 1;
}

/** Panes tucked later from the same split inherit this record's fuller order, since its record is about to be dropped. */
function handOn(layout: Layout, from: TuckOrigin, paneId: string): void {
  if (!from.order) return;
  for (const q of panes(layout.root)) {
    const o = q.tuckedFrom;
    if (o && q.id !== paneId && o.parent === from.parent && (o.seq ?? 0) > (from.seq ?? 0) && (!o.order || o.order.every(id => from.order!.includes(id)))) q.tuckedFrom = { ...o, order: from.order };
  }
}

function besideNode(layout: Layout, targetId: string, edge: Edge, pane: PaneNode): void {
  const target = find(layout.root, targetId)!;
  const container = parent(layout.root, targetId);
  const axis: Axis = edge === "left" || edge === "right" ? "row" : "column";
  const before = edge === "left" || edge === "top";
  if (container && container.type === axis) {
    container.children.splice(container.children.indexOf(target) + (before ? 0 : 1), 0, pane);
    for (const c of container.children) if (!c.userSized) c.size = { weight: 1 };
    return;
  }
  const split: SplitNode = { id: newId(layout.root, "split"), type: axis, size: clone(target.size), children: before ? [pane, { ...target, size: { weight: 1 } }] : [{ ...target, size: { weight: 1 } }, pane] };
  if (target.userSized !== undefined) split.userSized = target.userSized;
  pane.size = { weight: 1 };
  delete pane.userSized;
  layout.root = replace(layout.root, target.id, split);
}

/** Every tucked pane put back structurally (no geometry). Used to judge unfolding as if nothing were tucked. */
export function untuckAll(layout: Layout): Layout {
  let current = layout;
  for (let guard = 0; guard < 2048; guard++) {
    const tucked = panes(current.root).find(p => p.tuckedFrom);
    if (!tucked) return current;
    const r = putBack(current, NO_FOCUS, tucked.id);
    if (!r.ok) return current;
    current = r.layout;
  }
  return current;
}

/** Legacy links (`collapsed: true` from the rail era) decode as tucked panes. */
export function migrateCollapsed(layout: Layout): Layout {
  let current = layout;
  for (let guard = 0; guard < 2048; guard++) {
    const legacy = panes(current.root).find(p => (p as PaneNode & { collapsed?: boolean }).collapsed !== undefined);
    if (!legacy) return current;
    const wasCollapsed = (legacy as PaneNode & { collapsed?: boolean }).collapsed;
    const clean = clone(current);
    delete (find(clean.root, legacy.id) as PaneNode & { collapsed?: boolean }).collapsed;
    current = clean;
    if (wasCollapsed) { const r = tuck(current, NO_FOCUS, legacy.id); if (r.ok) current = r.layout; }
  }
  return current;
}
