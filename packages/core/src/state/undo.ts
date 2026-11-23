/**
 * Undo (⌘K ⌘Z, the Undo toast): closes and tucks, most recent last. Each entry reverses its operation in the layout as
 * it is now, so later changes survive: a close entry puts its panes back (layout/ops/restore.ts), a tuck entry puts the
 * pane back.
 */
import type { Layout, NodeId, PaneNode, UndoEntry } from "../layout/types";

export const UNDO_MAX = 20;

export const pushUndo = (stack: UndoEntry[], entry: UndoEntry) =>
  [...stack, entry].slice(-UNDO_MAX);

/** Every closed pane the stack could bring back. */
export const closedPanes = (stack: readonly UndoEntry[]): PaneNode[] =>
  stack.flatMap((e) => (e.kind === "tuck" ? [] : e.closed.map((c) => c.pane)));

/** Tuck entries whose pane is no longer tucked are stale. */
export function pruneUndo(stack: UndoEntry[], layout: Layout): UndoEntry[] {
  const tucked = (e: UndoEntry) =>
    e.kind !== "tuck" || !!layout.overlay?.tucks.some((t) => t.pane === e.tucked);
  return stack.every(tucked) ? stack : stack.filter(tucked);
}

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
