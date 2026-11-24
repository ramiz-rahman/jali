/**
 * The home page's showcase (ExampleShowcase in ./ExampleApp.tsx): six leaves, one open and the rest folded to a spine.
 * A spine's click opens its app; the arrows, Home, End and 1 to 6 move between them while focus is inside.
 *
 * The tour opens each app in turn while the shelf is on screen. Its clock is the open leaf's progress line: a CSS
 * animation whose end opens the next leaf, so pausing it (pointer over the shelf, focus inside, off screen) is a
 * matter of `animation-play-state`. Choosing an app ends the tour; the button under the shelf plays or pauses it. With
 * reduced motion it never starts.
 */
import { all, rovingIndex } from "../client/dom";

function initShelf(shelf: HTMLElement) {
  const leaves = all(".leaf", shelf);
  const spines = leaves.map((l) => l.querySelector<HTMLButtonElement>(".leaf-spine")!);
  const tour = shelf.querySelector<HTMLButtonElement>("[data-shelf-tour]");
  const current = () => leaves.findIndex((l) => l.hasAttribute("data-open"));

  function open(i: number) {
    leaves.forEach((leaf, j) => {
      const on = i === j;
      leaf.toggleAttribute("data-open", on);
      spines[j]!.setAttribute("aria-expanded", String(on));
      spines[j]!.tabIndex = on ? 0 : -1;
      leaf.querySelector<HTMLAnchorElement>(".leaf-shot")!.tabIndex = on ? 0 : -1;
    });
    for (const c of all("[data-caption]", shelf))
      c.hidden = c.dataset.caption !== leaves[i]!.dataset.leaf;
  }

  const setTour = (on: boolean) => (shelf.dataset.auto = on ? "on" : "off");

  /** The reader chose an app: open it and end the tour. */
  function choose(i: number, focus = false) {
    setTour(false);
    open(i);
    if (focus) spines[i]!.focus();
  }

  shelf.addEventListener("click", (e) => {
    const spine = (e.target as Element).closest(".leaf-spine");
    if (spine) choose(spines.indexOf(spine as HTMLButtonElement));
  });

  shelf.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as Element).closest("input, textarea, select")) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= leaves.length) {
      e.preventDefault();
      choose(n - 1, true);
      return;
    }
    if (!(e.target as Element).closest(".leaf-spine")) return;
    const to = rovingIndex(e, current(), leaves.length, true);
    if (to < 0) return;
    e.preventDefault();
    choose(to, true);
  });

  // The tour: the open leaf's progress line ending opens the next one.
  shelf.addEventListener("animationend", (e) => {
    if (!(e.target as Element).classList.contains("leaf-progress") || shelf.dataset.auto !== "on")
      return;
    open((current() + 1) % leaves.length);
  });

  // Held while the pointer is over the leaves or focus is on a leaf or a caption, so nothing moves under the reader.
  // The tour's own button doesn't hold it: pressing Play should play.
  const row = shelf.querySelector<HTMLElement>(".shelf-row")!;
  const holding = (el: Element | null) =>
    !!el && shelf.contains(el) && !el.closest("[data-shelf-tour]");
  const hold = (on: boolean) => shelf.toggleAttribute("data-held", on);
  row.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && hold(true));
  row.addEventListener("pointerleave", () => hold(holding(document.activeElement)));
  shelf.addEventListener("focusin", (e) => hold(holding(e.target as Element)));
  shelf.addEventListener("focusout", (e) => {
    if (!holding(e.relatedTarget as Element | null)) hold(row.matches(":hover"));
  });

  new IntersectionObserver(
    ([entry]) => shelf.toggleAttribute("data-seen", !!entry?.isIntersecting),
    {
      threshold: 0.5,
    },
  ).observe(shelf);

  if (tour) {
    tour.addEventListener("click", () => setTour(shelf.dataset.auto !== "on"));
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      tour.hidden = false;
      setTour(true);
    }
  }
}

export function initShowcase() {
  for (const shelf of all("[data-shelf]")) initShelf(shelf);
}
