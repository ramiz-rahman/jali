import { createPaneKinds, createUiStore, createUrlSync, type Layout } from "@jali/core";
import { launcherKind, orderKind, ordersKind } from "./kinds";

// Orders on the left, the selected order beside it.
const ordersLayout = (): Layout => ({
  version: 1,
  root: {
    id: "root", type: "row", size: { weight: 1 }, children: [
      { id: "orders", type: "pane", size: { weight: 1 }, ref: { kind: "orders", params: {} } },
      { id: "order", type: "pane", size: { weight: 1 }, ref: { kind: "order", params: { id: 1041 } }, linkedTo: "orders", follows: true },
    ],
  },
});

export const store = createUiStore({
  kinds: createPaneKinds([ordersKind, orderKind, launcherKind]),
  presets: [{ id: "orders", label: "Orders", build: ordersLayout }],
  name: "Sales desk",
  url: createUrlSync(),
  keymap: { "pane.close": "Mod+K Mod+W", "pane.split.down": null },
});
