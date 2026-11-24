/**
 * While a divider is dragged, the panes' rects as they move, so the map's shares move with the pointer (Jali commits
 * the sizes only on release). Null when no divider is being dragged.
 */
import { useEffect, useState, type RefObject } from "react";
import type { Rect } from "jali";
import { dividerDragRects } from "../workspace/jali-gaps";

export function useDragPreview(wrap: RefObject<HTMLElement | null>): Record<string, Rect> | null {
  const [rects, setRects] = useState<Record<string, Rect> | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      const next = dividerDragRects(el);
      setRects((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      raf = next ? requestAnimationFrame(read) : 0;
    };
    const onDown = (e: Event) => {
      if (!(e.target as Element).closest?.(".jali-divider")) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };
    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      cancelAnimationFrame(raf);
    };
  }, [wrap]);
  return rects;
}
