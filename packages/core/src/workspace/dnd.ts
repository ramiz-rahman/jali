/**
 * Header-grip drag and drop (and a curated page's tabs dragged into the panes): starts after 4px; the outer 25% of the target places beside on that edge; the centre
 * swaps or adds a tab (Settings). Esc or a drop outside a pane cancels. Zoomed and single-pane layouts don't drag.
 * The drag lives in this closure and in `dnd` state; there is no module state.
 */
import { allows } from "../actions/allow";
import { edgeScroll } from "./edge-scroll";
import type { Edge, Rect } from "../layout/types";
import type { DndState, UiStore } from "../state/store";

export const DRAG_THRESHOLD = 4;

/** A tab dropped between its group's tabs: next to `tab`, on its `side` in reading order, ending at `index`. */
export interface TabDrop {
  tab: string;
  side: "before" | "after";
  index: number;
}
export const EDGE_ZONE = 0.25;

/** Pure zone rule, exported for tests. */
export function zoneFor(r: Rect, x: number, y: number): Edge | "centre" {
  const rx = (x - r.x) / r.width,
    ry = (y - r.y) / r.height;
  const dists: [Edge, number][] = [
    ["left", rx],
    ["right", 1 - rx],
    ["top", ry],
    ["bottom", 1 - ry],
  ];
  const inZone = dists.filter(([, d]) => d < EDGE_ZONE).sort((a, b) => a[1] - b[1]);
  return inZone[0]?.[0] ?? "centre";
}

/** The part of a pane a drop in `zone` fills: a half, or all of it for the centre. */
export function zoneRect(r: Rect, zone: Edge | "centre"): Rect {
  if (zone === "left") return { ...r, width: r.width / 2 };
  if (zone === "right") return { ...r, x: r.x + r.width / 2, width: r.width / 2 };
  if (zone === "top") return { ...r, height: r.height / 2 };
  if (zone === "bottom") return { ...r, y: r.y + r.height / 2, height: r.height / 2 };
  return r;
}

/** The pointer-down a drag starts from: a DOM PointerEvent or any framework's wrapper of one. */
export interface PointerStart {
  button: number;
  clientX: number;
  clientY: number;
  pointerId: number;
  currentTarget: EventTarget | null;
  target: EventTarget | null;
}

export function startPaneDrag(store: UiStore, e: PointerStart, paneId: string) {
  const t = e.target as HTMLElement;
  if (
    t.closest("button, input, textarea, select, a, [data-no-drag]") &&
    !t.closest("[data-drag-ok]")
  )
    return;
  startDrag(store, e, {
    id: paneId,
    reorder: true,
    onDrop: (target, zone) => store.actions.drop(paneId, target, zone),
  });
}

/**
 * Where a tab dragged over its own strip would go: before or after the tab under the pointer (in reading order), and
 * the index it would then have. Only within a group the person or the app made; undefined anywhere else.
 */
export function tabDropAt(
  store: UiStore,
  paneId: string,
  clientX: number,
  clientY: number,
): TabDrop | undefined {
  // The tab's own box, or its close button beside it (both sit in the tab's item).
  const el = document
    .elementFromPoint?.(clientX, clientY)
    ?.closest(".jali-tab-item")
    ?.querySelector<HTMLElement>("[data-tab]");
  const over = el?.dataset.tab;
  const stack = store.model().stackOf(paneId);
  if (!el || !over || !stack) return undefined;
  const at = stack.children.findIndex((c) => c.id === over);
  if (at < 0) return undefined;
  const r = el.getBoundingClientRect();
  const rtl = getComputedStyle(el).direction === "rtl";
  const firstHalf = rtl ? clientX > r.left + r.width / 2 : clientX < r.left + r.width / 2;
  const side = firstHalf ? "before" : "after";
  const from = stack.children.findIndex((c) => c.id === paneId);
  let index = side === "before" ? at : at + 1;
  if (from < index) index--;
  return { tab: over, side, index };
}

/**
 * A curated page's tab dragged into the panes: places that view where it is dropped (centre: as a tab of that group).
 * Works from Single mode too, where the one pane on screen is the target; dropping switches to Split view.
 * Returns whether a drag happened, so the tab's click can be skipped.
 */
export function startTabDrag(
  store: UiStore,
  e: PointerStart,
  role: string,
  label: string,
): { dragged(): boolean } {
  return startDrag(store, e, {
    id: role,
    label,
    fromOutside: true,
    onDrop: (target, zone) => store.actions.placeTab(role, target, zone),
  });
}

interface DragOpts {
  id: string;
  label?: string;
  fromOutside?: boolean;
  /** A pane's own tab can be dropped between the tabs of its group, to reorder them. */
  reorder?: boolean;
  onDrop(target: string, zone: Edge | "centre"): void;
}

