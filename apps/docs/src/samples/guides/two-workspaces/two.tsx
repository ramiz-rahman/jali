import { createRoot } from "react-dom/client";
import { createJali } from "jali";
import { JaliRoot } from "jali/react";
import "jali/styles.css";
import "./page.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";
import { urlSync } from "jali/url";

// Orders: the address's plain params (l, zoom, peek). Its id names its DOM ids ("orders-pane-…")
// and its localStorage keys ("orders:…").
const orders = createJali({
  id: "orders",
  label: "Orders", // its landmark's name, and part of each pane's, for screen readers
  keyboard: { scope: "local" }, // only keys pressed inside it and its dialogs, or on the page body after it was used last
  panes: orderKinds,
  presets,
  features: [urlSync()],
});

// Notes: params "n.l", "n.zoom", "n.peek", DOM ids "notes-pane-…", localStorage keys "notes:…".
// Orders sets the page's theme; notes leaves it alone.
const notes = createJali({
  id: "notes",
  label: "Notes",
  keyboard: { scope: "local" },
  pageTheme: false,
  panes: [ticketNote],
  layout: ticketNote({ id: 42 }),
  features: [urlSync({ prefix: "n." })],
});

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <JaliRoot jali={orders} className="orders" />
    <JaliRoot jali={notes} className="notes" />
  </div>,
);
