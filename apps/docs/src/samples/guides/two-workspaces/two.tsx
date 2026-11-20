import { createRoot } from "react-dom/client";
import { createJali } from "@jali/core";
import { JaliRoot } from "@jali/react";
import "@jali/react/styles.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";

// The orders workspace: the address's plain params (l, zoom, peek). Its id names its DOM ids ("orders-pane-…")
// and its localStorage keys ("orders:…").
const orders = createJali({
  id: "orders",
  label: "Orders", // its landmark's name, and part of each pane's, for screen readers
  keys: "scoped", // only keys pressed inside it and its dialogs, or on the page body after it was used last
  panes: orderKinds,
  presets,
});

// The notes workspace: params "n.l", "n.zoom", "n.peek", DOM ids "notes-pane-…", localStorage keys "notes:…".
// The orders workspace sets the page's theme; this one leaves it alone.
const notes = createJali({
  id: "notes",
  label: "Notes",
  keys: "scoped",
  pageTheme: false,
  panes: [ticketNote],
  layout: ticketNote({ id: 42 }),
  url: { prefix: "n." },
});

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <JaliRoot jali={orders} className="orders" />
    <JaliRoot jali={notes} className="notes" />
  </div>,
);
