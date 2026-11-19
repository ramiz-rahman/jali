/**
 * Scrolling a row that scrolls sideways while something is dragged near its edge, so a drag can reach a pane out of
 * view, for an app's own drag (Trips drags a day's stop to another day); Jali's pane drag doesn't use it yet. Hold the pointer
 * within `EDGE` px of a strip's left or right edge and it scrolls that way, faster the closer the pointer is.
 *
 *   const edge = edgeScroll(jali, () => updateDropTarget());
 *   // on every pointermove: edge.move(e.clientX, e.clientY);  on drop or cancel: edge.stop();
 */
import type { Jali } from "../state/instance";
import { clampOffset, maxOffset } from "../layout/geometry/scroll";
import { storeOf } from "../state/instance";

/** How near a strip's edge, in px, the pointer starts it scrolling. */
export const EDGE = 56;
/** The most it scrolls in a frame, at the very edge. */
const SPEED = 22;

export interface EdgeScroll {
  /** The pointer is here now (client coordinates). */
  move(clientX: number, clientY: number): void;
  /** The drag ended: stop scrolling. */
  stop(): void;
}

export function edgeScroll(jali: Jali, onScroll?: () => void): EdgeScroll {
  const store = storeOf(jali);
  let at: { x: number; y: number } | null = null;
  let frame = 0;

  /** Where the panes' box sits on the page: a shown pane's place there, less its place in the layout. */
  const origin = () => {
    const m = jali.model();
    for (const box of m.resolved.panes) {
      if (box.hidden || m.outOfView.has(box.id)) continue;
      const el = store.dom.pane(box.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      return { x: r.left - box.rect.x, y: r.top - box.rect.y };
    }
    return null;
  };

  const step = () => {
    frame = 0;
    if (!at) return;
    const o = origin();
    if (!o) return;
    const x = at.x - o.x,
      y = at.y - o.y;
    const rtl = store.get().dir === "rtl";
    for (const s of [...jali.model().resolved.scrollers].reverse()) {
      const { rect } = s;
      if (
        y < rect.y ||
        y > rect.y + rect.height ||
        x < rect.x - EDGE ||
        x > rect.x + rect.width + EDGE
      )
        continue;
      const fromLeft = x - rect.x,
        fromRight = rect.x + rect.width - x;
      const pull =
        fromLeft < EDGE
          ? -(EDGE - fromLeft) / EDGE
          : fromRight < EDGE
            ? (EDGE - fromRight) / EDGE
            : 0;
      if (!pull || maxOffset(s) <= 0) return;
      const view = store.get().view;
      const now = view.scroll?.[s.id] ?? 0;
      const next = clampOffset(s, now + Math.max(-1, Math.min(1, pull)) * SPEED * (rtl ? -1 : 1));
      if (Math.abs(next - now) < 0.5) return;
      store.set({ view: { ...view, scroll: { ...view.scroll, [s.id]: next } } });
      onScroll?.();
      frame = requestAnimationFrame(step);
      return;
    }
  };

  return {
    move(clientX, clientY) {
      at = { x: clientX, y: clientY };
      if (!frame) frame = requestAnimationFrame(step);
    },
    stop() {
      at = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
