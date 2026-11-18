import { createPaneKinds, createUiStore, type Layout } from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";

// A workspace with no presets starts from one layout instead.
const start: Layout = {
  version: 1,
  root: { id: "orders", type: "pane", size: { weight: 1 }, ref: { kind: "orders", params: {} } },
};

export const store = createUiStore({
  kinds: createPaneKinds(orderKinds),
  initial: { layout: start },
});
