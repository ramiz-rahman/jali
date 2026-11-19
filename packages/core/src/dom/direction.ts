/** The reading direction an element is laid out in: its computed `direction` (an ancestor's `dir="rtl"`). */
import type { Direction } from "../layout/types";

export function readDirection(el: Element | null | undefined): Direction {
  if (!el || typeof getComputedStyle === "undefined") return "ltr";
  return getComputedStyle(el).direction === "rtl" ? "rtl" : "ltr";
}

/** First guess before the workspace is on screen: the page's direction. */
export const pageDirection = (): Direction =>
  typeof document === "undefined" ? "ltr" : readDirection(document.documentElement);

/** Calls `fn` when any element's `dir` changes on the page (a language switch). Returns the stop. */
export function watchDirection(fn: () => void): () => void {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return () => {};
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dir"],
    subtree: true,
  });
  return () => mo.disconnect();
}

/** The workspace's direction: fixed by `createJali({ dir })`, else the element's. */
export const directionOf = (fixed: Direction | undefined, el: Element | null | undefined) =>
  fixed ?? readDirection(el);

/** The arrow that moves forward in reading order along a row: → left to right, ← right to left. */
export const forwardArrow = (dir: Direction) => (dir === "rtl" ? "ArrowLeft" : "ArrowRight");
/** +1 for the arrow that moves forward along a row in `dir`, -1 for the one back, 0 for any other key. */
export const inlineStep = (key: string, dir: Direction) =>
  key === forwardArrow(dir) ? 1 : key === "ArrowLeft" || key === "ArrowRight" ? -1 : 0;

/** How far a row that scrolls has scrolled from its start, and how far it can (right to left, `scrollLeft` counts
 *  down from 0). */
export function scrolledFromStart(el: Element): { pos: number; max: number; rtl: boolean } {
  const rtl = readDirection(el) === "rtl";
  return {
    pos: rtl ? -el.scrollLeft : el.scrollLeft,
    max: el.scrollWidth - el.clientWidth,
    rtl,
  };
}
