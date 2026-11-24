/** A store for one figure on the shop, embedded in the page as every workspace is (./embedded.ts). */
import { useState } from "react";
import { createPaneKinds, createJaliStore, type JaliStore } from "jali-layout/adapter";
import { chooser } from "jali-layout/chooser";
import { palette } from "jali-layout/palette";
import { buildDemoLayout, type DemoLayoutId } from "../shop/layouts";
import { shopKinds } from "../shop/kinds";
import { embedded, useEmbeddedId } from "./embedded";
import { resetTo } from "./jali-gaps";

/**
 * Stable across renders. `label` names the workspace's landmarks (the figure's caption), so figures on one page never
 * repeat one. `centreDrop` is what a drop on a pane's middle does here (Jali's default swaps; the hero adds it as a
 * tab).
 */
export function useLiveStore(
  layoutId: DemoLayoutId,
  label: string,
  centreDrop?: "swap" | "tab",
): JaliStore {
  const id = useEmbeddedId(`live-${layoutId}`);
  const [store] = useState(() =>
    createJaliStore({
      ...embedded(id),
      kinds: createPaneKinds(shopKinds),
      initial: { layout: buildDemoLayout(layoutId), area: { width: 0, height: 0 } },
      name: "Shop",
      label,
      // ⌘K and the chooser; Settings stays the site's own.
      features: [palette(), chooser()],
      ...(centreDrop ? { settings: { centreDrop } } : {}),
    }),
  );
  return store;
}

/** Back to the layout the figure started with. Focus is left where it is (on the reset button). */
export const resetLive = (store: JaliStore, layoutId: DemoLayoutId) =>
  resetTo(store, buildDemoLayout(layoutId));
