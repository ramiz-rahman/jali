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
  KeysDemo: () => import("../shell/landing/demos").then((m) => m.KeysDemo),
} satisfies Record<IslandName, () => Promise<ComponentType<never>>>;

async function hydrate(el: HTMLElement) {
  const load = REGISTRY[el.dataset.island as IslandName];
  if (!load) return;
  const [{ createElement }, { hydrateRoot }, { IslandBoundary }, Component] = await Promise.all([
    import("react"),
    import("react-dom/client"),
    import("../shell/ErrorBoundary"),
    load(),
  ]);
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
