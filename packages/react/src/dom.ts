/**
 * @jali/react's markup, as @jali/core needs to find it (core's `DomPort`). Every class and data attribute the core
 * once queried by name is here, beside the components that render them; `StoreProvider` gives it to the instance.
 */
import { cssString, type DividerLine, type DomPort } from "@jali/core/adapter";

const FLASH_MS = 600;

/** The class of a strip's scrolling element (workspace/Scroller.tsx); a pane in a strip finds it with `closest`. */
export const STRIP_VIEWPORT = "jali-strip-viewport";

/** The drag line a divider layer draws (DividerLayer), for the divider being dragged in it. */
function line(divider: HTMLElement): DividerLine | null {
  const el = divider
    .closest(".jali-divider-layer")
    ?.querySelector<HTMLElement>(":scope > .jali-divider-visual");
  if (!el) return null;
  const tick = el.querySelector<HTMLElement>(".jali-divider-tick");
  const place = (r: { x: number; y: number; width: number; height: number }) => {
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
  };
  return {
    show(axis, rect) {
      el.className = `jali-divider-visual jali-divider-${axis}`;
      place(rect);
      el.hidden = false;
    },
    place,
    snap(on) {
      if (tick) tick.hidden = !on;
      el.classList.toggle("is-snapped", on);
    },
    hide() {
      el.hidden = true;
    },
  };
}

export const reactDom: DomPort = {
  panes: (root, from) =>
    from?.closest<HTMLElement>(".jali-layout") ?? root.querySelector<HTMLElement>(".jali-layout"),
  tabAt(x, y) {
    // The tab's own box, or its close button beside it: both sit in the tab's item.
    const el = document
      .elementFromPoint?.(x, y)
      ?.closest(".jali-tab-item")
      ?.querySelector<HTMLElement>("[data-tab]");
    const pane = el?.dataset.tab;
    return el && pane ? { el, pane } : undefined;
  },
  tab: (root, pane) => root.querySelector<HTMLElement>(`[role="tab"][data-tab=${cssString(pane)}]`),
  tabOf: (el) => el.closest<HTMLElement>("[data-tab]")?.dataset.tab,
  inPane: (el) => !!el.closest("[data-pane]"),
  inDivider: (el) => !!el.closest(".jali-divider"),
  dividers: (root) =>
    [...root.querySelectorAll<HTMLElement>(".jali-divider-layer [data-divider]")].map(
      (el) => [el.dataset.divider!, el] as const,
    ),
  strips: (root) =>
    [...root.querySelectorAll<HTMLElement>(".jali-strip[data-strip]")].map(
      (el) =>
        [
          el.dataset.strip!,
          el,
          el.querySelector<HTMLElement>(`:scope > .${STRIP_VIEWPORT} > .jali-strip-content`),
        ] as const,
    ),
  stripScroller: (pane) => pane.closest<HTMLElement>(`.${STRIP_VIEWPORT}`),
  hold(frame) {
    const content = frame.querySelector<HTMLElement>(":scope > .jali-pane-content");
    const inner = content?.querySelector<HTMLElement>(":scope > .jali-pane-content-inner");
    if (!content || !inner || content.hidden) return null;
    const r = content.getBoundingClientRect();
    inner.style.width = `${r.width}px`;
    inner.style.height = `${r.height}px`;
    content.dataset.holding = "";
    return () => {
      inner.style.width = "";
      inner.style.height = "";
      delete content.dataset.holding;
    };
  },
  dividerLine: line,
  shelf: (root) => root.querySelector<HTMLElement>("[data-shelf]"),
  shelfChip: (shelf) =>
    shelf.querySelector<HTMLElement>('.jali-shelf-chip-main[tabindex="0"]') ??
    shelf.querySelector<HTMLElement>(".jali-shelf-chip-main"),
  dragging(what, divider) {
    const body = document.body.classList;
    body.toggle("jali-pane-dragging", what === "pane");
    body.toggle("jali-resizing", what === "row" || what === "column");
    body.toggle("jali-resizing-row", what === "row");
    body.toggle("jali-resizing-column", what === "column");
    divider?.classList.toggle("is-dragging", !!what);
  },
  flash(el) {
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), FLASH_MS);
  },
};
