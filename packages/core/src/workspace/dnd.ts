/**
 * Header-grip drag and drop (and a curated page's tabs dragged into the panes): starts after 4px; the outer 25% of the target places beside on that edge; the centre
 * swaps or adds a tab (Settings). Esc or a drop outside a pane cancels. Zoomed and single-pane layouts don't drag.
 * The drag lives in this closure and in `dnd` state; there is no module state.
 */
import type { Edge, Rect } from "../layout/types";
import type { UiStore } from "../state/store";
import { GAP } from "../tokens";

export const DRAG_THRESHOLD = 4;
export const EDGE_ZONE = 0.25;

/** Pure zone rule, exported for tests. */
export function zoneFor(r: Rect, x: number, y: number): Edge | "centre" {
  const rx = (x - r.x) / r.width, ry = (y - r.y) / r.height;
  const dists: [Edge, number][] = [["left", rx], ["right", 1 - rx], ["top", ry], ["bottom", 1 - ry]];
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
  if (t.closest("button, input, textarea, select, a, [data-no-drag]") && !t.closest("[data-drag-ok]")) return;
  startDrag(store, e, { id: paneId, onDrop: (target, zone) => store.actions.drop(paneId, target, zone) });
}

/**
 * A curated page's tab dragged into the panes: places that view where it is dropped (centre: as a tab of that group).
 * Works from Single mode too, where the one pane on screen is the target; dropping switches to Multiplexed.
 * Returns whether a drag happened, so the tab's click can be skipped.
 */
export function startTabDrag(store: UiStore, e: PointerStart, role: string, label: string): { dragged(): boolean } {
  return startDrag(store, e, { id: role, label, fromOutside: true, onDrop: (target, zone) => store.actions.placeTab(role, target, zone) });
}

interface DragOpts { id: string; label?: string; fromOutside?: boolean; onDrop(target: string, zone: Edge | "centre"): void }

function startDrag(store: UiStore, e: PointerStart, { id: paneId, label, fromOutside, onDrop }: DragOpts) {
  let started = false;
  const handle = { dragged: () => started };
  if (e.button !== 0) return handle;
  const workspace = (e.currentTarget as HTMLElement).closest<HTMLElement>(".jali-workspace") ?? store.dom.root().querySelector<HTMLElement>(".jali-workspace");
  const sx = e.clientX, sy = e.clientY;

  const local = (cx: number, cy: number) => {
    const b = workspace?.getBoundingClientRect();
    return { x: cx - (b?.left ?? 0) - GAP, y: cy - (b?.top ?? 0) - GAP };
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
    const p = local(ev.clientX, ev.clientY);
    const boxes = m.resolved.panes;
    const hit = boxes.find((b) => !b.hidden && p.x >= b.rect.x && p.x <= b.rect.x + b.rect.width && p.y >= b.rect.y && p.y <= b.rect.y + b.rect.height);
    const target = hit && hit.id !== paneId ? hit : undefined;
    let zone: Edge | "centre" | undefined = target ? zoneFor(target.rect, p.x, p.y) : undefined;
    // Own group's visible pane: edges split a tab out, the centre does nothing.
    if (target?.stackId && boxes.some((b) => b.id === paneId && b.stackId === target.stackId) && zone === "centre") zone = undefined;
    store.set({ dnd: { dragged: paneId, x: p.x, y: p.y, ...(label ? { label } : {}), ...(target && zone ? { target: target.id, zone } : {}) } });
  };
  const up = () => {
    const d = store.get().dnd;
    cleanup();
    if (started && d?.target && d.zone) onDrop(d.target, d.zone);
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
