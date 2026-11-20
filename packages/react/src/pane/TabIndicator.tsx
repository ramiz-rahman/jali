import type { NodeId } from "@jali/core";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cssString, observeResize } from "@jali/core/adapter";

/**
 * The strip's one underline, under the shown tab: a single element, so it runs unbroken under the tab and its close
 * button. Measured in its part of the strip (the pinned tabs, or the scrolling ones), so it scrolls with the tab, and
 * measured again whenever the part or any tab in it changes size (a rename or a mark moves the shown tab), or its tabs
 * change. The observers are set up once per shown tab, not on every render.
 */
export function TabIndicator({ active, hidden }: { active: NodeId; hidden: boolean }) {
  const [box, setBox] = useState<CSSProperties | null>(null);
  const line = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    // Its own parent is the part it measures in: a ref of the parent is not attached yet when this first runs.
    const el = line.current?.parentElement;
    if (!el || hidden) return setBox(null);
    const measure = () => {
      const tab = el.querySelector<HTMLElement>(`[role="tab"][data-tab=${cssString(active)}]`);
      if (!tab) return setBox(null);
      const rects = [tab.getBoundingClientRect()];
      const close = tab.parentElement?.querySelector<HTMLElement>(".jali-tab-close");
      if (close && close.offsetParent !== null) rects.push(close.getBoundingClientRect());
      const c = el.getBoundingClientRect();
      const left = Math.min(...rects.map((r) => r.left)),
        right = Math.max(...rects.map((r) => r.right)),
        bottom = Math.max(...rects.map((r) => r.bottom));
      const height = line.current?.offsetHeight || 2;
      const next = {
        left: left - c.left + el.scrollLeft,
        width: right - left,
        top: bottom - c.top + el.scrollTop - height,
      };
      setBox((p) =>
        p && p.left === next.left && p.width === next.width && p.top === next.top ? p : next,
      );
    };
    measure();
    // The part and every tab in it, each observed once, and the tabs again as they come and go.
    const observed = new Map<Element, () => void>();
    const watch = () => {
      const now = new Set([el, ...el.querySelectorAll(".jali-tab-item > *")]);
      for (const [t, off] of observed)
        if (!now.has(t)) {
          off();
          observed.delete(t);
        }
      for (const t of now) if (!observed.has(t)) observed.set(t, observeResize(t, measure));
    };
    watch();
    // A tab added, closed or moved shifts the shown one without resizing anything.
    const tabsChanged =
      typeof MutationObserver === "undefined"
        ? undefined
        : new MutationObserver(() => {
            watch();
            measure();
          });
    tabsChanged?.observe(el, { childList: true, subtree: true });
    return () => {
      tabsChanged?.disconnect();
      observed.forEach((off) => off());
    };
  }, [active, hidden]);
  return (
    <span
      ref={line}
      className="jali-tab-indicator"
      aria-hidden
      style={box ?? { display: "none" }}
    />
  );
}
