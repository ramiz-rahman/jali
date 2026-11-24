import { createJali } from "jali-layout";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { urlSync } from "jali-layout/url";

export const jali = createJali({
  panes: orderKinds,
  presets,
  features: [
    urlSync({
      // "local" (the default): a link carries the layout as designed; sizes the person dragged stay on their device.
      // "link": a link carries every size too, so it reopens exactly as it was sent.
      sizes: "local",
    }),
  ],
  // localStorage keys start "orders-app:". The address keeps dragged sizes, and any link it could not read, here too.
  storage: "orders-app",
});
