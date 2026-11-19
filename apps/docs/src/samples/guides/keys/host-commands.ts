import { createJali, type Command } from "@jali/core";
import { launcher, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

// Your app's own commands: listed in ⌘K after Jali's, under a group of your own.
const commands: Command[] = [
  {
    id: "orders.refresh",
    title: "Refresh orders",
    group: "Orders",
    run: () => void fetch("/api/orders/refresh", { method: "POST" }),
  },
  {
    id: "orders.export",
    title: "Export orders as CSV",
    group: "Orders",
    run: () => window.open("/api/orders.csv"),
  },
];

export const jali = createJali({
  panes: orderKinds,
  launcher,
  presets,
  commands,
  // Bound like any of Jali's commands.
  keymap: { "orders.refresh": "Mod+K Mod+U" },
});
