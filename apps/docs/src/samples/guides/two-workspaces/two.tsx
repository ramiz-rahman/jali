import { createRoot } from "react-dom/client";
import { createWorkspace } from "@jali/core";
import { Jali } from "@jali/react";
import "@jali/react/styles.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";

// The orders workspace: the address's plain params (l, zoom, peek). Its id names its DOM ids ("orders-pane-…")
// and its localStorage keys ("orders:…").
const orders = createWorkspace({
  id: "orders",
  keys: "workspace", // only keys pressed inside it and its dialogs, or on the page body after it was used last
  panes: orderKinds,
  presets,
});

// The notes workspace: params "n.l", "n.zoom", "n.peek", DOM ids "notes-pane-…", localStorage keys "notes:…".
// The orders workspace sets the page's theme; this one leaves it alone.
const notes = createWorkspace({
  id: "notes",
  keys: "workspace",
  pageTheme: false,
  panes: [ticketNote],
  layout: ticketNote({ id: 42 }),
  url: { prefix: "n." },
});

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <Jali workspace={orders} className="orders" />
    <Jali workspace={notes} className="notes" />
  </div>,
);
