import { createUiStore, createUrlSync, createPaneKinds, memoryStorage } from "@jali/core";
import { orderKind, ordersKind } from "./kinds";

// Two workspaces in one address: each owns its own search params.
const left = createUrlSync({ prefix: "a." });                    // writes a.l, a.zoom, a.peek, …
const right = createUrlSync({ prefix: "b.", sizes: "link" });    // its links carry dragged sizes too

export const leftStore = createUiStore({
  kinds: createPaneKinds([ordersKind, orderKind]),
  initial: { layout: { version: 1, root: { id: "o", type: "pane", size: { weight: 1 }, ref: { kind: "orders", params: {} } } } },
  url: left,
  id: "left",
  storage: memoryStorage(),
});

left.read(leftStore.env.kinds.registry());   // { layout, view } | { broken, view } | { page, view } | null
right.href();                                 // the address to share
