/**
 * Header-grip drag and drop: starts after 4px; the outer 25% of the target places beside on that edge; the centre
 * swaps or adds a tab (Settings). Esc or a drop outside a pane cancels. Zoomed and single-pane layouts don't drag.
 * The drag lives in this closure and in `dnd` state; there is no module state.
 */
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Edge, Rect } from "../../layout-core/types";
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

export function startPaneDrag(store: UiStore, e: ReactPointerEvent, paneId: string) {
  if (e.button !== 0) return;
  const t = e.target as HTMLElement;
  if (t.closest("button, input, textarea, select, a, [data-no-drag]") && !t.closest("[data-drag-ok]")) return;
  const workspace = (e.currentTarget as HTMLElement).closest<HTMLElement>(".workspace");
  const sx = e.clientX, sy = e.clientY;
  let started = false;

  const local = (cx: number, cy: number) => {
    const b = workspace?.getBoundingClientRect();
    return { x: cx - (b?.left ?? 0) - GAP, y: cy - (b?.top ?? 0) - GAP };
  };

  const move = (ev: PointerEvent) => {
    const m = store.model();
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      if (store.get().view.zoomed || m.panes.length < 2) return cleanup();
      started = true;
      document.body.classList.add("is-pane-dragging");
    }
    const p = local(ev.clientX, ev.clientY);
    const boxes = m.resolved.panes;
    const hit = boxes.find((b) => !b.hidden && p.x >= b.rect.x && p.x <= b.rect.x + b.rect.width && p.y >= b.rect.y && p.y <= b.rect.y + b.rect.height);
    const target = hit && hit.id !== paneId ? hit : undefined;
    let zone: Edge | "centre" | undefined = target ? zoneFor(target.rect, p.x, p.y) : undefined;
    // Own group's visible pane: edges split a tab out, the centre does nothing.
    if (target?.stackId && boxes.some((b) => b.id === paneId && b.stackId === target.stackId) && zone === "centre") zone = undefined;
    store.set({ dnd: { dragged: paneId, x: p.x, y: p.y, ...(target && zone ? { target: target.id, zone } : {}) } });
  };
  const up = () => {
    const d = store.get().dnd;
    cleanup();
    if (started && d?.target && d.zone) store.actions.drop(d.dragged, d.target, d.zone);
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !started) return;
    ev.preventDefault();
    ev.stopPropagation();
    cleanup();
  };
  function cleanup() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key, true);
    document.body.classList.remove("is-pane-dragging");
    if (store.get().dnd) store.set({ dnd: null });
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key, true);
}
