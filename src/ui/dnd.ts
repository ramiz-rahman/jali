/**
 * Header-grip drag and drop: starts after 4px; outer 25% of the target places beside on that edge; the centre
 * swaps or adds a tab (Settings). Esc or a drop outside a pane cancels. Zoomed and single-pane layouts don't drag.
 */
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Edge, Rect } from "../layout-core/types";
import { actions, allPanes, getState, resolved, setState, titleOf, GAP } from "./store";

export const DRAG_THRESHOLD = 4;
export const EDGE_ZONE = 0.25;

let workspaceEl: HTMLElement | null = null;
export function setWorkspaceEl(el: HTMLElement | null) {
  workspaceEl = el;
}

/** Pure zone rule, exported for tests. */
export function zoneFor(r: Rect, x: number, y: number): Edge | "centre" {
  const rx = (x - r.x) / r.width, ry = (y - r.y) / r.height;
  const dists: [Edge, number][] = [
    ["left", rx],
    ["right", 1 - rx],
    ["top", ry],
    ["bottom", 1 - ry],
  ];
  const inZone = dists.filter(([, d]) => d < EDGE_ZONE).sort((a, b) => a[1] - b[1]);
  return inZone[0]?.[0] ?? "centre";
}

let cancelDrag: (() => void) | null = null;
export function cancelActiveDrag(): boolean {
  if (!cancelDrag) return false;
  cancelDrag();
  return true;
}

export function startPaneDrag(e: ReactPointerEvent, paneId: string) {
  if (e.button !== 0) return;
  const t = e.target as HTMLElement;
  if (t.closest("button, input, textarea, select, a, [data-no-drag]") && !t.closest("[data-drag-ok]")) return;
  const sx = e.clientX, sy = e.clientY;
  let started = false;

  const local = (cx: number, cy: number) => {
    const b = workspaceEl?.getBoundingClientRect();
    return { x: cx - (b?.left ?? 0) - GAP, y: cy - (b?.top ?? 0) - GAP };
  };

  const move = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      const s = getState();
      if (s.view.zoomed || allPanes().length < 2) return cleanup();
      started = true;
      document.body.classList.add("is-pane-dragging");
    }
    const p = local(ev.clientX, ev.clientY);
    const hit = resolved().panes.find(
      (b) => !b.hidden && p.x >= b.rect.x && p.x <= b.rect.x + b.rect.width && p.y >= b.rect.y && p.y <= b.rect.y + b.rect.height,
    );
    const target = hit && hit.id !== paneId ? hit : undefined;
    let zone: Edge | "centre" | undefined = target ? zoneFor(target.rect, p.x, p.y) : undefined;
    // Own stack's visible pane: edges split a tab out, the centre does nothing.
    if (hit && hit.id !== paneId && hit.stackId && resolved().panes.some((b) => b.id === paneId && b.stackId === hit.stackId) && zone === "centre") zone = undefined;
    setState({ dnd: { dragged: paneId, x: p.x, y: p.y, ...(target && zone ? { target: target.id, zone } : {}) } });
  };
  const up = () => {
    const d = getState().dnd;
    cleanup();
    if (started && d?.target && d.zone) actions.drop(d.dragged, d.target, d.zone);
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key === "Escape" && started) {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
    }
  };
  function cleanup() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key, true);
    document.body.classList.remove("is-pane-dragging");
    cancelDrag = null;
    if (getState().dnd) setState({ dnd: null });
  }
  cancelDrag = cleanup;
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key, true);
}

/** What releasing will do, in words and with a name for its icon. Used by the in-zone label. */
export type DropOutcome = { icon: "swap" | "tab" | Edge; text: string };
export function dropOutcome(zone: Edge | "centre", target: string): DropOutcome {
  const t = titleOf(target);
  if (zone === "centre") return getState().settings.centreDrop === "swap" ? { icon: "swap", text: `Swap with ${t}` } : { icon: "tab", text: `Add as tab to ${t}` };
  return { icon: zone, text: zone === "top" ? `Place above ${t}` : zone === "bottom" ? `Place below ${t}` : `Place ${zone} of ${t}` };
}
