import { createJali, type Command } from "jali-layout";
import { launcher, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

// Your app's own commands: listed in ⌘K after Jali's, under a group of your own.
const commands: Command[] = [
  {
    id: "orders.refresh",
    title: "Refresh orders",
    group: "Orders",
    keys: "Mod+K Mod+U",
    run: () => void fetch("/api/orders/refresh", { method: "POST" }),
  },
  {
    id: "orders.export",
    title: "Export orders as CSV",
    group: "Orders",
    // Greyed out in ⌘K, with the reason, while it can't run; its key would only say the reason.
    disabled: () => !navigator.onLine && "You're offline",
    run: () => window.open("/api/orders.csv"),
  },
];

export const jali = createJali({
  panes: orderKinds,
  launcher,
  presets,
  commands,
  // A person's or a platform's own keys go over the command's, as for Jali's commands.
  keyboard: { keymap: { "orders.export": "Mod+K Mod+E" } },
});
