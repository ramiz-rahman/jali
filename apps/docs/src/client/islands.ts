/**
 * Hydrates the page's islands (src/shell/island.tsx): each live part loads its code and React when it comes near the
 * screen, and hydrates the HTML the build wrote for it. A page without islands loads no React at all.
 */
import type { ComponentType } from "react";
import { islandPrefix, type IslandName } from "./island-id";

/** Every island, and where its code is. Each loads on its own, the first time a page needs it. */
const REGISTRY = {
  TreeView: () => import("../live/TreeView").then((m) => m.TreeView),
  Frame: () => import("../live/Frame").then((m) => m.Frame),
  Spotlight: () => import("../live/Spotlight").then((m) => m.Spotlight),
  QuickstartApp: () => import("../live/Quickstart").then((m) => m.QuickstartApp),
  LinkDemo: () => import("../shell/landing/demos").then((m) => m.LinkDemo),
  FollowDemo: () => import("../shell/landing/demos").then((m) => m.FollowDemo),
  KeysDemo: () => import("../shell/landing/demos").then((m) => m.KeysDemo),
} satisfies Record<IslandName, () => Promise<ComponentType<never>>>;

/** Islands whose code is loading now, so a second ask (Try again pressed twice) doesn't load it twice. */
const loading = new WeakSet<HTMLElement>();

/**
 * Load an island's code and hydrate it. Code that fails to load (a dropped connection, a deploy that replaced the
 * chunks) happens before React and its error boundary exist, so it is shown here: a note after the island, which keeps
 * its prerendered HTML, with Try again. The note sits outside the island so hydration still finds the HTML as built.
 */
async function hydrate(el: HTMLElement) {
  const load = REGISTRY[el.dataset.island as IslandName];
  if (!load || loading.has(el)) return;
  loading.add(el);
  let modules;
  try {
    modules = await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("../shell/ErrorBoundary"),
      load(),
    ]);
  } catch (error) {
    console.error(error);
    failed(el);
    return;
  } finally {
    loading.delete(el);
  }
  failedNote(el)?.remove();
  const [{ createElement }, { hydrateRoot }, { IslandBoundary }, Component] = modules;
  const props = JSON.parse(el.dataset.props ?? "{}") as object;
  // `data-hydrated` once React has taken the island over: what the tests wait for.
  const onHydrated = () => el.setAttribute("data-hydrated", "");
  hydrateRoot(
    el,
    createElement(IslandBoundary, {
      onHydrated,
      children: createElement(Component as ComponentType<object>, props),
    }),
    { identifierPrefix: islandPrefix(el.dataset.islandId ?? "0") },
  );
}

const failedNote = (el: HTMLElement) =>
  el.nextElementSibling?.matches(".island-error[data-island-note]") ? el.nextElementSibling : null;

/** Say an island's code didn't load, after the island, with a button that tries again. A try that fails again keeps
 *  the note and its button (and so the reader's focus), and only puts the button's words back. */
function failed(el: HTMLElement) {
  const shown = failedNote(el)?.querySelector("button");
  if (shown) {
    shown.textContent = "Try again";
    return;
  }
  const note = document.createElement("p");
  note.className = "island-error";
  note.setAttribute("role", "alert");
  note.setAttribute("data-island-note", "");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "page-action";
  retry.textContent = "Try again";
  // Not disabled while it loads, so focus stays on it; `loading` keeps a second press from loading twice.
  retry.addEventListener("click", () => {
    retry.textContent = "Loading";
    void hydrate(el);
  });
  note.append("This demo didn't load. ", retry);
  el.after(note);
}

export function hydrateIslands() {
  const els = [...document.querySelectorAll<HTMLElement>("[data-island]")];
  if (!els.length) return;
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              io?.unobserve(e.target);
              const el = (e.target as HTMLElement).closest<HTMLElement>("[data-island]");
              if (el) void hydrate(el);
            }
          },
          { rootMargin: "400px 0px" },
        )
      : null;
  for (const el of els) {
    // The wrapper is `display: contents`, so it has no box to watch: its first element stands in for it.
    const target = el.firstElementChild ?? el;
    if (el.dataset.when === "load" || !io) void hydrate(el);
    else io.observe(target);
  }
}