function startDrag(
  store: UiStore,
  e: PointerStart,
  { id: paneId, label, fromOutside, reorder, onDrop }: DragOpts,
) {
  let started = false;
  const handle = { dragged: () => started };
  if (e.button !== 0) return handle;
  // A pane the app doesn't let move never starts a drag (from outside, the dragged thing isn't a pane yet).
  if (!fromOutside && !allows(store.snapshot(), paneId, "move")) return handle;
  const workspace =
    (e.currentTarget as HTMLElement).closest<HTMLElement>(".jali-workspace") ??
    store.dom.root().querySelector<HTMLElement>(".jali-workspace");
  const sx = e.clientX,
    sy = e.clientY;

  const local = (cx: number, cy: number) => {
    const b = workspace?.getBoundingClientRect();
    const { inset } = store.env.spacing;
    return { x: cx - (b?.left ?? 0) - inset, y: cy - (b?.top ?? 0) - inset };
  };

  // Held at the edge of a row that scrolls, the drag scrolls it on, and finds what is under the pointer again as
  // the panes slide past.
  let last = { x: sx, y: sy };
  const edge = edgeScroll(store.jali, () => started && aim(last.x, last.y));
  // One `dnd` write per frame, however often the pointer reports: the latest point wins.
  let frame = 0;
  const aimLast = () => {
    frame = 0;
    aim(last.x, last.y);
  };
  const move = (ev: PointerEvent) => {
    const m = store.model();
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      if (store.get().view.zoomed || (!fromOutside && m.panes.length < 2)) return cleanup();
      started = true;
      document.body.classList.add("jali-pane-dragging");
      window.getSelection()?.removeAllRanges();
    }
    last = { x: ev.clientX, y: ev.clientY };
    if (typeof requestAnimationFrame !== "function") aimLast();
    else frame ||= requestAnimationFrame(aimLast);
    edge.move(ev.clientX, ev.clientY);
  };
  /** A pending frame's aim, now: a release or a key acts on where the pointer last was. */
  const settle = () => {
    if (!frame) return;
    cancelAnimationFrame(frame);
    aimLast();
  };
  /** What a drop at this point (client coordinates) would do, into `dnd`. */
  const aim = (cx: number, cy: number) => {
    const m = store.model();
    const p = local(cx, cy);
    // Over its own strip, a tab reorders: a line between tabs, never a split.
    const tabAt = reorder ? tabDropAt(store, paneId, cx, cy) : undefined;
    if (tabAt) {
      put({ dragged: paneId, x: p.x, y: p.y, ...(label ? { label } : {}), tabAt });
      return;
    }
    // A pane in a row that scrolls is where the page shows it: the model hears where a strip is only once it rests,
    // which lags behind a scroll that is still going.
    const boxes = m.resolved.panes.map((b) => {
      const el = b.clip && !b.hidden ? store.dom.pane(b.id) : null;
      return el ? { ...b, rect: { ...b.rect, x: local(el.getBoundingClientRect().left, 0).x } } : b;
    });
    const inside = (r: { x: number; y: number; width: number; height: number }) =>
      p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
    // And only within the strip's window: past its edge it is hidden, and the pointer is over whatever is beside it.
    const hit = boxes.find((b) => !b.hidden && inside(b.rect) && (!b.clip || inside(b.clip)));
    const target = hit && hit.id !== paneId ? hit : undefined;
    let zone: Edge | "centre" | undefined = target ? zoneFor(target.rect, p.x, p.y) : undefined;
    // Own group's visible pane: edges split a tab out, the centre does nothing.
    if (
      target?.stackId &&
      boxes.some((b) => b.id === paneId && b.stackId === target.stackId) &&
      zone === "centre"
    )
      zone = undefined;
    put({
      dragged: paneId,
      x: p.x,
      y: p.y,
      ...(label ? { label } : {}),
      ...(target && zone ? { target: target.id, zone } : {}),
    });
  };
  /** Into `dnd`, unless it says what `dnd` already says. */
  const put = (next: DndState) => {
    const d = store.get().dnd;
    const same =
      d &&
      d.dragged === next.dragged &&
      d.x === next.x &&
      d.y === next.y &&
      d.label === next.label &&
      d.target === next.target &&
      d.zone === next.zone &&
      d.tabAt?.tab === next.tabAt?.tab &&
      d.tabAt?.side === next.tabAt?.side &&
      d.tabAt?.index === next.tabAt?.index;
    if (!same) store.set({ dnd: next });
  };
  const up = () => {
    settle();
    const d = store.get().dnd;
    cleanup();
    if (started && d?.tabAt) store.actions.moveTab(paneId, d.tabAt.index);
    else if (started && d?.target && d.zone) onDrop(d.target, d.zone);
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !started) return;
    ev.preventDefault();
    ev.stopPropagation();
    cleanup();
  };
  // A grip or tab held down never starts a text selection: crossing a pane would otherwise select its text.
  const noSelect = (ev: Event) => ev.preventDefault();
  function cleanup() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    edge.stop();
    document.removeEventListener("selectstart", noSelect, true);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key, true);
    document.body.classList.remove("jali-pane-dragging");
    if (store.get().dnd) store.set({ dnd: null });
  }
  document.addEventListener("selectstart", noSelect, true);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key, true);
  return handle;
}
