import { createJali } from "jali";
import { orderKinds, orderList } from "../pane-kinds/orders";

// With no presets, Jali opens on one layout: here, the order list alone.
export const jali = createJali({
  panes: orderKinds,
  layout: orderList(),
});
