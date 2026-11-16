import type { Edge, FitOptions, Layout, LayoutNode, LayoutOps, ObjectRef, OpenResult, PaneNode, Size, SplitNode, ViewState } from "./types";
import { activate, balance, clone, combined, find, isSplit, newId, nodes, panes, parent, remove, replace, unfold } from "./model";
import { directionalCandidates, focus, focusCycle, focusDirection } from "./focus";
import { canFit, resolve } from "./resolve";

const unzoom = (view: ViewState): ViewState => { const result = clone(view); delete result.zoomed; return result; };
const draft = (layout: Layout): Layout => ({ version: 1, root: unfold(clone(layout.root)) });
const axisFor = (edge: Edge) => edge === "left" || edge === "right" ? "row" : "column";
const before = (edge: Edge) => edge === "left" || edge === "top";

function beside(layout: Layout, targetId: string, edge: Edge, pane: PaneNode): void {
  let target = find(layout.root, targetId)!;
  let container = parent(layout.root, targetId);
  if (container?.type === "stack") { target = container; container = parent(layout.root, target.id); }
  const axis = axisFor(edge);
  if (container && container.type === axis) {
    const index = container.children.findIndex(c => c.id === target.id);
    container.children.splice(index + (before(edge) ? 0 : 1), 0, pane);
    balance(container);
  } else {
    const original = { ...target, size: target.userSized ? target.size : { weight: 1 } };
    const split: SplitNode = { id: newId(layout.root, "split"), type: axis, size: target.size, userSized: target.userSized, children: before(edge) ? [pane, original] : [original, pane] };
    layout.root = replace(layout.root, target.id, split);
    balance(split);
  }
}
function tab(layout: Layout, targetId: string, pane: PaneNode, origin: "auto" | "user", axis: "row" | "column" = "row", active = pane.id): void {
  const target = find(layout.root, targetId)!;
  const container = parent(layout.root, targetId);
  if (container?.type === "stack") {
    container.children.push(pane);
    container.active = active;
    if (origin === "user") container.origin = "user";
  } else if (target.type === "pane") {
    layout.root = replace(layout.root, target.id, { id: newId(layout.root, "stack"), type: "stack", size: target.size, userSized: target.userSized, children: [target, pane], active, origin, ...(origin === "auto" ? { axis } : {}) });
  }
}
function cleanLinks(layout: Layout): void {
  const ids = new Set(panes(layout.root).map(p => p.id));
  for (const pane of panes(layout.root)) if (pane.linkedTo && !ids.has(pane.linkedTo)) delete pane.linkedTo;
}
function nearestTabTarget(layout: Layout, source: string): string {
  if (parent(layout.root, source)?.type === "stack") return source;
  const order = panes(layout.root).map(p => p.id);
  const sourceIndex = order.indexOf(source);
  const stacks = nodes(layout.root).filter((n): n is import("./types").StackNode => n.type === "stack");
  stacks.sort((a, b) => Math.min(...a.children.map(c => Math.abs(order.indexOf(c.id) - sourceIndex))) - Math.min(...b.children.map(c => Math.abs(order.indexOf(c.id) - sourceIndex))));
  return stacks[0]?.children[0]?.id ?? source;
}

