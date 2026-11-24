/**
 * Marks on Jali's own elements from outside the workspace, styled in tree/map.css: each pane's identity colour, and
 * which panes are lit from the tree. Both run again when `model` changes, since Jali may re-create a pane, tab or chip.
 */
import { useLayoutEffect, type RefObject } from "react";
import type { Model } from "jali-layout/adapter";

const LIT = ["data-live-lit", "data-live-dim"] as const;

/** The pane, tab or shelf chip an element is, by Jali's attributes. */
const idOf = (el: HTMLElement) => el.dataset.pane ?? el.dataset.tab ?? el.dataset.chip;

/** Lights the panes `ids` (their tab and shelf chip too, when they are behind one) and dims the others. */
export function useLitPanes(
  wrap: RefObject<HTMLElement | null>,
  ids: string[] | null,
  model: Model,
) {
  useLayoutEffect(() => {
    const root = wrap.current;
    if (!root) return;
    for (const a of LIT) root.querySelectorAll(`[${a}]`).forEach((el) => el.removeAttribute(a));
    if (!ids) return;
    const lit = new Set(ids);
    root.querySelectorAll<HTMLElement>("[data-pane]").forEach((el) => {
      el.setAttribute(lit.has(idOf(el)!) ? "data-live-lit" : "data-live-dim", "");
    });
    root.querySelectorAll<HTMLElement>("[data-tab], [data-chip]").forEach((el) => {
      if (lit.has(idOf(el) ?? "")) el.setAttribute("data-live-lit", "");
    });
  }, [wrap, ids?.join(), model]);
}

/** Gives each pane, tab and shelf chip its identity colour (`--live-id`), the same as its box in the map. */
export function usePaneColours(
  wrap: RefObject<HTMLElement | null>,
  colourOf: (id: string) => string,
  model: Model,
) {
  useLayoutEffect(() => {
    const root = wrap.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-pane], [data-tab], [data-chip]").forEach((el) => {
      const id = idOf(el);
      if (!id) return;
      el.style.setProperty("--live-id", colourOf(id));
      el.setAttribute("data-live-id", "");
    });
  }, [wrap, colourOf, model]);
}
