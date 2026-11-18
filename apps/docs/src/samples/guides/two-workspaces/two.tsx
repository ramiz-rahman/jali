import { createRoot } from "react-dom/client";
import { createWorkspace } from "@jali/core";
import { Jali } from "@jali/react";
import "@jali/react/styles.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";

// The orders workspace: the address's plain params (l, zoom, peek), localStorage keys "orders:…".
const orders = createWorkspace({
  id: "orders", // DOM ids "orders-pane-…"
  keys: "workspace", // only keys pressed inside it, or on the page body after it was used last
  panes: orderKinds,
  presets,
  storage: "orders",
});

// The notes workspace: params "n.l", "n.zoom", "n.peek", localStorage keys "notes:…".
const notes = createWorkspace({
  id: "notes",
  keys: "workspace",
  panes: [ticketNote],
  layout: ticketNote({ id: 42 }),
  url: { prefix: "n." },
  storage: "notes",
});

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <Jali workspace={orders} className="orders" />
    <Jali workspace={notes} className="notes" />
  </div>,
);
