/**
 * Everything the live parts need from Jali that its public API doesn't give yet, in one place. Each piece is a gap
 * recorded in ../FINDINGS.md; when Jali covers one, its piece here is deleted and its callers use Jali's instead.
 */
import {
  GAP,
  layout as jl,
  tabDropAt,
  zoneFor,
  type DndState,
  type JaliStore,
  type Layout,
} from "jali/adapter";

// Gap 1: the tree's side panels read the live workspace beside its root, so they use the root's own provider, which
// jali/react keeps internal (the docs site lives in this repo).
export { JaliProvider } from "../../../../../packages/react/src/JaliRoot";

/**
 * Gap 2: back to `layout`, fitted to the workspace's room, with nothing left over from before: no selection, undo,
 * drag, resize, palette or chooser. Jali has no reset, so this writes those parts of its state itself.
 */
export function resetTo(store: JaliStore, layout: Layout) {
  const view = { focusHistory: [] };
  store.set({
    layout: jl.refit(layout, view, store.ctx()),
    view,
    selection: {},
    undoStack: [],
    dnd: null,
    paneState: {},
    resizeMode: null,
    paletteOpen: false,
    chooser: null,
  });
}

/**
 * Gap 3: what a person's drag shows with the pointer at (x, y), so the tour can show one. The same rule as Jali's own
 * drag (workspace/dnd.ts), which it keeps internal: over its own strip a tab reorders; over a pane, its edges place
 * beside and its middle adds a tab; its own group's middle does nothing.
 */
export function dragAt(
  store: JaliStore,
  pane: string,
  ws: HTMLElement,
  x: number,
  y: number,
): DndState {
  const box = ws.querySelector(".jali-layout")?.getBoundingClientRect();
  const p = { x: x - (box?.left ?? 0) - GAP, y: y - (box?.top ?? 0) - GAP };
  const tabAt = tabDropAt(store, pane, x, y);
  if (tabAt) return { dragged: pane, ...p, tabAt };
  const boxes = store.model().resolved.panes;
  const hit = boxes.find(
    (b) =>
      !b.hidden &&
      b.id !== pane &&
      p.x >= b.rect.x &&
      p.x <= b.rect.x + b.rect.width &&
      p.y >= b.rect.y &&
      p.y <= b.rect.y + b.rect.height,
  );
  let zone = hit ? zoneFor(hit.rect, p.x, p.y) : undefined;
  const own = boxes.find((b) => b.id === pane)?.stackId;
  if (hit?.stackId && hit.stackId === own && zone === "centre") zone = undefined;
  return { dragged: pane, ...p, ...(hit && zone ? { target: hit.id, zone } : {}) };
}

/**
 * Gap 4: the layer Jali puts its menus and dialogs in, beside the root of the workspace `el` is in: over the panes and
 * in the workspace's theme. Jali reaches it as `store.dom.layer()`, which isn't public.
 */
export const layerOf = (el: Element) =>
  el.closest("[data-jali]")?.parentElement?.querySelector(":scope > [data-jali-layer]") ?? null;

/** Gap 5: Jali's menu, which it keeps internal: its class names, so a menu of the app's own looks like Jali's. */
export const MENU_CLASS = {
  menu: "jali-tab-menu",
  item: "jali-tab-menu-item",
  title: "jali-tab-menu-title",
  keys: "jali-menu-keys",
  separator: "jali-menu-sep",
} as const;

/**
 * Gap 6: a pane's rect while a divider is dragged. Jali moves the panes on the DOM each frame and commits once on
 * release, so its model doesn't change meanwhile; this reads the rects back from the panes' inline styles.
 */
export function dividerDragRects(ws: HTMLElement) {
  if (!ws.querySelector(".jali-divider.is-dragging")) return null;
  const rects: Record<string, { x: number; y: number; width: number; height: number }> = {};
  ws.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => {
    if (p.style.display === "none") return;
    rects[p.dataset.pane!] = {
      x: parseFloat(p.style.left),
      y: parseFloat(p.style.top),
      width: parseFloat(p.style.width),
      height: parseFloat(p.style.height),
    };
  });
  return rects;
}
