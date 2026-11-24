/**
 * "On this page" (./Toc.tsx: its `.toc-link`s): marks the section being read, names it on the folded bar, and folds
 * the bar's list away once a section is chosen.
 */
import { all } from "../client/dom";

export function initToc() {
  const links = all<HTMLAnchorElement>(".toc-link");
  for (const a of links)
    a.addEventListener("click", () => a.closest("details")?.removeAttribute("open"));
  const ids = [...new Set(links.map((a) => decodeURIComponent(a.hash.slice(1))))];
  const headings = ids
    .map((id) => document.getElementById(id))
    .filter((h): h is HTMLElement => !!h);
  if (!headings.length) return;
  const named = all<HTMLElement>("[data-toc-current]");
  // The folded bar, where it shows, covers the page's top: a section is being read once its heading is past the bar.
  const bar = named[0]?.closest("details");
  if (bar) {
    // Opened, its list shows the section being read, not the top of a long page's list.
    bar.addEventListener("toggle", () => {
      const panel = bar.querySelector<HTMLElement>(".toc-disclosure-panel");
      const here = panel?.querySelector<HTMLElement>('[aria-current="location"]');
      if (bar.open && panel && here)
        panel.scrollTop = here.offsetTop - panel.clientHeight / 2 + here.offsetHeight / 2;
    });
    // It opens over the page as a menu does, so it closes as one: Esc (back to its bar), or a click elsewhere.
    bar.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !bar.open) return;
      bar.removeAttribute("open");
      bar.querySelector("summary")?.focus();
    });
    document.addEventListener("click", (e) => {
      if (bar.open && !bar.contains(e.target as Node)) bar.removeAttribute("open");
    });
  }
  let frame = 0;
  let current: string | undefined;
  const update = () => {
    frame = 0;
    // Under the folded bar, a section is the one being read once its heading is in the top third of the window, below
    // where the bar sits once it sticks (not where it sits now: at the top of the page it is further down). The
    // column, with no bar, marks a heading 120px from the top.
    const shown = !!bar?.offsetParent;
    const barFoot = shown ? parseFloat(getComputedStyle(bar).top) + bar.offsetHeight : 0;
    const offset = shown ? Math.max(barFoot + 96, window.innerHeight * 0.3) : 120;
    let id = headings[0]!.id;
    let reached = false;
    for (const h of headings)
      if (h.getBoundingClientRect().top - offset <= 0) {
        id = h.id;
        reached = true;
      }
    // At the very bottom, the last heading is the one being read.
    const root = document.documentElement;
    if (window.innerHeight + window.scrollY >= root.scrollHeight - 4) id = headings.at(-1)!.id;
    // The bar names a section once the reader is in one; above the first, it says only "On this page".
    const link = links.find((a) => decodeURIComponent(a.hash.slice(1)) === id);
    const name = reached ? (link?.textContent?.trim() ?? "") : "";
    for (const n of named) if (n.textContent !== name) n.textContent = name;
    if (id === current) return;
    current = id;
    for (const a of links) {
      if (decodeURIComponent(a.hash.slice(1)) === id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
  };
  const later = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", later, { passive: true });
  window.addEventListener("resize", later);
}
