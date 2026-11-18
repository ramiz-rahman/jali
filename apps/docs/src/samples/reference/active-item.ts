import { activeItemPort } from "@jali/core";
import { orderKind } from "./kinds";
import { store } from "./store";

// A list in pane "orders" keeps its current row through the port; the workspace follows it.
const port = activeItemPort(store, "orders", {
  toRef: (itemId) => orderKind({ id: Number(itemId) }),
  idOf: (ref) => (ref.kind === "order" ? String(ref.params.id) : null),
});

port.write("1042", "step");   // the cursor moved: the following detail shows order 1042 once it rests
port.write("1042", "open");   // Space: show it (the following detail if on screen, else the peek sheet)
port.write("1042", "close");  // Esc: close the peek this list opened; the cursor stays
port.itemId;                  // "1042"
