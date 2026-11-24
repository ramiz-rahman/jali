/**
 * Opening search: the top bar's `[data-search-open]` button, ⌘K or Ctrl+K, or "/" when the reader isn't typing. The
 * dialog's code (src/client/search.tsx) loads the first time it is wanted, and on the way there (the pointer on the
 * button, or focus).
 */
import { all } from "../client/dom";

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

let search: Promise<typeof import("../client/search")> | null = null;
const load = () => (search ??= import("../client/search"));
const openSearch = () => void load().then((m) => m.openSearch());

export function initSearch() {
  // The button says Ctrl K in the HTML (for Windows and Linux); a Mac reader sees ⌘K.
  if (isMac()) for (const k of all(".search-button-kbd")) k.textContent = "⌘K";
  for (const b of all("[data-search-open]")) {
    b.addEventListener("click", openSearch);
    b.addEventListener("pointerenter", () => void load(), { once: true });
    b.addEventListener("focus", () => void load(), { once: true });
  }
  window.addEventListener("keydown", (e) => {
    // Inside a live workspace, ⌘K is its command palette.
    if (e.defaultPrevented || (e.target instanceof Element && e.target.closest("[data-jali]")))
      return;
    const typing =
      e.target instanceof HTMLElement &&
      (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    const shortcut =
      ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) ||
      (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey);
    if (!shortcut) return;
    e.preventDefault();
    openSearch();
  });
}
