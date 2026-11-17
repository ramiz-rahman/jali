/** Every DOM focus move the workspace makes, in one place. The store asks for them; it never touches the DOM. */
import type { NodeId } from "../../layout-core/types";
import { paneDomId } from "./ids";

/** The element a pane's focus lands on: its autofocus target, else its grid (so J/K and Space keep working), else itself. */
function paneTarget(el: HTMLElement) {
  return el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>("[role=grid]") ?? el;
}

/** Focus a pane after the next paint, unless focus is on a divider or in a dialog. */
export function focusPane(id: NodeId) {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    if (document.activeElement?.closest?.("[role=separator], .divider, [role=dialog]")) return;
    const el = document.getElementById(paneDomId(id));
    if (el) paneTarget(el).focus({ preventScroll: true });
  });
}

/**
 * Keep DOM focus on the focused pane after structural changes (focus is never lost): move it there when it is on the
 * body or in another pane, but never out of a dialog, the top bar, a toast or a divider.
 */
export function keepPaneFocus(id: NodeId | undefined) {
  if (!id) return;
  const el = document.getElementById(paneDomId(id));
  const active = document.activeElement;
  if (!el) return;
  const inPane = !!active && el.contains(active);
  const inOtherPane = !!active?.closest?.("[data-pane]") && !inPane;
  const inChrome = !!active?.closest?.("[role=dialog], .topbar, [data-sonner-toaster], .divider");
  if (!inPane && !inChrome && (inOtherPane || !active || active === document.body)) paneTarget(el).focus({ preventScroll: true });
}

/** The tab (pane id) that holds DOM focus, if any. */
export function activeTabId(): NodeId | undefined {
  if (typeof document === "undefined") return undefined;
  return (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>("[data-tab]")?.dataset.tab;
}

/** The shelf, when it is on screen (on a phone it folds into the pane switcher). */
export function shownShelf(): HTMLElement | null {
  const shelf = typeof document !== "undefined" ? document.querySelector<HTMLElement>("[data-shelf]") : null;
  return shelf && shelf.getClientRects().length > 0 ? shelf : null;
}

export const focusInShelf = (shelf: HTMLElement) => !!document.activeElement && shelf.contains(document.activeElement);

/** F6 into the shelf: its roving chip, else the region. */
export function focusShelf(shelf: HTMLElement) {
  (shelf.querySelector<HTMLElement>('.shelf-chip-main[tabindex="0"]') ?? shelf).focus();
}

/** ⌘K "Show a pane from the shelf" with several panes: focus the first chip (the shelf need not be on screen). */
export function focusShelfChip(): boolean {
  const chip = typeof document !== "undefined" ? document.querySelector<HTMLElement>('[data-shelf] .shelf-chip-main[tabindex="0"], [data-shelf] .shelf-chip-main') : null;
  chip?.focus();
  return !!chip;
}

/** A 600ms highlight on a tab, so the eye finds where a revealed pane went. Skipped under reduced motion. */
export function flashTab(paneId: NodeId) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[role="tab"][data-tab="${paneId}"]`);
    if (!el) return;
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 600);
  });
}
