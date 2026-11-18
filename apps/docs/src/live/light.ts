/** Lighting panes from outside the workspace: attributes on Jali's own elements, styled in live.css. */
import { useLayoutEffect, type RefObject } from "react";

const ATTRS = ["data-live-lit", "data-live-dim"] as const;

/**
 * Marks the panes `ids` as lit (their tab and shelf chip too, when they are behind one), and with `dim` the other
 * panes as dimmed. Runs after every render it is given `stamp` for, since Jali may re-create a tab or chip.
 */
export function useLitPanes(
  wrap: RefObject<HTMLElement | null>,
  ids: string[] | null,
  dim: boolean,
  stamp: unknown,
) {
  useLayoutEffect(() => {
    const root = wrap.current;
    if (!root) return;
    const set = new Set(ids ?? []);
    for (const a of ATTRS) root.querySelectorAll(`[${a}]`).forEach((el) => el.removeAttribute(a));
    if (!ids) return;
    root.querySelectorAll<HTMLElement>("[data-pane]").forEach((el) => {
      const id = el.dataset.pane!;
      if (set.has(id)) el.setAttribute("data-live-lit", "");
      else if (dim) el.setAttribute("data-live-dim", "");
    });
    root.querySelectorAll<HTMLElement>("[data-tab], [data-chip]").forEach((el) => {
      if (set.has(el.dataset.tab ?? el.dataset.chip ?? "")) el.setAttribute("data-live-lit", "");
    });
  }, [wrap, ids?.join(), dim, stamp]);
}

/** Gives each pane, tab and shelf chip in the workspace its identity colour (`--live-id`), the same as its map box. */
export function usePaneColours(
  wrap: RefObject<HTMLElement | null>,
  colourOf: (id: string) => string,
  stamp: unknown,
) {
  useLayoutEffect(() => {
    const root = wrap.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-pane], [data-tab], [data-chip]").forEach((el) => {
      const id = el.dataset.pane ?? el.dataset.tab ?? el.dataset.chip;
      if (!id) return;
      el.style.setProperty("--live-id", colourOf(id));
      el.setAttribute("data-live-id", "");
    });
  });
  void stamp;
}
