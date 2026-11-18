import { boot, browserStorage, createPaneKinds, createUiStore, createUrlSync, startUi } from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

const storage = browserStorage("orders-app"); // localStorage keys start "orders-app:"

const url = createUrlSync({
  // "local" (the default): a link carries the layout as designed; sizes the person dragged stay on their device.
  // "link": a link carries every size too, so it reopens exactly as it was sent.
  sizes: "local",
  // Where "local" keeps those sizes, and where a link that could not be read is kept.
  storage,
});

export const store = createUiStore({ kinds: createPaneKinds(orderKinds), presets, url, storage });

boot(store);    // reads the address: a link with a layout opens it, fitted to the window
startUi(store); // Back and Forward step through layouts from here on
