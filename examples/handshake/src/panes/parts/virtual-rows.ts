/**
 * Drawing only the rows in view, for a list too long to draw whole (a capture runs to thousands of packets). The
 * list measures its scroller, draws what is in view plus a margin, keeps the cursor's row in view as it moves, and
 * folds each row into two lines when the list is narrow.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface RowSizes {
  /** Row heights in px, one line when wide and two when narrow. They must match the list's CSS. */
  wide: number;
  narrow: number;
  /** Below this width the rows fold into two lines. */
  narrowBelow: number;
  /** Rows drawn above and below the view, so a fast scroll doesn't show blanks. */
  overscan: number;
}

/** `count` rows, the cursor on row `at` (-1 for none). */
export function useVirtualRows(count: number, at: number, sizes: RowSizes) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 400, width: 800 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setView({ top: el.scrollTop, height: el.clientHeight, width: el.clientWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);
  const narrow = view.width < sizes.narrowBelow;
  const rowHeight = narrow ? sizes.narrow : sizes.wide;

  useEffect(() => {
    const el = ref.current;
    if (!el || at < 0) return;
    const top = at * rowHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowHeight > el.scrollTop + el.clientHeight)
      el.scrollTop = top + rowHeight - el.clientHeight;
  }, [at, rowHeight]);

  return {
    ref,
    narrow,
    rowHeight,
    start: Math.max(0, Math.floor(view.top / rowHeight) - sizes.overscan),
    end: Math.min(count, Math.ceil((view.top + view.height) / rowHeight) + sizes.overscan),
    /** How many rows Page Up and Down move: a screenful, less one for context. */
    page: Math.max(1, Math.floor(view.height / rowHeight) - 1),
  };
}
