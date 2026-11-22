import { createJali } from "jali";
import { orderKind, ordersKind } from "../../reference/kinds";

// Only what changes: the rest stays English.
export const jali = createJali({
  panes: [ordersKind, orderKind],
  layout: ordersKind(),
  messages: {
    commands: { close: "Close tab", closeOthers: "Close other tabs" },
    palette: { placeholder: "Search commands…" },
    announcements: { closed: (pane) => `${pane} closed. You can undo this.` },
  },
});
