import { createJali, pane, row } from "jali-layout";
import { launcherKind, orderKind, ordersKind } from "./kinds";

export const store = createJali({
  panes: [ordersKind, orderKind],
  launcher: launcherKind,
  presets: [
    {
      id: "orders",
      label: "Orders",
      // Orders on the left, the selected order beside it.
      layout: row(
        pane(ordersKind(), { id: "orders" }),
        pane(orderKind({ id: 1041 }), { id: "order", linkedTo: "orders", follows: true }),
      ),
    },
  ],
  name: "Sales desk",
  keyboard: { keymap: { "pane.close": "Mod+K Mod+X", "pane.split.down": null } },
});
