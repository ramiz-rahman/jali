/**
 * F6 regions (WAI-ARIA APG window splitter, "F6: cycle through window panes"): F6 visits every pane on screen in
 * reading order, then the regions outside the panes, then wraps. Regions are the shelf (when shown) and anything the
 * host marks with `data-pane-region` (the review page's queue). Focus lands on the region's roving item
 * (`[tabindex="0"]`), else the region itself.
 */
import { focusInShelf, focusShelf, shownShelf } from "../dom/focus";
import type { UiStore } from "../state/store";

/** Host regions in document order, on screen only. */
function hostRegions(root: ParentNode): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return [...root.querySelectorAll<HTMLElement>("[data-pane-region]")].filter(
    (el) => el.getClientRects().length > 0,
  );
}

function focusRegion(el: HTMLElement) {
  (el.querySelector<HTMLElement>('[tabindex="0"]') ?? el).focus();
}

export function cycleRegions(store: UiStore, back: boolean): void {
  const shelf = shownShelf(store.dom);
  const extra = hostRegions(store.dom.root());
  const stops: { el: HTMLElement; enter(): void }[] = [
    ...(shelf
      ? [
          {
            el: shelf,
            enter: () => {
              focusShelf(shelf);
              store.announce(store.messages.announcements.shelf);
            },
          },
        ]
      : []),
    ...extra.map((el) => ({ el, enter: () => focusRegion(el) })),
  ];
  const active = typeof document !== "undefined" ? document.activeElement : null;
  const inStop = stops.findIndex((r) =>
    r.el === shelf ? focusInShelf(r.el) : !!active && r.el.contains(active),
  );
  if (inStop >= 0) {
    const next = inStop + (back ? -1 : 1);
    if (next >= 0 && next < stops.length) stops[next]!.enter();
    else store.actions.focusEnd(back);
    return;
  }
  const { s, m } = store.snapshot();
  const at = m.visible.indexOf(s.view.focused ?? "");
  if (stops.length && at >= 0 && (back ? at === 0 : at === m.visible.length - 1)) {
    stops[back ? stops.length - 1 : 0]!.enter();
    return;
  }
  store.actions.focusCycle(back ? -1 : 1);
}