export function createOps(paneCap: number, remember: (layout: Layout, fit: FitOptions) => void, lastFit: (layout: Layout) => FitOptions | undefined): LayoutOps {
  // Imported panes are oldest in reading order; subsequently created panes get monotonic birth order.
  const births = new Map<string, number>();
  const defaults = new Map<string, Size>();
  let clock = 0;
  const observe = (layout: Layout) => { for (const pane of panes(layout.root)) if (!births.has(pane.id)) births.set(pane.id, ++clock); };
  function open(layout: Layout, view: ViewState, target: string, edge: Edge, ref: ObjectRef, fit: FitOptions, linked: boolean): OpenResult {
    const original = find(layout.root, target);
    if (original?.type !== "pane") throw new Error(`Unknown source pane: ${target}`);
    if (!fit.kinds[ref.kind]) throw new Error(`Unknown pane kind: ${ref.kind}`);
    observe(layout);
    if (linked) {
      const existing = panes(layout.root).find(p => p.linkedTo === target && p.ref.kind === ref.kind && !p.pinned);
      if (existing) {
        const next = clone(layout);
        (find(next.root, existing.id) as PaneNode).ref = clone(ref);
        activate(next, target);
        remember(next, fit);
        return { layout: next, view: focus(view, target), opened: existing.id, mode: "replaced" };
      }
    }
    const next = draft(layout);
    const pane: PaneNode = { id: newId(layout.root), type: "pane", size: { weight: 1 }, ref: clone(ref), ...(linked ? { linkedTo: target } : {}) };
    births.set(pane.id, ++clock);
    beside(next, target, edge, pane);
    let mode: OpenResult["mode"] = "beside";
    const nextView = linked ? focus(unzoom(view), target) : focus(unzoom(view), pane.id);
    // The cap limits live slots, not retained pane objects. Fold the oldest eligible slot.
    const liveSlots = (n: LayoutNode): number => isSplit(n) ? n.children.reduce((sum, c) => sum + liveSlots(c), 0) : 1;
    if (liveSlots(next.root) > paneCap) {
      const victim = panes(next.root).filter(p => p.id !== pane.id && p.id !== target && p.id !== view.focused && !p.pinned && parent(next.root, p.id)?.type !== "stack")
        .sort((a, b) => births.get(a.id)! - births.get(b.id)!)[0];
      if (victim) {
        const owner = parent(next.root, victim.id);
        const siblings = owner && isSplit(owner) ? owner.children : [];
        const index = siblings.findIndex(c => c.id === victim.id);
        const neighbour = siblings[index > 0 ? index - 1 : index + 1];
        const targetPane = neighbour ? panes(neighbour)[0] : undefined;
        if (targetPane) {
          const detached = clone(victim);
          next.root = remove(next.root, victim.id)!;
          tab(next, targetPane.id, detached, "auto", owner?.type === "column" ? "column" : "row", targetPane.id);
          const group = parent(next.root, victim.id);
          if (group?.type === "stack" && index < siblings.findIndex(c => c.id === neighbour?.id)) {
            group.children = [detached, ...group.children.filter(c => c.id !== detached.id)];
          }
        }
      } else {
        next.root = remove(next.root, pane.id)!;
        tab(next, target, pane, "auto", axisFor(edge), nextView.focused);
        mode = "tab";
      }
    }
    if (!canFit(next, fit, false)) {
      // Leave already-open panes in place; use the nearest stack or the source's tab group.
      next.root = remove(next.root, pane.id)!;
      const tabTarget = nearestTabTarget(next, target);
      const group = parent(next.root, tabTarget);
      const active = tabTarget === target || group?.children.some(c => c.id === target) ? nextView.focused : pane.id;
      tab(next, tabTarget, pane, "auto", axisFor(edge), active);
      const addedGroup = parent(next.root, pane.id);
      if (before(edge) && addedGroup?.type === "stack" && addedGroup.origin === "auto") addedGroup.children = [pane, ...addedGroup.children.filter(c => c.id !== pane.id)];
      mode = "tab";
    }
    activate(next, nextView.focused!);
    remember(next, fit);
    return { layout: next, view: nextView, opened: pane.id, mode };
  }
  function close(layout: Layout, view: ViewState, target: string) {
    const undo = { label: "Pane closed", before: { layout: clone(layout), view: clone(view) } };
    const original = panes(layout.root);
    const victim = original.find(p => p.id === target);
    if (!victim || original.length === 1) return { layout: clone(layout), view: unzoom(view), undo };
    const next = clone(layout);
    const container = parent(next.root, target);
    const index = container?.children.findIndex(c => c.id === target) ?? -1;
    if (container && isSplit(container)) {
      const opener = container.children.find(c => c.id === victim.linkedTo);
      const recipient = opener ?? container.children[index + 1] ?? container.children[index - 1];
      if (recipient) {
        const fit = lastFit(layout);
        const victimFixed = "px" in victim.size;
        const mixed = victimFixed !== ("px" in recipient.size);
        if (mixed && fit) {
          const boxes = resolve(layout, { focusHistory: [] }, fit).panes;
          const extent = (n: LayoutNode) => {
            const rects = boxes.filter(p => panes(n).some(child => child.id === p.id)).map(p => p.rect);
            const start = Math.min(...rects.map(r => container.type === "row" ? r.x : r.y));
            const end = Math.max(...rects.map(r => container.type === "row" ? r.x + r.width : r.y + r.height));
            return end - start;
          };
          recipient.size = { px: extent(recipient) + extent(victim) + fit.gap };
        } else recipient.size = combined(recipient.size, victim.size);
        // Preserve transferred space during autobalance; balance the other undragged siblings.
        for (const sibling of container.children) if (sibling !== recipient && sibling.id !== target && !sibling.userSized) sibling.size = { weight: 1 };
      }
    }
    next.root = remove(next.root, target)!;
    cleanLinks(next);
    const remaining = panes(next.root);
    const ids = new Set(remaining.map(p => p.id));
    const nextView = unzoom(view);
    nextView.focusHistory = nextView.focusHistory.filter(id => ids.has(id));
    if (view.focused === target || !view.focused || !ids.has(view.focused)) {
      const fallback = nextView.focusHistory[0] ?? original.slice(original.findIndex(p => p.id === target) + 1).find(p => ids.has(p.id))?.id ?? remaining.at(-1)!.id;
      Object.assign(nextView, focus(nextView, fallback));
    }
    activate(next, nextView.focused!);
    const fit = lastFit(layout); if (fit) remember(next, fit);
    return { layout: next, view: nextView, undo };
  }
  function swap(layout: Layout, a: string, b: string): Layout {
    const next = clone(layout);
    const left = find(next.root, a), right = find(next.root, b);
    if (a === b || left?.type !== "pane" || right?.type !== "pane") return next;
    const leftContent = { ...left, size: right.size, userSized: right.userSized };
    const rightContent = { ...right, size: left.size, userSized: left.userSized };
    // Simultaneous replacement also works when the panes are in the same stack.
    for (const node of nodes(next.root)) if (node.type !== "pane") {
      if (node.type === "stack") {
        node.children = node.children.map(c => c.id === a ? rightContent : c.id === b ? leftContent : c);
        if (node.active === a) node.active = b; else if (node.active === b) node.active = a;
      } else node.children = node.children.map(c => c.id === a ? rightContent : c.id === b ? leftContent : c);
    }
    return next;
  }
  function drop(layout: Layout, view: ViewState, dragged: string, target: string, zone: Edge | "centre", centreMode: "swap" | "tab") {
    const nextView = unzoom(view);
    if (dragged === target || find(layout.root, dragged)?.type !== "pane" || find(layout.root, target)?.type !== "pane") return { layout: clone(layout), view: nextView };
    if (zone === "centre" && centreMode === "swap") {
      const next = swap(layout, dragged, target);
      activate(next, dragged);
      return { layout: next, view: focus(nextView, dragged) };
    }
    const next = clone(layout);
    const pane = clone(find(next.root, dragged) as PaneNode);
    next.root = remove(next.root, dragged)!;
    if (zone === "centre") tab(next, target, pane, "user");
    else beside(next, target, zone, pane);
    activate(next, dragged);
    return { layout: next, view: focus(nextView, dragged) };
  }
  return {
    openBeside: (layout, view, source, ref, fit) => open(layout, view, source, "right", ref, fit, true),
    split: (layout, view, target, edge, ref, fit) => open(layout, view, target, edge, ref, fit, false),
    close,
    closeOthers(layout, view, keep) {
      const pane = find(layout.root, keep);
      const undo = { label: "Pane closed", before: { layout: clone(layout), view: clone(view) } };
      if (pane?.type !== "pane") return { layout: clone(layout), view: unzoom(view), undo };
      const root = clone(pane); delete root.linkedTo;
      root.size = { weight: 1 }; delete root.userSized;
      return { layout: { version: 1, root }, view: focus({ ...unzoom(view), focusHistory: [] }, keep), undo };
    },
    drop, swap,
    moveDirection(layout, view, pane, dir, fit) {
      const nextView = unzoom(view);
      const resolved = resolve(layout, { ...nextView, focused: pane }, fit, paneCap);
      const target = directionalCandidates({ ...nextView, focused: pane }, resolved, dir)[0];
      return target ? drop(layout, nextView, pane, target.id, dir, "swap") : { layout: clone(layout), view: nextView };
    },
    resizeDivider(layout, parentId, index, deltaPx, fit) {
      const next = draft(layout);
      const owner = find(next.root, parentId);
      if (!owner || !isSplit(owner) || !Number.isFinite(deltaPx)) return next;
      const divider = resolve(next, { focusHistory: [] }, fit, paneCap).dividers.find(d => d.parentId === parentId && d.index === index);
      if (!divider) return next;
      const [leftIds, rightIds] = divider.neighbours!;
      const first = owner.children.filter(c => panes(c).some(p => leftIds.includes(p.id)));
      const second = owner.children.filter(c => panes(c).some(p => rightIds.includes(p.id)));
      if (!first.length || !second.length) return next;
      const resolved = resolve(next, { focusHistory: [] }, fit, paneCap);
      const rects = resolved.panes.filter(p => rightIds.includes(p.id)).map(p => p.rect);
      if (!rects.length) return next;
      const secondExtent = owner.type === "row" ? Math.max(...rects.map(r => r.x + r.width)) - Math.min(...rects.map(r => r.x)) : Math.max(...rects.map(r => r.y + r.height)) - Math.min(...rects.map(r => r.y));
      const total = divider.value + secondExtent;
      const value = Math.max(divider.min, Math.min(divider.max, divider.value + deltaPx));
      const assign = (group: LayoutNode[], pixels: number) => {
        const preferences = group.map(c => "px" in c.size ? c.size.px : c.size.weight);
        const sum = preferences.reduce((a, b) => a + b, 0);
        group.forEach((node, i) => {
          if (!node.userSized && !defaults.has(node.id)) defaults.set(node.id, clone(node.size));
          node.size = { px: pixels * preferences[i]! / sum }; node.userSized = true;
        });
      };
      assign(first, value); assign(second, total - value);
      remember(next, fit);
      return next;
    },
    resetDivider(layout, parentId, index) {
      const next = clone(layout), owner = find(next.root, parentId);
      const fit = lastFit(layout);
      const divider = fit ? resolve(layout, { focusHistory: [] }, fit, paneCap).dividers.find(d => d.parentId === parentId && d.index === index) : undefined;
      const ids = divider?.neighbours?.flat();
      if (owner && isSplit(owner)) {
        const children = ids ? owner.children.filter(c => panes(c).some(p => ids.includes(p.id))) : index >= 0 ? owner.children.slice(index, index + 2) : [];
        for (const child of children) { child.size = clone(defaults.get(child.id) ?? { weight: 1 }); delete child.userSized; }
      }
      return next;
    },
    setCollapsed(layout, pane, collapsed) {
      const next = clone(layout), node = find(next.root, pane);
      if (node?.type === "pane") node.collapsed = collapsed;
      return next;
    },
    toggleZoom(view, pane) { const next = clone(view); if (next.zoomed === pane) delete next.zoomed; else next.zoomed = pane; return next; },
    focus, focusDirection, focusCycle,
    setActiveTab(layout, stack, pane) {
      const next = clone(layout), group = find(next.root, stack);
      if (group?.type === "stack" && group.children.some(c => c.id === pane)) group.active = pane;
      return next;
    },
    resetLayout(preset) {
      for (const node of nodes(preset.root)) defaults.set(node.id, clone(node.size));
      return clone(preset);
    },
  };
}
