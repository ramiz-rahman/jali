import { createJali } from "@jali/core";
import { orderKinds, orderList } from "../pane-kinds/orders";

// A workspace with no presets opens on one layout: here, the order list alone.
export const jali = createJali({
  panes: orderKinds,
  layout: orderList(),
});
