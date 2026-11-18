import { createWorkspace } from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

export const workspace = createWorkspace({
  panes: orderKinds,
  presets,
  url: {
    // "local" (the default): a link carries the layout as designed; sizes the person dragged stay on their device.
    // "link": a link carries every size too, so it reopens exactly as it was sent.
    sizes: "local",
  },
  // localStorage keys start "orders-app:". The address keeps dragged sizes, and any link it could not read, here too.
  storage: "orders-app",
});
