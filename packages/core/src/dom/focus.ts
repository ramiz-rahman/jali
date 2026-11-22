/** Every DOM focus move the instance makes, in one place. The store asks for them; it never touches the DOM. */
import type { NodeId } from "../layout/types";
import type { JaliDom } from "./scope";

/**
 * Focus here is in the instance's own overlays (its layer: its dialogs and menus) or any dialog: the instance never
 * pulls it into a pane.
 */
const DIALOG = "[role=dialog], [role=alertdialog], dialog";
const inOverlay = (dom: JaliDom, el: Element) =>
  !!dom.layer()?.contains(el) || !!el.closest(DIALOG);

/** The element a pane's focus lands on: its autofocus target, else its grid (so J/K and Space keep working), else itself. */
function paneTarget(el: HTMLElement) {
  return (
    el.querySelector<HTMLElement>("[data-autofocus]") ??
    el.querySelector<HTMLElement>("[role=grid]") ??
    el
  );
}

/** Focus a pane after the next paint, unless focus is on a divider or in a dialog. */
export function focusPane(dom: JaliDom, id: NodeId) {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (
      active?.closest &&
      (active.closest("[role=separator]") || dom.port.inDivider(active) || inOverlay(dom, active))
    )
      return;
    const el = dom.pane(id);
    if (el) paneTarget(el).focus({ preventScroll: true });
  });
}

/**
 * Keep DOM focus on the focused pane after structural changes (focus is never lost): move it there when it is on the
 * body or in another pane, but never out of a dialog, a divider, the host's own chrome (anything marked
 * `data-jali-chrome`, such as an app's top bar) or anything outside the instance's root (a toast, say).
 * `fromBody: false` leaves focus on the body too: the person has not been in this instance (it just mounted, or they
 * are elsewhere on the page), so the change is not theirs to follow.
 */
export function keepPaneFocus(
  dom: JaliDom,
  id: NodeId | undefined,
  { fromBody = true }: { fromBody?: boolean } = {},
) {
  if (!id) return;
  const el = dom.pane(id);
  const active = document.activeElement;
  if (!el) return;
  const inPane = !!active && el.contains(active);
  const inOtherPane = !!active?.closest && dom.port.inPane(active) && !inPane;
  const root = dom.root();
  const outside =
    !!active && active !== document.body && root !== document && !root.contains(active);
  const inChrome =
    outside ||
    (!!active?.closest &&
      (inOverlay(dom, active) ||
        !!active.closest("[data-jali-chrome]") ||
        dom.port.inDivider(active)));
  if (!inPane && !inChrome && (inOtherPane || (fromBody && (!active || active === document.body))))
    paneTarget(el).focus({ preventScroll: true });
}

/** The tab (pane id) that holds DOM focus, if any. */
export function activeTabId(dom: JaliDom): NodeId | undefined {
  if (typeof document === "undefined" || !document.activeElement) return undefined;
  return dom.port.tabOf(document.activeElement);
}

/** The shelf, when it is on screen (on a phone it folds into the pane switcher). */
export function shownShelf(dom: JaliDom): HTMLElement | null {
  const shelf = typeof document !== "undefined" ? dom.port.shelf(dom.root()) : null;
  return shelf && shelf.getClientRects().length > 0 ? shelf : null;
}

export const focusInShelf = (shelf: HTMLElement) =>
  !!document.activeElement && shelf.contains(document.activeElement);

/** F6 into the shelf: its roving chip, else the region. */
export function focusShelf(dom: JaliDom, shelf: HTMLElement) {
  (dom.port.shelfChip(shelf) ?? shelf).focus();
}

/** ⌘K "Show a pane from the shelf" with several panes: focus the first chip (the shelf need not be on screen). */
export function focusShelfChip(dom: JaliDom): boolean {
  const shelf = typeof document !== "undefined" ? dom.port.shelf(dom.root()) : null;
  const chip = shelf && dom.port.shelfChip(shelf);
  chip?.focus();
  return !!chip;
}

/** A highlight on a tab, so the eye finds where a revealed pane went. Skipped under reduced motion. */
export function flashTab(dom: JaliDom, paneId: NodeId) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  requestAnimationFrame(() => {
    const el = dom.port.tab(dom.root(), paneId);
    if (el) dom.port.flash(el);
  });
}
