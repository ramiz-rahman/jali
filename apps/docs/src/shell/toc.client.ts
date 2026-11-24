/**
 * "On this page" (./Toc.tsx: its `.toc-link`s): marks the section being read, and folds the narrow screens'
 * disclosure away once a section is chosen.
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
  let frame = 0;
  let current: string | undefined;
  const update = () => {
    frame = 0;
    const offset = 120;
    let id = headings[0]!.id;
    for (const h of headings) if (h.getBoundingClientRect().top - offset <= 0) id = h.id;
    // At the very bottom, the last heading is the one being read.
    const root = document.documentElement;
    if (window.innerHeight + window.scrollY >= root.scrollHeight - 4) id = headings.at(-1)!.id;
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
