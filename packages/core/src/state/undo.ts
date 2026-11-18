/** Undo (⌘K ⌘Z, the Undo toast): closes and tucks, most recent last. A tuck entry is undone by putting the pane back, so later changes survive. */
import type { Layout, NodeId, UndoEntry } from "../layout/types";

export const UNDO_MAX = 20;

export const pushUndo = (stack: UndoEntry[], entry: UndoEntry) => [...stack, entry].slice(-UNDO_MAX);

/** Tuck entries whose pane is no longer tucked are stale. */
export function pruneUndo(stack: UndoEntry[], layout: Layout): UndoEntry[] {
  const tucked = (e: UndoEntry) => e.kind !== "tuck" || !!layout.overlay?.tucks.some((t) => t.pane === e.tucked);
  return stack.every(tucked) ? stack : stack.filter(tucked);
}

export const forgetTuck = (stack: UndoEntry[], pane: NodeId) => stack.filter((e) => e.tucked !== pane);

/** Tucked panes, most recently tucked first (from the undo stack), then any others in tuck order. */
export function tuckOrder(stack: UndoEntry[], layout: Layout): NodeId[] {
  const tucked = (layout.overlay?.tucks ?? []).map((t) => t.pane);
  const recent = stack.flatMap((e) => (e.tucked && tucked.includes(e.tucked) ? [e.tucked] : [])).reverse();
  return [...new Set([...recent, ...tucked])];
}
