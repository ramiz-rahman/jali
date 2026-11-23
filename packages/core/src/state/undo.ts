/**
 * Undo (⌘K ⌘Z, the Undo toast): closes and tucks, most recent last. Each entry reverses its operation in the layout as
 * it is now, so later changes survive: a close entry puts its panes back (layout/ops/restore.ts), a tuck entry puts the
 * pane back.
 */
import type { Layout, NodeId, PaneNode, UndoEntry } from "../layout/types";
import { panes } from "../layout/tree/tree";
import type { PaneKinds } from "../pane-kinds";

export const UNDO_MAX = 20;

export const pushUndo = (stack: UndoEntry[], entry: UndoEntry) =>
  [...stack, entry].slice(-UNDO_MAX);

/** Every closed pane the stack could bring back. */
export const closedPanes = (stack: readonly UndoEntry[]): PaneNode[] =>
  stack.flatMap((e) => (e.kind === "tuck" ? [] : e.closed.map((c) => c.pane)));

/** `stack` without the closed panes `drop` matches: a batch keeps its other panes, and an entry left with none goes. */
function without(stack: UndoEntry[], drop: (p: PaneNode) => boolean): UndoEntry[] {
  let changed = false;
  const next = stack.flatMap((e): UndoEntry[] => {
    if (e.kind === "tuck") return [e];
    const closed = e.closed.filter((c) => !drop(c.pane));
    if (closed.length === e.closed.length) return [e];
    changed = true;
    return closed.length ? [{ ...e, closed }] : [];
  });
  return changed ? next : stack;
}

/**
 * Entries that no longer reverse anything: a tuck whose pane is no longer tucked, and a closed pane whose object is
 * open again (an undo would show it twice). A scratch pane is its own instance, never the same object as another.
 */
export function pruneUndo(
  stack: UndoEntry[],
  layout: Layout,
  kinds?: Pick<PaneKinds, "identityOf" | "sameObject">,
): UndoEntry[] {
  const tucked = (e: UndoEntry) =>
    e.kind !== "tuck" || !!layout.overlay?.tucks.some((t) => t.pane === e.tucked);
  let next = stack.every(tucked) ? stack : stack.filter(tucked);
  if (kinds && next.some((e) => e.kind !== "tuck")) {
    const open = panes(layout.root).map((p) => p.ref);
    next = without(
      next,
      (p) => kinds.identityOf(p.ref) !== undefined && open.some((r) => kinds.sameObject(r, p.ref)),
    );
  }
  return next;
}

/** The host removed an object (`remove`): no entry brings it back, and the other panes of its batch stay. */
export const forgetObject = (stack: UndoEntry[], match: (p: PaneNode) => boolean) =>
  without(stack, match);

export const forgetTuck = (stack: UndoEntry[], pane: NodeId) =>
  stack.filter((e) => e.kind !== "tuck" || e.tucked !== pane);

/** Tucked panes, most recently tucked first (from the undo stack), then any others in tuck order. */
export function tuckOrder(stack: UndoEntry[], layout: Layout): NodeId[] {
  const tucked = (layout.overlay?.tucks ?? []).map((t) => t.pane);
  const recent = stack
    .flatMap((e) => (e.kind === "tuck" && tucked.includes(e.tucked) ? [e.tucked] : []))
    .reverse();
  return [...new Set([...recent, ...tucked])];
}
