import { createRoot } from "react-dom/client";
import { boot, createPaneKinds, createUiStore, createUrlSync, startUi } from "@jali/core";
import { Jali, JaliView } from "@jali/react";
import "@jali/react/styles.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";

// The orders workspace: the address's plain params (l, zoom, peek), DOM ids "orders-pane-…", localStorage "orders:…".
const orders = createUiStore({
  id: "orders",
  kinds: createPaneKinds(orderKinds),
  presets,
  url: createUrlSync(),
});

// The notes workspace: params "n.l", "n.zoom", "n.peek", DOM ids "notes-pane-…", localStorage "notes:…".
const notes = createUiStore({
  id: "notes",
  kinds: createPaneKinds([ticketNote]),
  initial: {
    layout: { version: 1, root: { id: "note", type: "pane", size: { weight: 1 }, ref: { kind: "ticket-note", params: { id: 42 } } } },
  },
  url: createUrlSync({ prefix: "n." }),
});

boot(orders);
boot(notes);

// Each takes only keys from inside its own root and its dialogs, and keys on the page body when it was used last.
// One of them writes the theme on <html>; the other leaves it alone.
startUi(orders, { root: orders.dom.root });
startUi(notes, { root: notes.dom.root, theme: false });

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <Jali store={orders} className="orders"><JaliView /></Jali>
    <Jali store={notes} className="notes"><JaliView /></Jali>
  </div>,
);
