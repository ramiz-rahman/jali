import { createPaneKinds, createUiStore, type Command } from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

// Your app's own commands: listed in ⌘K after Jali's, under a group of your own.
const commands: Command[] = [
  { id: "orders.refresh", title: "Refresh orders", group: "Orders", run: () => void fetch("/api/orders/refresh", { method: "POST" }) },
  { id: "orders.export", title: "Export orders as CSV", group: "Orders", run: () => window.open("/api/orders.csv") },
];

export const store = createUiStore({
  kinds: createPaneKinds(orderKinds),
  presets,
  commands,
  // Bound like any of Jali's commands.
  keymap: { "orders.refresh": "Mod+K Mod+U" },
});
