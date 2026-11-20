/**
 * Scrolling a row that scrolls sideways while something is dragged near its edge, so a drag can reach a pane out of
 * view: Jali's pane drag uses it, and so can an app's own (Trips drags a day's stop to another day). Hold the pointer
 * within `EDGE` px of a strip's left or right edge and it scrolls that way, faster the closer the pointer is.
 *
 *   const edge = edgeScroll(jali, () => updateDropTarget());
 *   // on every pointermove: edge.move(e.clientX, e.clientY);  on drop or cancel: edge.stop();
 */
import type { Jali } from "../state/instance";
import { maxOffset } from "../layout/geometry/scroll";
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
  let steps = 0;

  /**
   * Where the panes' box sits on the page: a shown pane's place there, less its place in the layout. Not a pane in a
   * strip: the model hears where a strip is only once it rests, so mid-scroll its panes' places are behind.
   */
  const origin = () => {
    const m = jali.model();
    const inStrip = new Set(m.content.scrollers.flatMap((s) => s.paneIds));
    for (const box of m.resolved.panes) {
      if (box.hidden || inStrip.has(box.id)) continue;
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
      // The strip's scrolling element (Scroller in @jali/react): scrolling it is the browser's work, and the strip
      // tells the view state where it got to. Moving towards the edge the pointer is at, whichever way text runs.
      const pane = store.dom.pane(s.paneIds[0]!);
      const el = pane && store.dom.port.stripScroller(pane);
      if (!el) return;
      const before = el.scrollLeft;
      el.scrollLeft = before + Math.max(-1, Math.min(1, pull)) * SPEED;
      if (Math.abs(el.scrollLeft - before) < 0.5) return;
      // Keep the model roughly in step while the hold goes on (its drop highlight reads it), every few frames
      // rather than every one: the strip tells it exactly once it rests.
      if (++steps % 6 === 0) {
        const left = el.scrollLeft;
        store.actions.setScroll(s.id, store.get().dir === "rtl" ? maxOffset(s) - left : left);
      }
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
