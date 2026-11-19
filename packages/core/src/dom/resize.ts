/**
 * Calls `onResize` when the element's size changes, and returns the stop. Where there is no `ResizeObserver` (jsdom,
 * some test runners, older webviews) it falls back to the window's `resize` event, which catches the window changing
 * but not the element alone.
 */
export function observeResize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => onResize());
    ro.observe(el);
    return () => ro.disconnect();
  }
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
